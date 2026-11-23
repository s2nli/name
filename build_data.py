"""Split api_data/*.json into many small files under data/ (Cloudflare limit: 25 MiB per file).
Run:  python build_data.py   (needs api_data/ next to it; api_data is NOT uploaded to Cloudflare)."""
import json, os, re, shutil, sys

SAFE = re.compile(r"^[A-Za-z0-9._-]+$")
SRC, OUT = "api_data", "data"
bad = []

def safe(v):
    v = str(v)
    if not SAFE.match(v) or v in (".", ".."):
        bad.append(v)
    return v

def dump(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))

def load(name):
    with open(os.path.join(SRC, name), encoding="utf-8") as f:
        return json.load(f)

# This script only rebuilds NEET (the files directly in data/). Keep the other exams and the exam list.
KEEP = ["exams", "exam-list.json"]
_stash = ".keep_exams"
if os.path.isdir(OUT):
    os.makedirs(_stash, exist_ok=True)
    for k in KEEP:
        if os.path.exists(os.path.join(OUT, k)):
            shutil.move(os.path.join(OUT, k), os.path.join(_stash, k))
    shutil.rmtree(OUT)
    os.makedirs(OUT)
    for k in KEEP:
        if os.path.exists(os.path.join(_stash, k)):
            shutil.move(os.path.join(_stash, k), os.path.join(OUT, k))
    shutil.rmtree(_stash)

batches = load("batches.json")
catalog = load("tests_catalog.json")
# Some tests share a slug (names differ only by punctuation). Give later ones a unique slug so each can be opened.
final = {}   # (batchId, test_name) -> slug
for b in batches:
    bid = safe(b["id"])
    seen = set()
    for t in load(f"tests_{b['id']}.json"):
        slug = t["slug"]; n = 2
        while slug in seen:
            slug = f"{t['slug']}-{n}"; n += 1
        seen.add(slug)
        assert (b["id"], t["test_name"]) not in final, f"duplicate name {t['test_name']}"
        final[(b["id"], t["test_name"])] = slug
for c in catalog:
    c["slug"] = final[(c["batchId"], c["name"])]
dump(f"{OUT}/batches.json", batches)
dump(f"{OUT}/catalog.json", catalog)

for b in batches:
    bid = safe(b["id"])
    dump(f"{OUT}/tests-list/{bid}.json", {"tests": [t for t in catalog if t["batchId"] == b["id"]]})
    for t in load(f"tests_{b['id']}.json"):
        slug = safe(final[(b["id"], t["test_name"])])
        dump(f"{OUT}/test/{bid}/{slug}.json", {"test": {"name": t["test_name"]}, "questions": t["questions"]})

pyq = load("pyq.json")
dump(f"{OUT}/pyq/subjects.json", {"subjects": [s["subject"] for s in pyq]})
for s in pyq:
    sid = safe(s["subject"]["id"])
    dump(f"{OUT}/pyq/chapters/{sid}.json", {"chapters": [{k: v for k, v in c.items() if k != "questions"} for c in s["chapters"]]})
    for c in s["chapters"]:
        cid = safe(c["id"])
        meta = {k: v for k, v in c.items() if k != "questions"}
        dump(f"{OUT}/pyq/q/{sid}/{cid}.json", {"questions": c.get("questions", []), "subject": s["subject"], "chapter": meta})

rev = load("revision.json")
dump(f"{OUT}/rev/subjects.json", {"subjects": [s["subject"] for s in rev]})
for s in rev:
    sid = safe(s["subject"]["id"])
    dump(f"{OUT}/rev/chapters/{sid}.json", {"chapters": [c["chapter"] for c in s["chapters"]]})
    for c in s["chapters"]:
        dump(f"{OUT}/rev/chapter/{safe(c['chapter']['id'])}.json", c)

if bad:
    sys.exit("Unsafe ids: " + ", ".join(sorted(set(bad))[:10]))
n = size = biggest = 0
for r, _, fs in os.walk(OUT):
    for f in fs:
        s = os.path.getsize(os.path.join(r, f)); n += 1; size += s; biggest = max(biggest, s)
print(f"{n} files, {size/1048576:.1f} MB total, biggest {biggest/1048576:.2f} MB")
assert biggest < 24 * 1048576, "a file is over Cloudflare's 25 MiB limit"
