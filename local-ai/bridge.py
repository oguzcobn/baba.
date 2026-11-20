"""BABA. local AI companion. Python 3.10+, standard library only.

Only installed, explicitly configured third-party engines are executed. This
service binds to loopback, authenticates all requests, and never downloads or
installs programs on behalf of a website.
"""
from __future__ import annotations

import json
import mimetypes
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import threading
import time
from urllib.parse import parse_qs, urlparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parent
CONFIG_PATH = Path(os.environ.get('BABA_AI_CONFIG', str(ROOT / 'config.json'))).expanduser()
if CONFIG_PATH.is_file():
    CONFIG = json.loads(CONFIG_PATH.read_text(encoding='utf-8'))
else:
    CONFIG = {}
OUTPUT_ROOT = Path(CONFIG.get('output_root', str(ROOT / 'runs'))).expanduser().resolve()
OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
TOKEN = os.environ.get('BABA_AI_TOKEN') or CONFIG.get('token') or secrets.token_urlsafe(30)
ORIGINS = frozenset({
    'https://oguzcobn.github.io',
    'http://127.0.0.1:4173', 'http://localhost:4173',
    'http://127.0.0.1:8000', 'http://localhost:8000',
})
JOBS: dict[str, dict] = {}
LOCK = threading.Lock()
WORKER = threading.BoundedSemaphore(value=1)
MAX_UPLOAD = 512 * 1024 * 1024
TOOL_NAMES = ('voice', 'image', 'transcribe', 'video', 'dub', 'remote')
EXTENSIONS = {
    'transcribe': frozenset({'.mp3', '.wav', '.flac', '.ogg', '.m4a', '.mp4', '.webm'}),
    'dub': frozenset({'.mp4', '.mov', '.mkv', '.webm'}),
}


def _paths(name: str) -> tuple[Path, Path]:
    options = CONFIG.get(name, {})
    base = Path(options.get('root', '')).expanduser()
    if not options.get('root') or not base.is_dir():
        raise ValueError(f'{name}: repository directory not configured or not found')
    base = base.resolve()
    if name == 'dub':
        default = base / '.venv' / 'Scripts' / 'dubla.exe'
        if os.name != 'nt':
            default = base / '.venv' / 'bin' / 'dubla'
    else:
        default = base / '.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    executable = Path(options.get('executable', str(default))).expanduser().resolve()
    if not executable.is_file():
        raise ValueError(f'{name}: installed executable not found: {executable}')
    return base, executable


def _available(name: str) -> bool:
    try:
        if name == 'remote':
            exe = Path(CONFIG.get('remote', {}).get('rustdesk_executable', '')).expanduser()
            return bool(str(exe) not in ('', '.') and exe.is_file())
        root, exe = _paths(name)
        if name == 'video':
            options = CONFIG.get('video', {})
            if not Path(options.get('models_dir', '')).is_dir() or not Path(options.get('sd_cli', '')).is_file():
                return False
        if name == 'image' and not (root / 'scripts' / 'generate.py').is_file():
            return False
        return True
    except ValueError:
        return False


def _safe_language(language: str) -> str:
    if not re.fullmatch(r'[a-z]{2,3}(?:-[a-z]{2})?|auto', language):
        raise ValueError('Invalid language code')
    return language


