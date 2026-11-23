# Codexstudys (multi-exam)

The home page shows a card for every exam (NEET, JEE, CUET, SSC). Opening a card shows that exam's content: full-length tests, chapter tests, PYQ and revision notes.

Works in two ways with the same data (`data/`):

* **Cloudflare Workers** - `wrangler.toml` + `src/worker.js` (the `/api/*` routes). Everything else is served as static files.
  The Worker name in `wrangler.toml` must match your Worker's name in the Cloudflare dashboard.
* **Locally** - `python server.py` then open http://localhost:8000

## Exams

* `data/exam-list.json` - cards on the home page (name, icon, color, description, examDate, `status`: `live` / `soon`).
* **NEET** content lives directly in `data/`.
* **Other exams** live in `data/exams/<id>/` with the same layout:
  `batches.json`, `catalog.json`, `tests-list/<batch>.json`, `test/<batch>/<test>.json`, `pyq/...`, `rev/...`
* New exam: `python add_exam.py upsc "UPSC" "UPSC Civil Services" "🏛️" "#0ea5e9" "desc" 2027-05-24`
* URLs: `/?exam=jee`, `/?exam=jee&view=tests` (without `exam` the home page opens).

## Look and feel

* Theme modes (Light, Dark, Sandalwood, Forest Emerald, Ocean Deep, Sakura Blossom, Dracula Midnight, Lavender Mist, Cyberpunk Neon, System) via the theme button in the top bar.
* Animation effects (Firecracker, Rain, Snow, Fireball, Hail, Lightning, Storm) via the sparkle button in the top bar.
* Channels: Telegram https://t.me/codexstudys and the Codexstudys WhatsApp channel (set in `config.js` and `index.html`).

## Tests

* Every question is worth 4 marks, so the maximum marks of a test are `questions x 4` (180 questions = 720).
* Chapter tests: choose a subject, then start any chapter test directly.

## NeetPrep chapter tests

Chapter-wise tests built from the NeetPrep question bank (28,842 questions). Each test has 180 questions (4 marks each, 720 marks); a chapter's last test is topped up with random questions from its earlier tests, and chapters with fewer than 180 questions have one shorter test. Slugs are `np-1`, `np-2`...; names read `<Chapter> - NeetPrep Test N`. They are added to the matching ScienceLesson chapter where one exists, otherwise as separate batches with ids starting `sl-np-` (the ScienceLesson import keeps them). Questions have no written solutions.

## Chapter-wise test size

The small ScienceLesson chapter tests (10-15 questions each) are merged (duplicates removed) into 180-question tests: `Chapter - Test 1`, `Test 2`...; the last one is topped up to 180 from the chapter's other questions. Chapters with fewer than 180 unique questions in total keep one shorter test. NeetPrep tests (`np-*`) and the full-length mocks are unchanged.

## ScienceLesson import

`python import_sciencelesson.py <extracted sciencelesson_src folder>` converts the saved ScienceLesson pages into test data:
NEET -> `data/` (batches with ids starting `sl-`: 20 full-length mocks + chapter-wise Physics/Chemistry/Biology tests), JEE sets -> `data/exams/jee/`.
Re-running replaces only the `sl-*` batches. Batches with a `group` field are shown under collapsible headings on the Tests page.
(`build_data.py` rebuilds NEET's original batches only, so run the import again after it.)

Optional: `PYQ_ASSET_BASE` / `REVISION_MEDIA_BASE` (Worker variables, a URL ending with `/`) serve PYQ and revision images from another host.
`build_data.py` rebuilds NEET's `data/` from the original `api_data/` files (not included); it keeps `data/exams/` and `data/exam-list.json`.
