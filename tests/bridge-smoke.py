"""Smoke checks for authenticated local AI bridge (no model installation required)."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

REPO = Path(__file__).resolve().parents[1]
URL = 'http://127.0.0.1:8767'


class BridgeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.workspace = tempfile.TemporaryDirectory()
        env = dict(os.environ)
        env['BABA_AI_TOKEN'] = 'baba-smoke-test-only'
        env['BABA_AI_CONFIG'] = str(Path(cls.workspace.name) / 'not-installed.json')
        cls.process = subprocess.Popen(
            [sys.executable, str(REPO / 'local-ai/bridge.py')],
            cwd=str(REPO), env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        for _ in range(40):
            try:
                urlopen(URL + '/status', timeout=1)
            except HTTPError as exc:
                if exc.code == 401:
                    break
            except URLError:
                time.sleep(.15)
        else:
            cls.process.terminate()
            raise RuntimeError('Bridge did not start')

    @classmethod
    def tearDownClass(cls):
        cls.process.terminate()
        cls.process.wait(timeout=6)
        cls.workspace.cleanup()

    def _get(self, endpoint, token='baba-smoke-test-only'):
        req = Request(URL + endpoint, headers={'X-Baba-Token': token, 'Origin': 'https://oguzcobn.github.io'})
        return urlopen(req, timeout=3)

    def test_status_models_and_cors(self):
        with self._get('/status') as f:
            status = json.load(f)
            self.assertEqual(f.headers['Access-Control-Allow-Origin'], 'https://oguzcobn.github.io')
        self.assertTrue(status['connected'])
        self.assertEqual(set(status['models']), {'voice', 'image', 'video', 'transcribe', 'dub', 'remote'})
        self.assertFalse(any(status['models'].values()), 'Non-installed models should not be enabled')

    def test_bad_token_is_rejected(self):
        with self.assertRaises(HTTPError) as caught:
            self._get('/status', 'bad-token')
        self.assertEqual(caught.exception.code, 401)

    def test_text_job_rejects_missing_engine(self):
        body = b'{"tool":"image","text":"A house"}'
        req = Request(URL + '/jobs', headers={'X-Baba-Token': 'baba-smoke-test-only',
                        'Content-Type': 'application/json'}, data=body, method='POST')
        with self.assertRaises(HTTPError) as caught:
            urlopen(req, timeout=3)
        self.assertEqual(caught.exception.code, 409)


if __name__ == '__main__':
    unittest.main()