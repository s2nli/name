// Codexstudys API on Cloudflare Workers.
// Static files (index.html, app.js, data/...) are served by Workers Assets; only /api/* runs this code.

const SAFE = /^[A-Za-z0-9._-]+$/;
const CORS = { "Access-Control-Allow-Origin": "*" };

function json(data, status = 200, cache = "public, max-age=300") {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": status === 200 ? cache : "no-store", ...CORS },
  });
}

// Read a prepared file from /data. Returns parsed JSON, or null when missing.
async function readData(env, request, path) {
  const url = new URL(request.url);
  url.pathname = "/data/" + path;
  url.search = "";
  const res = await env.ASSETS.fetch(new Request(url.toString(), { method: "GET" }));
  if (!res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

// Only plain id-like values may become part of a file path.
const seg = (value) => (typeof value === "string" && SAFE.test(value) && value !== "." && value !== ".." ? value : null);

async function handleApi(request, env) {
  const url = new URL(request.url);
  const q = url.searchParams;
  // Multi-exam: NEET lives in /data (original layout); every other exam lives in /data/exams/<id>/.
  const examId = seg(q.get("exam") || "");
  const prefix = examId && examId !== "neet" ? `exams/${examId}/` : "";
  const readExam = (p) => readData(env, request, prefix + p);
  const path = url.pathname.replace(/\/+$/, "");
  const get = (name) => q.get(name) || "";

  switch (path) {
    case "/api/exams":
      return json((await readData(env, request, "exam-list.json")) || { exams: [] }, 200, "public, max-age=60");
    case "/api/batches": {
      const batches = (await readExam("batches.json")) || [];
      if (q.get("includeTests")) return json({ batches, tests: (await readExam("catalog.json")) || [] });
      return json({ batches });
    }
    case "/api/tests": {
      const b = seg(get("batch"));
      return json((b && (await readExam(`tests-list/${b}.json`))) || { tests: [] });
    }
    case "/api/test": {
      const b = seg(get("batch")), t = seg(get("test"));
      const data = b && t ? await readExam(`test/${b}/${t}.json`) : null;
      return data ? json(data, 200, "public, max-age=3600") : json({ error: "Not found" }, 404);
    }
    case "/api/pdfs/batches": return json({ batches: [] });
    case "/api/pdfs/tests": return json({ tests: [] });
    case "/api/pyq/subjects":
      return json((await readExam("pyq/subjects.json")) || { subjects: [] });
    case "/api/pyq/chapters": {
      const s = seg(get("subject"));
      return json((s && (await readExam(`pyq/chapters/${s}.json`))) || { chapters: [] });
    }
    case "/api/pyq/questions": {
      const s = seg(get("subject")), c = seg(get("chapter"));
      return json((s && c && (await readExam(`pyq/q/${s}/${c}.json`))) || { questions: [] }, 200, "public, max-age=3600");
    }
    case "/api/revision-subjects":
      return json((await readExam("rev/subjects.json")) || { subjects: [] });
    case "/api/revision-chapters": {
      const s = seg(get("subject"));
      return json((s && (await readExam(`rev/chapters/${s}.json`))) || { chapters: [] });
    }
    case "/api/revision-chapter": {
      const c = seg(get("chapter"));
      return json((c && (await readExam(`rev/chapter/${c}.json`))) || { materials: [] }, 200, "public, max-age=3600");
    }
    case "/api/pyq/asset":
    case "/api/revision-media": {
      // Optional: set PYQ_ASSET_BASE / REVISION_MEDIA_BASE (a URL ending with "/") in the Worker's variables
      // to serve these images from elsewhere (R2 public bucket, CDN...). Otherwise they are not available.
      const base = path === "/api/pyq/asset" ? env.PYQ_ASSET_BASE : env.REVISION_MEDIA_BASE;
      const file = seg(get("file"));
      if (base && file) return Response.redirect(base + encodeURIComponent(file), 302);
      return json({ error: "asset not found" }, 404);
    }
    default:
      return json({ error: "Unknown endpoint" }, 404);
  }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "*" } });
    }
    if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "Method not allowed" }, 405);
    try {
      return await handleApi(request, env);
    } catch (err) {
      return json({ error: String((err && err.message) || err) }, 500);
    }
  },
};