def _command(job: dict) -> tuple[list[str], Path]:
    name, directory = job['tool'], Path(job['directory'])
    root, exe = _paths(name)
    out = directory / 'outputs'
    out.mkdir(exist_ok=True)
    language = _safe_language(job.get('language') or 'tr')
    if name in ('voice', 'image', 'video'):
        prompt = (job.get('text') or '').strip()
        if not 1 <= len(prompt) <= 4000:
            raise ValueError('Text or prompt must be 1–4000 characters')
        input_file = directory / 'text.txt'
        input_file.write_text(prompt, encoding='utf-8')
    if name == 'voice':
        voice = job.get('voice') or 'hazir/belgesel_hanim'
        if not re.fullmatch(r'[a-zA-Z0-9_-]+(?:/[a-zA-Z0-9_-]+)?', voice):
            raise ValueError('Invalid voice id')
        return [str(exe), '-m', 'ses_tasarim.oku', '--ses', voice,
                '--metin', '@' + str(input_file), '--cikti', str(out)], root
    if name == 'image':
        return [str(exe), 'scripts/generate.py', '--prompt-file', str(input_file),
                '--out', str(out)], root
    if name == 'video':
        options = CONFIG.get('video', {})
        return [str(exe), 'scripts/generate.py', '--prompt-file', str(input_file),
                '--models-dir', str(Path(options['models_dir']).expanduser().resolve()),
                '--sd-cli', str(Path(options['sd_cli']).expanduser().resolve()),
                '--frames', str(job.get('frames', 49)), '--out-dir', str(out)], root
    source = directory / 'input' / job['filename']
    if name == 'transcribe':
        return [str(exe), '-m', 'transkript', str(source), '--dil', language,
                '--cikti', str(out)], root
    if name == 'dub':
        return [str(exe), str(source), '--ayar', 'genel.hedef_dil=' + language,
                '--ayar', 'genel.cikti_klasoru=' + str(out)], root
    raise ValueError('Unknown tool')


def _files(job: dict) -> list[dict]:
    target = Path(job['directory']) / 'outputs'
    if not target.is_dir():
        return []
    entries = []
    for file in sorted(target.rglob('*')):
        if file.is_file() and file.stat().st_size <= MAX_UPLOAD:
            rel = file.relative_to(target).as_posix()
            entries.append({'name': rel, 'bytes': file.stat().st_size})
    return entries[:80]


def _run(job_id: str) -> None:
    job = JOBS[job_id]
    with WORKER:
        job['state'] = 'running'
        job['started'] = time.time()
        try:
            command, cwd = _command(job)
            with (Path(job['directory']) / 'process.log').open('w', encoding='utf-8', errors='replace') as logs:
                result = subprocess.run(command, cwd=str(cwd), stdout=logs,
                                        stderr=subprocess.STDOUT, timeout=4 * 60 * 60, check=False)
            if result.returncode:
                raise RuntimeError(f'Engine exit code {result.returncode}. Check the local process log.')
            job['files'] = _files(job)
            job['state'] = 'completed'
        except (ValueError, OSError, RuntimeError, subprocess.TimeoutExpired, KeyError) as exc:
            job['state'] = 'failed'
            job['error'] = str(exc)[:400]
        finally:
            job['finished'] = time.time()


