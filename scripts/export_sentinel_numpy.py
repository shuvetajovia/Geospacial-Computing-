"""Pack the original eval-mode ResUNet weights, folding batch normalization into convolution."""
from pathlib import Path
import sys
import numpy as np
import torch
from torch.nn.utils.fusion import fuse_conv_bn_eval

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "frontend"))
from backend.app.services.sentinel_model import LandslideResUNet
from sentinel_runtime.network import predict

model = LandslideResUNet(in_channels=14).eval()
model.load_state_dict(torch.load(ROOT / "models/landslide_sentinel_resunet.pt", map_location="cpu", weights_only=True))
weights = {}
def store(name, module):
    weights[name + ".w"] = module.weight.detach().numpy()
    if module.bias is not None:
        weights[name + ".b"] = module.bias.detach().numpy()
for name in ("e1", "e2", "e3", "bottleneck", "d3", "d2", "d1"):
    block = getattr(model, name)
    store(name + ".a", fuse_conv_bn_eval(block.conv[0], block.conv[1]))
    store(name + ".b", fuse_conv_bn_eval(block.conv[3], block.conv[4]))
    store(name + ".skip", block.shortcut)
for name in ("up3", "up2", "up1", "out_head"):
    store(name, getattr(model, name))
np.savez_compressed(ROOT / "frontend/sentinel_runtime/weights.npz", **weights)
torch.set_num_threads(2)
rng = np.random.default_rng(42)
for _ in range(3):
    sample = rng.random((14,128,128), dtype=np.float32)
    with torch.inference_mode():
        expected = model(torch.from_numpy(sample[None]))[0,0].numpy()
    actual = predict(sample, weights)
    np.testing.assert_allclose(actual, expected, atol=1e-4, rtol=1e-4)
    print("Maximum logit difference:", np.max(np.abs(actual - expected)))
