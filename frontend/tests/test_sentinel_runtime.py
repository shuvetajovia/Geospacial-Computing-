import base64
import io
import json
import unittest
from unittest.mock import patch
import numpy as np
from PIL import Image
from sentinel_runtime import pipeline


class ScreeningTests(unittest.TestCase):
    def scene(self):
        return {'id': 'test_L2A', 'properties': {'datetime': '2026-11-01T00:00:00Z', 'eo:cloud_cover': 10},
                'assets': {key: {'href': key} for key in [*pipeline.BANDS, 'scl']}}

    def test_missing_scene_withholds_inference(self):
        with patch.object(pipeline, 'search', return_value=[]), patch.object(pipeline, 'model') as model:
            self.assertEqual(pipeline.run(28, 96)['state'], 'FAILED')
            model.assert_not_called()

    def test_missing_band_withholds_inference(self):
        scene = self.scene()
        del scene['assets']['red']
        with patch.object(pipeline, 'search', return_value=[scene]), patch.object(pipeline, 'model') as model:
            self.assertIn('missing required spectral bands', pipeline.run(28, 96)['progress'])
            model.assert_not_called()

    def test_complete_response_contains_inline_pngs(self):
        scene = self.scene()
        def search(collection, *args):
            return [{'assets': {'data': {'href': 'dem'}}}] if collection == 'cop-dem-glo-30' else [scene]
        def read(href, crs, transform, size=128, nearest=False):
            if href == 'scl':
                return np.full((size, size), 4, dtype=np.float32)
            return (np.arange(size * size, dtype=np.float32).reshape(size, size) + 1) / 100
        with patch.object(pipeline, 'search', side_effect=search), patch.object(pipeline, 'read_band', side_effect=read):
            result = pipeline.run(28, 96)
        self.assertEqual(result['state'], 'COMPLETE', result['progress'])
        json.dumps(result, allow_nan=False)
        for key in ('rgb_url', 'mask_url'):
            uri = result['result'][key]
            self.assertTrue(uri.startswith('data:image/png;base64,'))
            image = Image.open(io.BytesIO(base64.b64decode(uri.split(',')[1])))
            self.assertEqual(image.size, (128, 128))

    def test_untrusted_raster_hosts_rejected(self):
        for url in ('http://example.com/file.tif', 'https://amazonaws.com.evil.test/file.tif', 'file:///etc/passwd'):
            with self.assertRaises(ValueError):
                pipeline.asset_url(url)


if __name__ == '__main__':
    unittest.main()
