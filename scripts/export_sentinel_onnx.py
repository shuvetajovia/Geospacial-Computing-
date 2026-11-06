"""Export the supplied checkpoint and verify numerical parity before deployment."""
import sys
from pathlib import Path
import numpy as np
import torch
import onnxruntime as ort

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.app.services.sentinel_model import LandslideResUNet

torch.manual_seed(42)
torch.set_num_threads(2)
model = LandslideResUNet(in_channels=14).eval()
model.load_state_dict(torch.load(ROOT / 'models/landslide_sentinel_resunet.pt', map_location='cpu', weights_only=True))
target = ROOT / 'frontend/sentinel_runtime/landslide.onnx'
target.parent.mkdir(parents=True, exist_ok=True)
sample = torch.rand(1, 14, 128, 128)
torch.onnx.export(model, sample, str(target), input_names=['input'], output_names=['logits'], opset_version=17, dynamo=False)
session = ort.InferenceSession(str(target), providers=['CPUExecutionProvider'])
for index in range(3):
    values = torch.rand(1, 14, 128, 128)
    with torch.inference_mode():
        expected = model(values).numpy()
    actual = session.run(None, {'input': values.numpy()})[0]
    np.testing.assert_allclose(actual, expected, rtol=1e-4, atol=1e-4)
    print(f'Parity sample {index + 1}: max logit error {np.max(np.abs(actual-expected)):.8f}')
print(f'Exported {target.name}: {target.stat().st_size} bytes')
