"""Bounded synchronous screening endpoint for Vercel's Python runtime."""
import json
import math
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))


class handler(BaseHTTPRequestHandler):
    def respond(self, status, payload):
        body = json.dumps(payload, allow_nan=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0 or length > 4096:
                return self.respond(400, {'detail': 'Expected a small JSON coordinate request.'})
            body = json.loads(self.rfile.read(length))
            latitude, longitude = body['latitude'], body['longitude']
            if any(isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x) for x in (latitude, longitude)):
                raise ValueError('Invalid coordinates')
            if not (21.5 <= latitude <= 29.8 and 88 <= longitude <= 97.5):
                raise ValueError('Coordinates outside Northeast India')
        except (ValueError, TypeError, KeyError):
            return self.respond(400, {'detail': 'Provide valid Northeast India latitude and longitude.'})
        try:
            from sentinel_runtime.pipeline import run
            return self.respond(200, run(latitude, longitude))
        except Exception:
            import logging
            logging.exception('Sentinel runtime failed')
            return self.respond(503, {'detail': 'Sentinel model runtime unavailable. Please retry shortly.'})

    def do_GET(self):
        self.respond(405, {'detail': 'Use POST with latitude and longitude.'})