class Handler(BaseHTTPRequestHandler):
    server_version = 'BabaLocalAI/0.1'
    def log_message(self, fmt: str, *args) -> None:
        print('%s %s' % (self.address_string(), fmt % args))

    def _cors(self):
        origin = self.headers.get('Origin', '')
        if origin in ORIGINS:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
        self.send_header('Access-Control-Allow-Headers', 'X-Baba-Token, Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')

    def _json(self, code: int, data: dict) -> None:
        encoded = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self._cors()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def _authorized(self) -> bool:
        origin = self.headers.get('Origin', '')
        if origin and origin not in ORIGINS:
            self._json(403, {'error': 'Origin is not allowed'})
            return False
        if not secrets.compare_digest(self.headers.get('X-Baba-Token', ''), TOKEN):
            self._json(401, {'error': 'Enter the local bridge token shown in your terminal'})
            return False
        return True

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        if not self._authorized():
            return
        parsed = urlparse(self.path)
        parts = parsed.path.strip('/').split('/')
        if parsed.path == '/status':
            self._json(200, {'connected': True, 'models': {k: _available(k) for k in TOOL_NAMES}})
            return
        if len(parts) >= 2 and parts[0] == 'jobs' and parts[1] in JOBS:
            job = JOBS[parts[1]]
            if len(parts) == 2:
                logfile = Path(job['directory']) / 'process.log'
                tail = logfile.read_text(encoding='utf-8', errors='replace')[-1800:] if logfile.exists() else ''
                self._json(200, {k: job.get(k) for k in ('id','tool','state','error','started','finished')}
                           | {'files': _files(job), 'log': tail})
                return
            if len(parts) == 3 and parts[2] == 'download':
                args = parse_qs(parsed.query)
                relative = args.get('name', [''])[0]
                target_dir = (Path(job['directory']) / 'outputs').resolve()
                file = (target_dir / relative).resolve()
                if not file.is_file() or not file.is_relative_to(target_dir):
                    self._json(404, {'error': 'File does not exist'})
                    return
                kind = mimetypes.guess_type(file.name)[0] or 'application/octet-stream'
                self.send_response(200)
                self._cors()
                self.send_header('Content-Type', kind)
                self.send_header('Content-Length', str(file.stat().st_size))
                self.send_header('Content-Disposition', 'attachment; filename="' + file.name.replace('"', '') + '"')
                self.end_headers()
                with file.open('rb') as f:
                    while chunk := f.read(256 * 1024):
                        self.wfile.write(chunk)
                return
        self._json(404, {'error': 'Unknown endpoint'})

    def do_POST(self) -> None:
        if not self._authorized():
            return
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        if parsed.path == '/remote/open':
            if not _available('remote'):
                self._json(409, {'error': 'RustDesk is not installed or configured'})
                return
            executable = Path(CONFIG['remote']['rustdesk_executable']).expanduser().resolve()
            subprocess.Popen([str(executable)], cwd=str(executable.parent))
            self._json(200, {'opened': True})
            return
        if parsed.path not in ('/jobs', '/upload'):
            self._json(404, {'error': 'Unknown endpoint'})
            return
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if size <= 0 or size > MAX_UPLOAD:
                raise ValueError('Invalid upload size')
            if parsed.path == '/jobs':
                if size > 16 * 1024:
                    raise ValueError('JSON request too long')
                data = json.loads(self.rfile.read(size).decode('utf-8'))
                name = data.get('tool', '')
                if name not in ('voice','image','video'):
                    raise ValueError('Invalid text-generation tool')
            else:
                name = query.get('tool', [''])[0]
                if name not in ('transcribe','dub'):
                    raise ValueError('Invalid upload tool')
                filename = Path(query.get('filename', [''])[0].replace('\\','/')).name
                if not filename or len(filename) > 130 or Path(filename).suffix.lower() not in EXTENSIONS[name]:
                    raise ValueError('Unsupported media filename or extension')
                data = {'tool': name, 'filename': filename,
                        'language': query.get('language', ['tr'])[0]}
            if not _available(name):
                self._json(409, {'error': name + ' is not installed/configured on this computer'})
                return
            if name == 'video' and data.get('frames', 49) not in (49,121):
                raise ValueError('Choose 49 or 121 frames')
            _safe_language(data.get('language') or 'tr')
            job_id = secrets.token_hex(12)
            folder = OUTPUT_ROOT / job_id
            folder.mkdir(parents=True)
            if parsed.path == '/upload':
                input_dir = folder / 'input'
                input_dir.mkdir()
                remaining = size
                with (input_dir / filename).open('wb') as dst:
                    while remaining > 0:
                        piece = self.rfile.read(min(256 * 1024, remaining))
                        if not piece:
                            raise ValueError('Incomplete upload')
                        dst.write(piece)
                        remaining -= len(piece)
            job = {'id':job_id, 'tool':name, 'directory':str(folder), 'state':'queued',
                   'started':None, 'finished':None, 'error':None}
            for key in ('text','voice','language','frames','filename'):
                if key in data: job[key] = data[key]
            with LOCK:
                JOBS[job_id] = job
            threading.Thread(target=_run, args=(job_id,), daemon=True).start()
            self._json(202, {'id':job_id, 'state':'queued'})
        except (ValueError, UnicodeError, json.JSONDecodeError, OSError) as exc:
            self._json(400, {'error':str(exc)[:300]})


def main() -> None:
    print('BABA. Local AI companion: http://127.0.0.1:8767')
    print('Bridge access token (paste into BABA. LAB):', TOKEN)
    print('Only loopback connections accepted; configure installed engines in', CONFIG_PATH)
    ThreadingHTTPServer(('127.0.0.1', 8767), Handler).serve_forever()


if __name__ == '__main__':
    main()