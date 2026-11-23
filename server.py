"""Local server (same data and routes as the Cloudflare Worker).  Run:  python server.py  ->  http://localhost:8000"""
import http.server, socketserver, os, json, re
from urllib.parse import urlparse, parse_qs

PORT = 8000
ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)
SAFE = re.compile(r"^[A-Za-z0-9._-]+$")

def seg(v):
    return v if v and SAFE.match(v) and v not in (".", "..") else None

def read(path):
    try:
        with open(os.path.join("data", path), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        p = urlparse(self.path)
        if p.path.startswith("/api/"):
            return self.api(p.path.rstrip("/"), parse_qs(p.query))
        super().do_GET()

    def api(self, path, q):
        g = lambda k: q.get(k, [""])[0]
        ex = seg(g("exam"))
        pre = f"exams/{ex}/" if ex and ex != "neet" else ""
        rdx = lambda p: read(pre + p)
        try:
            if path == "/api/exams": return self.send_json(read("exam-list.json") or {"exams": []})
            if path == "/api/batches":
                b = rdx("batches.json") or []
                return self.send_json({"batches": b, "tests": rdx("catalog.json") or []} if g("includeTests") else {"batches": b})
            if path == "/api/tests":
                b = seg(g("batch")); return self.send_json((b and rdx(f"tests-list/{b}.json")) or {"tests": []})
            if path == "/api/test":
                b, t = seg(g("batch")), seg(g("test"))
                d = rdx(f"test/{b}/{t}.json") if b and t else None
                return self.send_json(d, 200) if d else self.send_json({"error": "Not found"}, 404)
            if path == "/api/pdfs/batches": return self.send_json({"batches": []})
            if path == "/api/pdfs/tests": return self.send_json({"tests": []})
            if path == "/api/pyq/subjects": return self.send_json(rdx("pyq/subjects.json") or {"subjects": []})
            if path == "/api/pyq/chapters":
                s = seg(g("subject")); return self.send_json((s and rdx(f"pyq/chapters/{s}.json")) or {"chapters": []})
            if path == "/api/pyq/questions":
                s, c = seg(g("subject")), seg(g("chapter"))
                return self.send_json((s and c and rdx(f"pyq/q/{s}/{c}.json")) or {"questions": []})
            if path == "/api/revision-subjects": return self.send_json(rdx("rev/subjects.json") or {"subjects": []})
            if path == "/api/revision-chapters":
                s = seg(g("subject")); return self.send_json((s and rdx(f"rev/chapters/{s}.json")) or {"chapters": []})
            if path == "/api/revision-chapter":
                c = seg(g("chapter")); return self.send_json((c and rdx(f"rev/chapter/{c}.json")) or {"materials": []})
            if path in ("/api/pyq/asset", "/api/revision-media"):
                folder = "pyq_assets" if path == "/api/pyq/asset" else "revision_media"
                name = seg(g("file"))
                full = os.path.join(folder, name) if name else ""
                if name and os.path.isfile(full):
                    ext = name.rsplit(".", 1)[-1].lower()
                    ctype = {"webp": "image/webp", "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "gif": "image/gif", "mp4": "video/mp4"}.get(ext, "application/octet-stream")
                    body = open(full, "rb").rdx()
                    self.send_response(200); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
                    return
                return self.send_json({"error": "asset not found"}, 404)
            self.send_json({"error": "Unknown endpoint"}, 404)
        except Exception as e:
            self.send_json({"error": str(e)}, 500)

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

socketserver.ThreadingTCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(("", PORT), Handler) as httpd:
    print(f"Server started at http://localhost:{PORT}")
    httpd.serve_forever()
