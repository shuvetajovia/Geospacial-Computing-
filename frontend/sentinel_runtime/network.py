"""CPU inference for the fixed 14-channel ResUNet architecture."""
import numpy as np


def predict(channels, weights):
    def conv(x, name):
        kernel = weights[name + '.w']
        size = kernel.shape[-1]
        if size == 1:
            result = x @ kernel[:, :, 0, 0].T
        else:
            padded = np.pad(x, ((1, 1), (1, 1), (0, 0)))
            windows = np.lib.stride_tricks.sliding_window_view(padded, (3, 3), axis=(0, 1))
            patches = np.ascontiguousarray(windows).reshape(-1, kernel.shape[1] * 9)
            result = (patches @ kernel.reshape(kernel.shape[0], -1).T).reshape(*x.shape[:2], -1)
        bias = weights.get(name + '.b')
        return result if bias is None else result + bias

    def block(x, name):
        hidden = np.maximum(conv(x, name + '.a'), 0)
        return np.maximum(conv(hidden, name + '.b') + conv(x, name + '.skip'), 0)

    def pool(x):
        h, w, c = x.shape
        return x.reshape(h // 2, 2, w // 2, 2, c).max(axis=(1, 3))

    def decode(x, skip, level):
        name = 'up' + level
        kernel = weights[name + '.w']
        up = np.empty((*skip.shape[:2], kernel.shape[1]), dtype=np.float32)
        for i in range(2):
            for j in range(2):
                up[i::2, j::2] = x @ np.ascontiguousarray(kernel[:, :, i, j]) + weights[name + '.b']
        return block(np.concatenate((up, skip), axis=-1), 'd' + level)

    first = block(np.moveaxis(channels, 0, -1), 'e1')
    second = block(pool(first), 'e2')
    third = block(pool(second), 'e3')
    x = block(pool(third), 'bottleneck')
    x = decode(x, third, '3')
    x = decode(x, second, '2')
    x = decode(x, first, '1')
    return conv(x, 'out_head')[:, :, 0]
