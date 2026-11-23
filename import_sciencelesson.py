"""Import the ScienceLesson mock-test pages (saved HTML) into Codexstudys' data format.
Usage: python import_sciencelesson.py <path-to-extracted-sciencelesson_src>
NEET tests -> data/ (batches.json, tests-list/, test/, catalog.json); JEE sets -> data/exams/jee/.
Safe to re-run: it replaces its own batches (ids starting with "sl-") and leaves all others alone."""
import json, os, re, shutil, sys
from bs4 import BeautifulSoup

SRC = sys.argv[1] if len(sys.argv) > 1 else "sciencelesson_src"
SOURCE = "ScienceLesson.in"

def clean(s):
    # textValue() in app.js turns \n, \r, \t, \u ... into control chars; HTML-encode LaTeX backslashes so they survive.
    s = re.sub(r"\\(?![()\[\]])", "&#92;", s)
    return s.strip()

def inner(el):
    return clean(el.decode_contents()) if el else ""

def fix_images(html, images):
    def sub(m):
        src = m.group(2)
        if src.startswith("data:"): return m.group(0)
        name = os.path.basename(src.split("?")[0])
        local = os.path.join(SRC, "questionImages", "chemistry", name)
        if not os.path.exists(local):
            for root, _, files in os.walk(os.path.join(SRC, "questionImages")):
                if name in files: local = os.path.join(root, name); break
        if os.path.exists(local):
            images["sl-" + name] = local
            return f'{m.group(1)}sl-{name}{m.group(3)}'
        return m.group(0)
    return re.sub(r'(<img[^>]*?src=")([^"]+)(")', sub, html)

def parse_test(path, subject_default, topic, images):
    soup = BeautifulSoup(open(path, encoding="utf-8", errors="ignore").read(), "lxml")
    form = soup.find(id="testForm") or soup
    subject, out = subject_default, []
    for el in form.find_all(["section", "div"], recursive=True):
        cls = el.get("class") or []
        if el.name == "section" and "questionSection" in cls:
            h = el.find("h2"); subject = h.get_text(strip=True) if h else subject
        elif el.name == "div" and cls == ["question"]:
            legacy = el.select_one(".qWrite") is not None   # older page template (practice "set-N" pages)
            if legacy:
                q = inner(el.select_one(".qWrite"))
                opts = [inner(o) for o in el.select(".optWrite")]
                m = re.search(r"Option\s*([A-E])", (el.select_one(".correctAns") or el).get_text(" ", strip=True))
                idx = "ABCDE".index(m.group(1)) if m else -1
            else:
                q = inner(el.select_one(".writeQuestion"))
                opts = [inner(o) for o in el.select(".options > .option")]
                ans = el.select_one(".ans")
                try: idx = int(ans.get_text(strip=True)) - 1
                except Exception: continue
            if not q or len(opts) < 2 or not 0 <= idx < len(opts): continue
            n = len(out) + 1
            out.append({
                "id": f"q{n}", "sequence": n, "subject_name": subject, "topic": topic, "marks": "+4",
                "content": {"answer": f"[{idx}]", "qns_content": {"text": f"<div>{fix_images(q, images)}</div>"},
                            "options": [{"text": f"<div>{fix_images(o, images)}</div>"} for o in opts]},
                "solution": {"text_solutions": ([f"<div>{fix_images(inner(el.select_one('.explanation')), images)}</div>"] if el.select_one(".explanation") else [])},
            })
    return out

def chapter_title(folder, path):
    t = BeautifulSoup(open(path, encoding="utf-8", errors="ignore").read(), "lxml").find("h1")
    m = re.match(r"(.+?)\s+Chapter-?Wise Test", t.get_text(strip=True), re.I) if t else None
    return m.group(1).strip() if m else folder.replace("-", " ")

def natural(f): return [int(x) if x.isdigit() else x for x in re.split(r"(\d+)", f)]

