"""Add a new exam.   python add_exam.py <id> "<Name>" "<Full name>" "<emoji>" "<#color>" "<description>" [YYYY-MM-DD]
Example: python add_exam.py upsc "UPSC" "UPSC Civil Services" "🏛️" "#0ea5e9" "Prelims + Mains practice" 2027-05-24
Creates data/exams/<id>/ (same layout as NEET's data/) and adds the card to data/exam-list.json."""
import json, os, re, sys

if len(sys.argv) < 6:
    sys.exit(__doc__)
eid, name, full, icon, color = sys.argv[1:6]
desc = sys.argv[6] if len(sys.argv) > 6 else ""
date = sys.argv[7] if len(sys.argv) > 7 else ""
assert re.fullmatch(r"[a-z0-9-]+", eid), "id may only contain a-z, 0-9 and -"

path = "data/exam-list.json"
data = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {"exams": []}
if any(e["id"] == eid for e in data["exams"]):
    sys.exit(f"'{eid}' already exists")
data["exams"].append({"id": eid, "name": name, "full": full, "icon": icon, "color": color, "desc": desc, "examDate": date, "status": "soon"})
json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

base = f"data/exams/{eid}"
for sub in ("tests-list", "test", "pyq/chapters", "pyq/q", "rev/chapters", "rev/chapter"):
    os.makedirs(f"{base}/{sub}", exist_ok=True)
for f, v in (("batches.json", "[]"), ("catalog.json", "[]")):
    if not os.path.exists(f"{base}/{f}"): open(f"{base}/{f}", "w").write(v)
print(f"Done. Put the content in {base}/ and set its status to \"live\" in data/exam-list.json when ready.")