def write_batch(root, batch, tests_out, group, order):
    bid = batch["id"]
    os.makedirs(f"{root}/test/{bid}", exist_ok=True); os.makedirs(f"{root}/tests-list", exist_ok=True)
    listing = []
    for slug, name, questions in tests_out:
        json.dump({"test": {"name": name}, "questions": questions}, open(f"{root}/test/{bid}/{slug}.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        listing.append({"batchId": bid, "slug": slug, "name": name, "questionCount": len(questions)})
    json.dump({"tests": listing}, open(f"{root}/tests-list/{bid}.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    return {"id": bid, "name": batch["name"], "testCount": len(listing), "group": group, "source": SOURCE, "order": order}, listing

def merge(root, entries, listings):
    bp, cp = f"{root}/batches.json", f"{root}/catalog.json"
    batches = [b for b in (json.load(open(bp, encoding="utf-8")) if os.path.exists(bp) else []) if (not b["id"].startswith("sl-") or b["id"].startswith("sl-np-"))]
    catalog = [c for c in (json.load(open(cp, encoding="utf-8")) if os.path.exists(cp) else []) if (not c["batchId"].startswith("sl-") or c["batchId"].startswith("sl-np-"))]
    json.dump(batches + entries, open(bp, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    json.dump(catalog + listings, open(cp, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

def folder_tests(folder, subject, topic_fn, name_fn, images, pat=r"(test|set)-(\d+)\.html"):
    files = sorted((f for f in os.listdir(folder) if re.fullmatch(pat, f)), key=natural)
    res = []
    for f in files:
        qs = parse_test(os.path.join(folder, f), subject, topic_fn(f), images)
        if qs: res.append((os.path.splitext(f)[0], name_fn(f), qs))
    return res

images, neet_e, neet_l, jee_e, jee_l = {}, [], [], [], []
for root in ("data/test",):
    for d in os.listdir(root) if os.path.isdir(root) else []:
        if d.startswith("sl-") and not d.startswith("sl-np-"): shutil.rmtree(f"{root}/{d}")
NEET = os.path.join(SRC, "NEET-Mock-Test")

# 1) Full-length mocks
t = folder_tests(os.path.join(NEET, "full-length"), "Physics", lambda f: "", lambda f: "Full-Length Mock Test " + re.search(r"\d+", f).group(), images)
e, l = write_batch("data", {"id": "sl-full-length", "name": "Full-Length Mocks (180 Q)"}, t, "Full-Length Mocks", 10); neet_e.append(e); neet_l += l

# 2) Chapter-wise (one folder/batch per chapter, grouped by subject)
for key, label, order in (("physics", "Physics", 20), ("chemistry", "Chemistry", 30), ("biology", "Biology", 40)):
    base = os.path.join(NEET, f"{key}-chapter-wise-question")
    for chap in sorted(os.listdir(base)):
        folder = os.path.join(base, chap)
        if not os.path.isdir(folder): continue
        first = next((f for f in sorted(os.listdir(folder), key=natural) if re.fullmatch(r"test-\d+\.html", f)), None)
        if not first: continue
        title = chapter_title(chap, os.path.join(folder, first))
        t = folder_tests(folder, label, lambda f: title, lambda f: f"{title} - Test " + re.search(r"\d+", f).group(), images, r"test-(\d+)\.html")
        if not t: continue
        e, l = write_batch("data", {"id": f"sl-{key[:4]}-{chap.lower()}"[:90], "name": title}, t, f"{label} Chapter-wise", order)
        neet_e.append(e); neet_l += l

# 3) NEET chemistry practice sets
t = folder_tests(os.path.join(NEET, "chemistry"), "Chemistry", lambda f: "Chemistry", lambda f: "Chemistry Practice Set " + re.search(r"\d+", f).group(), images, r"set-(\d+)\.html")
if t:
    e, l = write_batch("data", {"id": "sl-chem-sets", "name": "Chemistry Practice Sets"}, t, "Chemistry Chapter-wise", 30); neet_e.append(e); neet_l += l
merge("data", neet_e, neet_l)

# 4) JEE sets -> JEE exam
JEE = os.path.join(SRC, "JEE-Mock-Test"); jroot = "data/exams/jee"
if os.path.isdir(f"{jroot}/test"):
    for d in os.listdir(f"{jroot}/test"):
        if d.startswith("sl-") and not d.startswith("sl-np-"): shutil.rmtree(f"{jroot}/test/{d}")
for key, label in (("physics", "Physics"), ("chemistry", "Chemistry")):
    folder = os.path.join(JEE, key)
    if not os.path.isdir(folder): continue
    t = folder_tests(folder, label, lambda f: label, lambda f: f"JEE {label} Set " + re.search(r"\d+", f).group(), images, r"set-(\d+)\.html")
    if t:
        e, l = write_batch(jroot, {"id": f"sl-jee-{key}", "name": f"JEE {label} Practice Sets"}, t, "Practice Sets", 10); jee_e.append(e); jee_l += l
if jee_e: merge(jroot, jee_e, jee_l)

os.makedirs("images", exist_ok=True)
for name, src in images.items(): shutil.copy(src, os.path.join("images", name))
nq = sum(x["questionCount"] for x in neet_l); print(f"NEET: {len(neet_e)} batches, {len(neet_l)} tests, {nq} questions | JEE: {len(jee_e)} batches, {len(jee_l)} tests, {sum(x['questionCount'] for x in jee_l)} questions | images: {len(images)}")
