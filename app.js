// Empty apiBase intentionally means same-origin requests handled by api/[...path].js.
const API_BASE = String(window.CBT_CONFIG?.apiBase ?? "").replace(/\/$/, "");
const CONTENT_IMAGE_BASE = "https://d2lbh14zkcqlst.cloudfront.net/content_data/content_images/";
const TELEGRAM_URL = window.CBT_CONFIG?.telegramUrl || "#";
const ADS = window.CBT_CONFIG?.ads || {};
const DEFAULT_TEST_MINUTES = 195;
const SHORT_TEST_MINUTES = 60;
// Bump this whenever the PYQ normaliser changes, so a deployed correction is
// not hidden behind an older CDN-cached question response.
const PYQ_CONTENT_VERSION = "2026-08-21-2";
const DEFAULT_EXAMS = [
  { id: "neet", name: "NEET", full: "NEET UG", icon: "🩺", color: "#5144ed", desc: "Medical entrance: Physics, Chemistry & Biology tests, PYQs and revision notes.", examDate: "2027-05-02", status: "live" },
  { id: "jee", name: "JEE", full: "JEE Main & Advanced", icon: "⚙️", color: "#f08a1c", desc: "Engineering entrance: Physics, Chemistry & Maths tests and PYQs.", examDate: "2027-01-22", status: "live" },
  { id: "cuet", name: "CUET", full: "CUET UG", icon: "🎓", color: "#16a46e", desc: "Central university entrance: domain subjects and General Test.", examDate: "2027-05-15", status: "soon" },
  { id: "ssc", name: "SSC", full: "SSC CGL / CHSL / MTS", icon: "🏛️", color: "#e24b5e", desc: "Govt. jobs: Maths, Reasoning, English and General Awareness.", examDate: "", status: "soon" }
];
const KEYS = { theme: "neet-cbt:theme", history: "neet-cbt:history", pyq: "neet-cbt:pyq" };
const state = {
  exam: "", exams: [],
  view: "home", batches: [], tests: [], allTests: null, selectedBatch: "",
  pdfBatches: [], pdfTests: [], allPdfTests: null, selectedPdfBatch: "", attempt: null,
  noteSubjects: [], noteChapters: [], noteChapter: null, selectedNoteSubject: "", selectedNoteChapter: "", selectedNoteMaterial: "",
  pyqSubjects: [], pyqChapters: [], selectedPyqSubject: "", selectedPyqChapter: "", pyqMode: "", pyqLanguage: "en", pyqSession: null,
  selectedChapterSubject: "", pending: null, reviewFilter: "all",
  theme: localStorage.getItem(KEYS.theme) || "system"
};
const $ = (selector) => document.querySelector(selector);
const view = $("#view");
const escape = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[char]);

function examInfo() { return state.exams.find((item) => item.id === state.exam) || null; }
function examName() { return examInfo()?.name || "NEET"; }
function examPrefix() { return state.exam && state.exam !== "neet" ? `~${state.exam}` : ""; }
function historyKey() { return KEYS.history + examPrefix(); }
function resetExamCaches() {
  Object.assign(state, { batches: [], tests: [], allTests: null, selectedBatch: "", pdfBatches: [], pdfTests: [], allPdfTests: null, selectedPdfBatch: "", attempt: null,
    noteSubjects: [], noteChapters: [], noteChapter: null, selectedNoteSubject: "", selectedNoteChapter: "", selectedNoteMaterial: "",
    pyqSubjects: [], pyqChapters: [], selectedPyqSubject: "", selectedPyqChapter: "", pyqMode: "", pyqSession: null });
}
function setExam(id) {
  if (state.exam !== id) { state.exam = id; resetExamCaches(); }
  const info = examInfo();
  document.documentElement.style.setProperty("--exam-color", info?.color || "#5144ed");
  document.title = info ? `${info.name} · Codexstudys` : "Codexstudys";
}
async function loadExams() {
  try { const data = await fetch(`${API_BASE}/api/exams`).then((response) => response.ok ? response.json() : Promise.reject()); state.exams = Array.isArray(data.exams) && data.exams.length ? data.exams : DEFAULT_EXAMS; }
  catch { state.exams = DEFAULT_EXAMS; }
}
function updateExamChrome() {
  const info = examInfo();
  document.body.classList.toggle("on-home", state.view === "home");
  $("#examSwitchName").textContent = info?.full || "Select exam";
  $("#examSwitchIcon").textContent = info?.icon || "🎯";
}
function examCard(exam) {
  const live = exam.status === "live";
  return `<button class="exam-card" type="button" data-open-exam="${escape(exam.id)}" style="--exam-color:${escape(exam.color || "#5144ed")}"><span class="exam-card-icon">${escape(exam.icon || "📘")}</span><span class="exam-card-badge ${live ? "live" : ""}">${live ? "Live" : "Coming soon"}</span><strong>${escape(exam.name)}</strong><small>${escape(exam.full || "")}</small><p>${escape(exam.desc || "")}</p><span class="exam-card-go">Open ${escape(exam.name)} <b>→</b></span></button>`;
}
function renderHome() {
  view.innerHTML = `<section class="exam-home"><div class="exam-home-head"><span class="eyebrow">Welcome to Codexstudys</span><h1 class="page-title">Choose your exam</h1><p class="sub">Select an exam to open all of its content: tests, PYQs and notes.</p></div><div class="exam-grid">${state.exams.map(examCard).join("")}</div></section>`;
}

function adSlot(location) {
  const client = String(ADS.client || "").trim();
  const slot = String(ADS.slots?.[location] || "").trim();
  // Manual AdSense units require a real numeric ad-slot ID. Never render an
  // empty advertisement shell while the publisher has not created one yet.
  if (!/^ca-pub-\d+$/.test(client) || !/^\d+$/.test(slot)) return "";
  return `<aside class="ad-slot" aria-label="Advertisement"><span>Advertisement</span><ins class="adsbygoogle" style="display:block" data-ad-client="${escape(client)}" data-ad-slot="${escape(slot)}" data-ad-format="auto" data-full-width-responsive="true"></ins></aside>`;
}
function requestAds() {
  requestAnimationFrame(() => {
    if (!Array.isArray(window.adsbygoogle)) return;
    document.querySelectorAll("ins.adsbygoogle:not([data-ad-requested])").forEach((unit) => {
      unit.dataset.adRequested = "true";
      try { window.adsbygoogle.push({}); } catch { unit.removeAttribute("data-ad-requested"); }
    });
  });
}
new MutationObserver(requestAds).observe(view, { childList: true, subtree: true });

function textValue(value) {
  if (value && typeof value === "object") value = value.text ?? value.value ?? "";
  let text = String(value || "");
  if (text.startsWith("@{")) {
    const match = text.match(/(?:^|[;{])\s*text=([\s\S]*?)(?=;\s*(?:explanation|sequence_id|language)\s*=|\}\s*$)/i);
    text = match ? match[1] : text.replace(/^@\{[^;]*;\s*/i, "").replace(/\}$/, "");
  }
  // Hindi exports frequently contain an entire JSON string inside the JSON
  // document. Decode that complete wrapper first, before any fallback cleanup.
  for (let pass = 0; pass < 2; pass += 1) {
    const candidate = text.trim();
    if (!(candidate.startsWith('"') && candidate.endsWith('"'))) break;
    try {
      const decoded = JSON.parse(candidate);
      if (typeof decoded !== "string" || decoded === text) break;
      text = decoded;
    } catch {
      break;
    }
  }
  return text.replace(/^"|"$/g, "").replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\//g, "/")
    .replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\U([0-9a-f]{8})/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/(?:\\t)+(?=(?:\\t|\\n|\\r|\s|<|$))/g, "")
    .replace(/\\n/g, "\n").replace(/\\r/g, "")
    .replace(/[\u00a0\u200b\ufeff]/g, " ");
}
function normaliseMathMarkup(value = "") {
  const source = textValue(value).replace(/\\(?:left|right)\b/g, "");
  const cleanParagraph = (match, inner) => {
    const trimmed = inner.trim();
    const onlyDisplayMath = trimmed.match(/^\$\$([\s\S]*?)\$\$$/);
    if (onlyDisplayMath) return `<p>\\[${onlyDisplayMath[1].trim()}\\]</p>`;
    return `<p>${inner.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => `\\(${math.trim()}\\)`)}</p>`;
  };
  const converted = source
    .replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, cleanParagraph)
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => `\\(${math.trim()}\\)`);
  let insideMath = false;
  const repaired = converted.replace(/\$\$/g, () => {
    insideMath = !insideMath;
    return insideMath ? "\\(" : "\\)";
  });
  return insideMath ? `${repaired}\\)` : repaired;
}
function safeHtml(value = "") {
  const text = normaliseMathMarkup(value).replace(/pyq-asset:\/\/([a-f0-9]{64}\.(?:webp|png|jpe?g|gif))/gi, "/api/pyq/asset?file=$1");
  const doc = new DOMParser().parseFromString(text, "text/html");
  doc.querySelectorAll("script,style,iframe,object,embed,link,form,input,button").forEach((node) => node.remove());
  doc.querySelectorAll("*").forEach((node) => [...node.attributes].forEach((attr) => {
    if (/^on/i.test(attr.name) || /javascript:/i.test(attr.value)) node.removeAttribute(attr.name);
  }));
  doc.querySelectorAll("img").forEach((image) => {
    const rawSrc = image.getAttribute("src") || "";
    const alt = (image.getAttribute("alt") || "").trim();
    if (/^data:/i.test(rawSrc)) return;
    if (/^\/api\/pyq\/asset\?file=[a-f0-9]{64}\.(?:webp|png|jpe?g|gif)$/i.test(rawSrc)) return;
    if (/^\/\//.test(rawSrc)) { image.setAttribute("src", `https:${rawSrc}`); return; }
    if (/^https?:/i.test(rawSrc)) return;
    const filename = rawSrc.replace(/^[/\\]+/, "").split(/[\\/]/).pop();
    if (!filename || filename === "." || filename === "..") {
      const replacement = doc.createElement("span");
      replacement.className = "asset-missing";
      replacement.textContent = "Diagram unavailable in this JSON export";
      image.replaceWith(replacement);
      return;
    }
    image.setAttribute("src", `${CONTENT_IMAGE_BASE}${encodeURIComponent(filename)}`);
    image.setAttribute("onerror", `if(!this.dataset.fb){this.dataset.fb=1;this.src="/images/${encodeURIComponent(filename)}";}`);
    image.setAttribute("data-formula-alt", alt);
    image.setAttribute("loading", "lazy");
  });
  return doc.body.innerHTML.replace(/\\n/g, "<br>");
}
function typesetMath(retry = 0) {
  requestAnimationFrame(() => {
    if (window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise([view]).catch(() => {});
      return;
    }
    // Direct links can render a revision note before the deferred MathJax
    // script has finished loading. Retry briefly instead of leaving LaTex
    // source visible forever.
    if (retry < 16) setTimeout(() => typesetMath(retry + 1), 180);
  });
}
function replaceUnavailableImage(image) {
  const fallback = document.createElement("span");
  const alt = image.dataset.formulaAlt || "";
  if (alt) {
    fallback.className = "math-source";
    fallback.textContent = `\\(${alt.replace(/\\\\/g, "\\")}\\)`;
  } else {
    fallback.className = "asset-missing";
    fallback.textContent = "Diagram unavailable on the content server";
  }
  image.replaceWith(fallback); typesetMath();
}
function localJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function saveJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function attemptKey(batch, test) { return `neet-cbt:attempt:${examPrefix() ? examPrefix().slice(1) + "~" : ""}${batch}:${test}`; }
function currentAttempts() {
  const base = "neet-cbt:attempt:", own = examPrefix() ? `${base}${state.exam}~` : base;
  return Object.keys(localStorage).filter((key) => key.startsWith(own) && (examPrefix() || !key.slice(base.length).includes("~"))).map((key) => localJson(key, null)).filter(Boolean);
}
function getHistory() { return localJson(historyKey(), []); }
function toast(message) { const node = $("#toast"); node.textContent = message; node.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove("show"), 3000); }
function formatTime(seconds) { const value = Math.max(0, seconds); return `${String(Math.floor(value / 3600)).padStart(2, "0")}:${String(Math.floor(value % 3600 / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`; }
function testDurationSeconds(questionCount) {
  const count = Number(questionCount);
  if (count > 0 && count < 45) return Math.max(10, Math.ceil(count * 1.5)) * 60; // short chapter practice sets
  return ([45, 90].includes(count) ? SHORT_TEST_MINUTES : DEFAULT_TEST_MINUTES) * 60;
}
function examDateKey() { return "codex-exam-date:" + (state.exam || "neet"); }
function examDateOverridden() { try { return Boolean(localStorage.getItem(examDateKey())); } catch (e) { return false; } }
function examDate() { let custom = ""; try { custom = localStorage.getItem(examDateKey()) || ""; } catch (e) {} const value = custom || examInfo()?.examDate; const date = value ? new Date(`${value}T00:00:00`) : null; return date && !Number.isNaN(+date) ? date : null; }
function daysLeft() { const date = examDate(); return date ? Math.max(0, Math.ceil((date - new Date()) / 86400000)) : null; }
function closeDrawer() { $("#sidebar").classList.remove("open"); $("#drawerBackdrop").classList.remove("show"); }
function routeFromBrowser() {
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get("view");
  // A live CBT cannot be reconstructed safely from a URL alone. When a user
  // returns to its history entry, take them back to the same test folder;
  // their saved local attempt remains available there.
  const returningFromCbt = requestedView === "cbt";
  const examParam = params.get("exam") || "";
  const viewName = !examParam
    ? "home"
    : returningFromCbt
    ? (isChapterId(params.get("batch") || "") ? "chapters" : "tests")
    : ["dashboard", "tests", "chapters", "notes", "pyq"].includes(requestedView) ? requestedView : "dashboard";
  return {
    exam: examParam,
    view: viewName,
    chapterSubject: viewName === "chapters" ? params.get("subj") || "" : "",
    batch: (viewName === "tests" || viewName === "chapters" || returningFromCbt) ? params.get("batch") || "" : "",
    noteSubject: viewName === "notes" ? params.get("subject") || "" : "",
    noteChapter: viewName === "notes" ? params.get("chapter") || "" : "",
    noteMaterial: viewName === "notes" ? params.get("material") || "" : "",
    pdfBatch: viewName === "pdfs" ? params.get("pdfBatch") || "" : "",
    pyqSubject: viewName === "pyq" ? params.get("pyqSubject") || "" : "",
    pyqChapter: viewName === "pyq" ? params.get("pyqChapter") || "" : "",
    pyqMode: viewName === "pyq" ? params.get("pyqMode") || "" : "",
    pyqLanguage: "en"
  };
}
function saveBrowserRoute(mode = "push") {
  const url = new URL(window.location.href);
  url.search = "";
  if (state.exam && state.view !== "home") url.searchParams.set("exam", state.exam);
  if (state.view !== "dashboard" && state.view !== "home") url.searchParams.set("view", state.view);
  if (state.view === "chapters" && state.selectedChapterSubject) url.searchParams.set("subj", state.selectedChapterSubject);
  if (["tests", "cbt", "chapters"].includes(state.view) && state.selectedBatch) url.searchParams.set("batch", state.selectedBatch);
  if (state.view === "notes" && state.selectedNoteSubject) url.searchParams.set("subject", state.selectedNoteSubject);
  if (state.view === "notes" && state.selectedNoteChapter) url.searchParams.set("chapter", state.selectedNoteChapter);
  if (state.view === "notes" && state.selectedNoteMaterial) url.searchParams.set("material", state.selectedNoteMaterial);
  if (state.view === "pdfs" && state.selectedPdfBatch) url.searchParams.set("pdfBatch", state.selectedPdfBatch);
  if (state.view === "pyq" && state.selectedPyqSubject) url.searchParams.set("pyqSubject", state.selectedPyqSubject);
  if (state.view === "pyq" && state.selectedPyqChapter) url.searchParams.set("pyqChapter", state.selectedPyqChapter);
  if (state.view === "pyq" && state.pyqMode) url.searchParams.set("pyqMode", state.pyqMode);
  if (state.view === "pyq" && state.pyqLanguage === "hi") url.searchParams.set("lang", "hi");
  const snapshot = { chapterSubject: state.selectedChapterSubject, exam: state.exam, view: state.view, batch: state.selectedBatch, noteSubject: state.selectedNoteSubject, noteChapter: state.selectedNoteChapter, noteMaterial: state.selectedNoteMaterial, pdfBatch: state.selectedPdfBatch, pyqSubject: state.selectedPyqSubject, pyqChapter: state.selectedPyqChapter, pyqMode: state.pyqMode, pyqLanguage: state.pyqLanguage };
  window.history[mode === "replace" ? "replaceState" : "pushState"](snapshot, "", `${url.pathname}${url.search}${url.hash}`);
}
function openSyllabusModal(url, title = "Syllabus") {
  $("#pdfModalTitle").textContent = title;
  $("#syllabusFrame").src = url;
  $("#pdfModal").classList.add("open");
  $("#pdfModal").setAttribute("aria-hidden", "false");
}
function closeSyllabusModal() {
  $("#pdfModal").classList.remove("open");
  $("#pdfModal").setAttribute("aria-hidden", "true");
  $("#syllabusFrame").src = "about:blank";
}
const THEME_BASE = { light: "light", dark: "dark", sandalwood: "dark", "forest-emerald": "dark", "ocean-deep": "dark", "dracula-midnight": "dark", "cyberpunk-neon": "dark", "sakura-blossom": "light", "lavender-mist": "light" };
const THEME_COLORS = { light: "#edf2fb", dark: "#111525", sandalwood: "#1c130c", "forest-emerald": "#06140f", "ocean-deep": "#050e17", "sakura-blossom": "#fff3f6", "dracula-midnight": "#14121f", "lavender-mist": "#f5f2fc", "cyberpunk-neon": "#05020a" };
function setTheme(theme) {
  if (theme !== "system" && !THEME_BASE[theme]) theme = "system";
  state.theme = theme; localStorage.setItem(KEYS.theme, theme);
  const name = theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;
  const root = document.documentElement;
  root.dataset.theme = THEME_BASE[name];
  if (name === "light" || name === "dark") root.removeAttribute("data-skin"); else root.dataset.skin = name;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[name]);
}
function navActive() { updateExamChrome(); document.querySelectorAll(".nav-link").forEach((button) => button.classList.toggle("active", button.dataset.view === state.view)); }
async function api(path) {
  if (state.exam) path += `${path.includes("?") ? "&" : "?"}exam=${encodeURIComponent(state.exam)}`;
  // The content is shared study material. Cache it through Vercel instead of
  // forcing a Function run for every dashboard visit.
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error((await response.json().catch(() => ({}))).error || `Request failed (${response.status})`);
  }
  return response.json();
}
const isHindiBatch = (item) => /hindi/i.test(`${item?.id || ""} ${item?.name || ""}`);
async function loadBatches() { if (state.batches.length) return state.batches; const data = await api("/api/batches"); state.batches = (data.batches || []).filter((item) => !isHindiBatch(item)); return state.batches; }
async function loadTests(batch) {
  const data = await api(`/api/tests?batch=${encodeURIComponent(batch)}`);
  state.tests = [...(data.tests || [])].sort((first, second) =>
    String(first.name || "").localeCompare(String(second.name || ""), undefined, {
      numeric: true,
      sensitivity: "base"
    })
  );
  return state.tests;
}
async function loadAllTestsForDashboard() {
  if (Array.isArray(state.allTests)) return state.allTests;
  const data = await api('/api/batches?includeTests=1');
  state.batches = (data.batches || state.batches).filter((item) => !isHindiBatch(item));
  const hindiIds = new Set((data.batches || []).filter(isHindiBatch).map((item) => item.id));
  state.allTests = (Array.isArray(data.tests) ? data.tests : []).filter((test) => !hindiIds.has(test.batchId));
  return state.allTests;
}
async function loadPdfBatches() {
  if (state.pdfBatches.length) return state.pdfBatches;
  const data = await api("/api/pdfs/batches");
  state.pdfBatches = data.batches || [];
  return state.pdfBatches;
}
async function loadPdfTests(batch) {
  const data = await api(`/api/pdfs/tests?batch=${encodeURIComponent(batch)}`);
  state.pdfTests = [...(data.tests || [])].sort((first, second) =>
    String(first.name || "").localeCompare(String(second.name || ""), undefined, { numeric: true, sensitivity: "base" })
  );
  return state.pdfTests;
}
async function loadAllPdfTestsForDashboard() {
  if (Array.isArray(state.allPdfTests)) return state.allPdfTests;
  const batches = await loadPdfBatches();
  const groups = await Promise.all(batches.map(async (batch) => {
    const data = await api(`/api/pdfs/tests?batch=${encodeURIComponent(batch.id)}`);
    return Array.isArray(data.tests) ? data.tests : [];
  }));
  state.allPdfTests = groups.flat();
  return state.allPdfTests;
}
async function loadNoteSubjects() {
  if (state.noteSubjects.length) return state.noteSubjects;
  const data = await api("/api/revision-subjects");
  state.noteSubjects = data.subjects || [];
  return state.noteSubjects;
}
async function loadNoteChapters(subjectId) {
  const data = await api(`/api/revision-chapters?subject=${encodeURIComponent(subjectId)}`);
  state.noteChapters = data.chapters || [];
  return state.noteChapters;
}
async function loadNoteChapter(chapterId) {
  const data = await api(`/api/revision-chapter?chapter=${encodeURIComponent(chapterId)}`);
  state.noteChapter = data;
  return data;
}
async function loadPyqSubjects() {
  if (state.pyqSubjects.length) return state.pyqSubjects;
  const data = await api("/api/pyq/subjects");
  state.pyqSubjects = data.subjects || [];
  return state.pyqSubjects;
}
async function loadPyqChapters(subjectId) {
  const data = await api(`/api/pyq/chapters?subject=${encodeURIComponent(subjectId)}`);
  state.pyqChapters = data.chapters || [];
  return data;
}
async function loadPyqQuestions(subjectId, chapterId, language, mode) {
  return api(`/api/pyq/questions?subject=${encodeURIComponent(subjectId)}&chapter=${encodeURIComponent(chapterId)}&language=${encodeURIComponent(language)}&mode=${encodeURIComponent(mode)}&content_version=${encodeURIComponent(PYQ_CONTENT_VERSION)}`);
}

function normaliseQuestion(question, index) {
  const options = Array.isArray(question.content?.options) ? question.content.options : [];
  const answerText = String(question.content?.answer || "");
  const solution = Array.isArray(question.solution?.text_solutions) ? question.solution.text_solutions[0] : question.solution?.text_solutions;
  return {
    id: question.id || question.unique_identifier || `q-${index + 1}`,
    sequence: Number(question.sequence) || index + 1,
    subject: question.subject_name || "General", topic: question.topic || question.sub_topic || "General",
    prompt: question.content?.qns_content?.text || question.content?.text || "Question unavailable.",
    options: options.map(textValue), correctIndex: Number((answerText.match(/\d+/) || ["0"])[0]),
    solution: textValue(solution) || "No written solution is available for this question.", marks: "+4"
  };
}
function attemptStatus(batchId, slug) { return localJson(attemptKey(batchId, slug), null); }
function syllabusUrl(batch, test) { return `${API_BASE}/api/syllabus?batch=${encodeURIComponent(batch)}&test=${encodeURIComponent(test)}`; }
function testPdfUrl(batch, test, type) { return `${API_BASE}/api/pdfs/pdf?batch=${encodeURIComponent(batch)}&test=${encodeURIComponent(test)}&type=${encodeURIComponent(type)}`; }

function dashboardAttemptCard(attempt) {
  return `<article class="test-card"><span class="tag">${escape(attempt.batchName || attempt.batchId)}</span><h3>${escape(attempt.testName)}</h3><p>${attempt.submitted ? "This test is complete. Review its solutions or restart with a clean attempt." : "Your saved test is ready to continue from the same question."}</p><div class="test-meta"><span>${attempt.questions?.length || "—"} questions</span><span>${attempt.submitted ? "Completed" : "In progress"}</span></div><div class="card-actions">${attempt.submitted ? `<button class="button secondary" data-open-saved="${escape(attempt.batchId)}|${escape(attempt.testSlug)}">View Solution</button><button class="button danger mini" data-restart-saved="${escape(attempt.batchId)}|${escape(attempt.testSlug)}">Restart</button>` : `<button class="button primary" data-open-saved="${escape(attempt.batchId)}|${escape(attempt.testSlug)}">Continue test</button>`}</div></article>`;
}

function batchGroupsHtml(batches) {
  if (!batches.length) return "";
  const order = (batch) => (batch.group ? Number(batch.order ?? 50) : 0);
  const sorted = batches.map((batch, index) => ({ batch, index })).sort((x, y) => order(x.batch) - order(y.batch) || x.index - y.index).map((item) => item.batch);
  return `<div class="folder-grid">${sorted.map(batchFolderCard).join("")}</div>`;
}
function batchFolderCard(batch) {
  return `<article class="folder-card"><div class="folder-copy"><strong>${escape(batch.name)}</strong><small>${Number(batch.testCount || 0)} total tests</small>${batch.source ? `<small class="batch-source">Source: ${escape(batch.source)}</small>` : ""}<button class="button primary explore-button" data-open-batch="${escape(batch.id)}">Explore tests <span>→</span></button></div></article>`;
}
function testCard(test, batchId) {
  const saved = attemptStatus(batchId, test.slug);
  const actionButtons = saved?.submitted
    ? `<button class="button danger" data-restart-saved="${escape(batchId)}|${escape(test.slug)}">Restart</button><button class="button secondary" data-open-analysis="${escape(batchId)}|${escape(test.slug)}">View analysis</button>`
    : `<button class="button primary" data-start-test="${escape(batchId)}|${escape(test.slug)}">${saved ? "Continue test" : "Start test"}</button>`;
  return `<article class="test-card"><div class="test-card-top"><span class="tag">CBT practice</span><span class="test-status ${saved?.submitted ? "done" : saved ? "live" : ""}">${saved?.submitted ? "Completed" : saved ? "In progress" : "Ready"}</span></div><h3>${escape(test.name)}</h3><p>${saved?.submitted ? "Your submitted attempt is saved locally. Open its analysis, review answers, or restart fresh." : "A fresh attempt is stored in this browser only."}</p><div class="test-meta"><span>${escape(String(test.questionCount || "—"))} questions</span><span>${escape(String(test.pageCount || "—"))} pages</span></div><div class="card-actions ${saved?.submitted ? "two-actions" : ""}">${actionButtons}</div></article>`;
}
function pdfBatchFolderCard(batch) {
  return `<article class="folder-card"><div class="folder-copy"><strong>${escape(batch.name)}</strong><small>${Number(batch.testCount || 0)} test PDFs</small><button class="button primary explore-button" data-open-pdf-batch="${escape(batch.id)}">Explore PDFs <span>→</span></button></div></article>`;
}
function pdfTestCard(test, batchId) {
  const has = (type) => Boolean(test.pdfs?.[type]);
  const pdfButton = (type, label) => has(type)
    ? `<a class="button ${type === "syllabus" ? "soft" : "primary"} pdf-button" href="${escape(testPdfUrl(batchId, test.slug, type))}" data-pdf data-pdf-title="${escape(`${test.name} — ${label}`)}">${label}</a>`
    : `<button class="button soft" disabled>${label} unavailable</button>`;
  return `<article class="test-card pdf-test-card"><div class="test-card-top"><span class="tag">Answer key PDFs</span><span class="test-status">Ready</span></div><h3>${escape(test.name)}</h3><p>Open the test syllabus or its Hindi and English answer keys.</p><div class="test-meta"><span>${has("syllabus") ? "Syllabus" : "No syllabus"}</span><span>${has("hindi") ? "Hindi" : "Hindi unavailable"}</span><span>${has("english") ? "English" : "English unavailable"}</span></div><div class="card-actions three-actions">${pdfButton("syllabus", "Syllabus")}${pdfButton("hindi", "Hindi")}${pdfButton("english", "English")}</div></article>`;
}
async function renderPdfs() {
  view.innerHTML = `<section class="loading-screen"><div class="spinner"></div><strong>Opening PDF library</strong><span>Loading answer-key folders…</span></section>`;
  try {
    await loadPdfBatches();
    if (!state.selectedPdfBatch) {
      view.innerHTML = `<button class="back-control" data-go-dashboard>← <span>Back to dashboard</span></button><span class="eyebrow">PDF library</span><h1 class="page-title">Your PDF folders</h1><p class="sub">Choose a folder to open its syllabus, Hindi answer keys, and English answer keys.</p><section class="folder-grid">${state.pdfBatches.map(pdfBatchFolderCard).join("") || `<article class="card empty"><strong>No PDF folder found</strong>Add the PDF folders to the answer-key API and redeploy it.</article>`}</section>${adSlot("library")}`;
      return;
    }
    const batch = state.pdfBatches.find((item) => item.id === state.selectedPdfBatch);
    await loadPdfTests(state.selectedPdfBatch);
    view.innerHTML = `<button class="back-control" data-back-pdf-batches>← <span>All PDF folders</span></button><span class="eyebrow">${escape(batch?.name || "PDF library")}</span><h1 class="page-title">Choose a test PDF</h1><p class="sub">Every test has separate Syllabus, Hindi, and English PDF buttons.</p><section class="test-grid">${state.pdfTests.map((test) => pdfTestCard(test, state.selectedPdfBatch)).join("") || `<article class="card empty"><strong>No PDF found</strong>This folder does not contain readable test PDFs.</article>`}</section>${adSlot("library")}`;
  } catch (error) {
    view.innerHTML = `<article class="card empty"><strong>Could not load PDFs</strong>${escape(error.message)}<br><br>Check the PDF API environment variables and redeploy the portal.</article>`;
  }
}

function pyqSessionKey(subjectId, chapterId, mode, language) {
  return `${KEYS.pyq}${examPrefix()}:${subjectId}:${chapterId}:${mode}:${language}`;
}
function pyqStoredSession(subjectId, chapterId, mode, language) {
  return localJson(pyqSessionKey(subjectId, chapterId, mode, language), null);
}
function persistPyqSession() {
  const session = state.pyqSession;
  if (session) saveJson(pyqSessionKey(session.subjectId, session.chapterId, session.mode, session.language), session);
}
function reviewMarks(session) {
  if (!session.markedForReview || typeof session.markedForReview !== "object") session.markedForReview = {};
  return session.markedForReview;
}
function markedCount(session) { return Object.values(reviewMarks(session)).filter(Boolean).length; }
function isMarkedForReview(session, questionId) { return Boolean(reviewMarks(session)[questionId]); }
function pyqCorrectIndex(value) {
  const letter = String(value || "").trim().toUpperCase();
  if (/^[A-D]$/.test(letter)) return "ABCD".indexOf(letter);
  const number = Number(letter);
  return Number.isInteger(number) && number > 0 ? number - 1 : -1;
}
function normalisePyqQuestion(question, index, subjectName) {
  const options = Array.isArray(question.options) ? question.options : [];
  const solution = [question.solution, question.explanation].filter(Boolean).join("<hr>");
  return {
    id: `pyq-${question.questionNumber || index + 1}-${index + 1}`,
    number: Number(question.questionNumber) || index + 1,
    subject: subjectName || "PYQ",
    topic: question.topic || "Previous year question",
    year: question.year || "",
    prompt: question.question || "Question unavailable.",
    options: options.map((option) => option?.content ?? option?.text ?? option ?? ""),
    correctIndex: pyqCorrectIndex(question.correctOption),
    solution: solution || "No written explanation is available for this question."
  };
}
function pyqDurationSeconds(questionCount) {
  return (Number(questionCount) <= 90 ? SHORT_TEST_MINUTES : DEFAULT_TEST_MINUTES) * 60;
}
function pyqRemainingTime() {
  const session = state.pyqSession;
  return Math.max(0, Number(session.durationSeconds || 0) - Math.floor((Date.now() - Number(session.startedAt || Date.now())) / 1000));
}
function pyqSubjectCard(subject) {
  return `<article class="folder-card pyq-subject-card"><div class="folder-copy"><span class="pyq-subject-icon">${escape(subject.name.slice(0, 1))}</span><strong>${escape(subject.name)}</strong><small>${Number(subject.questionCount || 0).toLocaleString()} PYQs · ${Number(subject.chapterCount || 0)} chapters</small><button class="button primary explore-button" data-open-pyq-subject="${escape(subject.id)}">Explore chapters <span>→</span></button></div></article>`;
}
function pyqChapterCard(chapter) {
  return `<article class="test-card pyq-chapter-card"><div class="test-card-top"><span class="tag">Chapter PYQs</span><span class="test-status">${Number(chapter.questionCount || 0)} questions</span></div><h3>${escape(chapter.name)}</h3><p>Practice with immediate answers, or take a timed CBT-style chapter test.</p><div class="test-meta"><span>English</span><span>${Number(chapter.questionCount || 0)} PYQs</span></div><div class="card-actions two-actions"><button class="button soft" data-open-pyq-chapter="${escape(chapter.id)}" data-pyq-mode="practice">Practice</button><button class="button primary" data-open-pyq-chapter="${escape(chapter.id)}" data-pyq-mode="test">Take test</button></div></article>`;
}
function pyqInstructions(subject, chapter) {
  const mode = state.pyqMode;
  const saved = pyqStoredSession(state.selectedPyqSubject, state.selectedPyqChapter, mode, state.pyqLanguage);
  const test = mode === "test";
  const count = Number(chapter?.questionCount || 0);
  const timing = test ? `${Math.round(pyqDurationSeconds(count) / 60)} minutes` : "No time limit";
  const title = test ? "Take chapter test" : "Practice chapter PYQs";
  const startLabel = saved?.submitted ? "View previous analysis" : saved ? (test ? "Resume test" : "Continue practice") : (test ? "Start test" : "Start practice");
  return `<button class="back-control" data-back-pyq-chapters>← <span>All ${escape(subject?.name || "subject")} chapters</span></button><section class="pyq-instructions card"><span class="tag">${test ? "Timed test" : "Instant practice"}</span><h1>${title}</h1><p class="pyq-instruction-chapter">${escape(chapter?.name || "Chapter")}</p><div class="pyq-info-grid"><div><small>Total questions</small><strong>${count}</strong></div><div><small>${test ? "Time limit" : "Feedback"}</small><strong>${timing}</strong></div><div><small>Progress</small><strong>Saved on this device</strong></div></div><ul class="pyq-rules">${test ? "<li>Answer at your own pace; your choices save automatically.</li><li>Solutions remain hidden until you submit the test.</li>" : "<li>Select an option to see the correct answer immediately.</li><li>Read the explanation and move freely between questions.</li>"}</ul><button class="button primary pyq-start-button" data-start-pyq>${startLabel} <span>→</span></button></section>`;
}

/* ---------- Question palette drawer (from test-main) ---------- */
function paletteHtml(session, jumpAttr) {
  const total = session.questions.length;
  const answered = session.questions.filter((item) => session.answers[item.id] !== undefined).length;
  const marked = session.questions.filter((item) => isMarkedForReview(session, item.id)).length;
  const cells = session.questions.map((item, index) => `<button class="${session.answers[item.id] !== undefined ? "answered" : ""} ${isMarkedForReview(session, item.id) ? "marked" : ""} ${index === session.current ? "current" : ""}" ${jumpAttr}="${index}">${index + 1}</button>`).join("");
  return `<aside class="palette-drawer" id="paletteDrawer"><div class="palette-head"><div><small>Navigation</small><h3>Question palette</h3></div><button class="icon-button small" data-close-palette aria-label="Close question palette">×</button></div><div class="palette-summary"><span><i class="dot answered-dot"></i>${answered} answered</span><span><i class="dot review-dot"></i>${marked} review</span><span><i class="dot"></i>${total - answered} left</span></div><div class="palette-scroll"><div class="palette-grid">${cells}</div></div></aside>`;
}
const PALETTE_BTN = `<button class="button palette-trigger" data-open-palette type="button">☷ Palette</button>`;

function renderPyqSession() {
  const session = state.pyqSession;
  if (!session) return renderPyq();
  if (session.mode === "test" && session.submitted && !session.reviewMode) return renderPyqResult();
  const question = session.questions[session.current];
  if (!question) return renderPyq();
  const selected = session.answers[question.id];
  const showFeedback = session.mode === "practice" && selected !== undefined;
  const showReview = session.mode === "test" && session.reviewMode;
  const showAnswers = showFeedback || showReview;
  if (!showReview) markVisited(session, question);
  const where = positionInSection(session, session.current);
  const visible = visibleIndices(session); const at = visible.indexOf(session.current);
  const meta = [question.year ? `${examName()} ${question.year}` : "PYQ", question.topic].filter(Boolean).join(" · ");
  const testControls = session.mode === "test" && !session.reviewMode
    ? `<div class="response-controls"><button class="button review-button ${isMarkedForReview(session, question.id) ? "active" : ""}" data-pyq-toggle-review>${isMarkedForReview(session, question.id) ? "Remove review mark" : "Mark for review"}</button><button class="button secondary" data-pyq-clear-response ${selected === undefined ? "disabled" : ""}>Clear response</button></div>`
    : "";
  const right = session.mode === "test" && !session.reviewMode
    ? `<span class="timer" id="pyqTimer">${formatTime(pyqRemainingTime())}</span><button class="button primary" data-open-summary>Submit</button>`
    : session.mode === "test" ? `<button class="button primary" data-pyq-result>Back to analysis</button>` : `<span class="review-chip">Instant feedback</span>`;
  const top = showReview
    ? `<div class="card cbt-top review-top"><div class="cbt-title"><small>${escape(session.subjectName)} · PYQ Test</small><strong>${escape(session.chapterName)}</strong></div><div class="review-top-actions"><button class="button danger" data-exit-pyq>Leave Test</button><button class="button primary" data-pyq-result>Exit Solutions</button></div></div>`
    : `<div class="card cbt-top"><button class="button secondary" data-exit-pyq>Exit</button><div class="cbt-title"><small>${escape(session.subjectName)} · ${session.mode === "test" ? "PYQ Test" : "PYQ Practice"}</small><strong>${escape(session.chapterName)}</strong></div><strong class="question-count">Q ${where.pos}/${where.size}</strong>${right}</div>`;
  const optionBadge = (index) => {
    if (!showAnswers) return "";
    if (index === question.correctIndex) return `<span class="opt-badge ok">✓ Correct Answer</span>`;
    if (selected === index) return `<span class="opt-badge bad">✗ Your Answer</span>`;
    return "";
  };
  view.innerHTML = `<section class="cbt-shell pyq-session">${top}${navHtml(session)}<article class="card question-card"><div class="question-head"><span>${escape(meta)}</span><div class="question-head-right"><span class="question-number">Question ${where.pos}</span></div></div><div class="question-content">${safeHtml(question.prompt)}</div><div class="options">${question.options.map((option, index) => { const isSelected = selected === index; const answerClass = showAnswers ? (index === question.correctIndex ? "correct" : isSelected ? "incorrect" : "") : isSelected ? "selected" : ""; const disabled = showFeedback || showReview ? "disabled" : ""; return `<button class="option ${answerClass}" data-pyq-answer="${index}" ${disabled}><span class="letter">${"ABCD"[index] || index + 1}</span><span class="option-text">${safeHtml(option)}</span>${optionBadge(index)}</button>`; }).join("")}</div>${showAnswers ? `<div class="solution-box"><div class="solution-heading"><h3>${selected === question.correctIndex ? "Correct answer" : "Solution"}</h3><span class="tag">Correct: ${"ABCD"[question.correctIndex] || "—"}</span></div><div class="solution-content">${safeHtml(question.solution)}</div></div>` : ""}<div class="question-actions"><span>${session.mode === "practice" ? "Select an answer to reveal the solution." : "Your answers save automatically on this device."}</span><div class="question-action-controls">${testControls}<div class="row"><button class="button secondary" data-nav-move="-1" ${at === 0 ? "disabled" : ""}>Previous</button><button class="button primary" data-nav-move="1" ${at === visible.length - 1 ? "disabled" : ""}>Next</button></div></div></div></article></section>`;
  centerStrip(); typesetMath();
}
function pyqScore(session) {
  const total = session.questions.length;
  const answered = Object.keys(session.answers).length;
  const correct = session.questions.filter((question) => session.answers[question.id] === question.correctIndex).length;
  return { total, answered, correct, incorrect: Math.max(0, answered - correct), unattempted: total - answered, accuracy: total ? Math.round(correct / total * 100) : 0 };
}
function renderPyqResult() {
  const session = state.pyqSession;
  if (!session) return renderPyq();
  const score = pyqScore(session);
  view.innerHTML = `<section class="result-layout"><article class="card result-hero"><span class="tag">PYQ test submitted</span><h1>${escape(session.chapterName)}</h1><p>Your chapter-test attempt is stored only in this browser. Review every answer or restart with a clear attempt.</p><div class="result-score"><strong>${score.correct}</strong><span>correct<br>out of ${score.total}</span></div><div class="result-actions"><button class="button secondary" data-review-pyq>View solution</button><button class="button danger" data-restart-pyq>Restart test</button></div></article><section class="score-grid"><article class="card score-card"><small>Correct</small><strong class="green-text">${score.correct}</strong></article><article class="card score-card"><small>Incorrect</small><strong class="red-text">${score.incorrect}</strong></article><article class="card score-card"><small>Unattempted</small><strong>${score.unattempted}</strong></article><article class="card score-card"><small>Accuracy</small><strong>${score.accuracy}%</strong></article></section></section>`;
}
async function startPyqSession() {
  const { selectedPyqSubject: subjectId, selectedPyqChapter: chapterId, pyqMode: mode, pyqLanguage: language } = state;
  if (!subjectId || !chapterId || !["practice", "test"].includes(mode)) return;
  const saved = pyqStoredSession(subjectId, chapterId, mode, language);
  if (saved) {
    saved.submitting = false;
    reviewMarks(saved);
    state.pyqSession = saved;
    if (saved.submitted && mode === "test") saved.reviewMode = false;
    if (mode === "test" && !saved.submitted) enterExamFullscreen();
    return renderPyqSession();
  }
  view.innerHTML = `<section class="loading-screen"><div class="spinner"></div><strong>Preparing chapter PYQs</strong><span>Loading the selected language securely…</span><div class="loading-bars"><i></i><i></i><i></i></div></section>`;
  try {
    const data = await loadPyqQuestions(subjectId, chapterId, language, mode === "test" ? "test" : "practice");
    const questions = (data.questions || []).map((item, index) => normalisePyqQuestion(item, index, data.subject?.name));
    if (!questions.length) throw new Error("No readable PYQs are available for this chapter.");
    state.pyqSession = { subjectId, subjectName: data.subject?.name || "PYQ", chapterId, chapterName: data.chapter?.name || "Chapter", language, mode, startedAt: Date.now(), durationSeconds: mode === "test" ? pyqDurationSeconds(questions.length) : 0, questions, answers: {}, markedForReview: {}, current: 0, submitted: false, reviewMode: false };
    persistPyqSession();
    if (mode === "test") enterExamFullscreen();
    renderPyqSession();
  } catch (error) {
    toast(error.message);
    renderPyq();
  }
}
async function submitPyqTest() {
  closeSummary();
  const session = state.pyqSession;
  if (!session || session.mode !== "test" || session.submitted || session.submitting) return;
  session.submitting = true;
  persistPyqSession();
  view.innerHTML = `<section class="loading-screen"><div class="spinner"></div><strong>Checking your PYQ test</strong><span>Loading answer keys and explanations…</span></section>`;
  try {
    const review = await loadPyqQuestions(session.subjectId, session.chapterId, session.language, "review");
    const reviewed = (review.questions || []).map((item, index) => normalisePyqQuestion(item, index, session.subjectName));
    const byNumber = new Map(reviewed.map((question) => [question.number, question]));
    session.questions = session.questions.map((question) => ({ ...question, ...(byNumber.get(question.number) || {}) , id: question.id }));
    session.submitted = true;
    session.submitting = false;
    session.reviewMode = false;
    persistPyqSession();
    exitExamFullscreen();
    renderPyqResult();
  } catch (error) {
    session.submitting = false;
    persistPyqSession();
    toast(`Could not submit test: ${error.message}`);
    renderPyqSession();
  }
}
function restartPyqSession() {
  const session = state.pyqSession;
  if (!session) return;
  localStorage.removeItem(pyqSessionKey(session.subjectId, session.chapterId, session.mode, session.language));
  state.pyqSession = null;
  state.pyqMode = session.mode;
  renderPyq();
}
async function renderPyq() {
  view.innerHTML = `<section class="loading-screen"><div class="spinner"></div><strong>Opening PYQ library</strong><span>Loading subjects and chapter questions…</span></section>`;
  try {
    await loadPyqSubjects();
    if (!state.selectedPyqSubject) {
      view.innerHTML = `<button class="back-control" data-go-dashboard>← <span>Back to dashboard</span></button><span class="eyebrow">Previous year questions</span><h1 class="page-title">PYQ practice</h1><p class="sub">Choose a subject, then practice chapter-wise NEET previous-year questions.</p><section class="folder-grid pyq-subject-grid">${state.pyqSubjects.map(pyqSubjectCard).join("") || `<article class="card empty"><strong>No PYQ subjects found</strong>Check the PYQ API deployment.</article>`}</section>${adSlot("library")}`;
      return;
    }
    const subject = state.pyqSubjects.find((item) => item.id === state.selectedPyqSubject);
    await loadPyqChapters(state.selectedPyqSubject);
    if (!state.selectedPyqChapter) {
      view.innerHTML = `<button class="back-control" data-back-pyq-subjects>← <span>All subjects</span></button><span class="eyebrow">${escape(subject?.name || "PYQ")}</span><h1 class="page-title">Choose a chapter</h1><p class="sub">Every chapter offers instant-feedback Practice and a timed Take Test mode.</p><section class="test-grid pyq-chapter-grid">${state.pyqChapters.map(pyqChapterCard).join("") || `<article class="card empty"><strong>No chapters found</strong>This subject has no readable PYQ chapters.</article>`}</section>${adSlot("library")}`;
      return;
    }
    const chapter = state.pyqChapters.find((item) => item.id === state.selectedPyqChapter);
    if (!state.pyqMode) {
      view.innerHTML = `<button class="back-control" data-back-pyq-chapters>← <span>All ${escape(subject?.name || "subject")} chapters</span></button><span class="eyebrow">${escape(subject?.name || "PYQ")}</span><h1 class="page-title">${escape(chapter?.name || "Chapter")}</h1><p class="sub">Choose how you want to work through these previous-year questions.</p><section class="pyq-mode-grid"><button class="pyq-mode-card" data-select-pyq-mode="practice"><span>✦</span><strong>Practice</strong><small>Instant answer and explanation. No timer.</small></button><button class="pyq-mode-card test" data-select-pyq-mode="test"><span>◷</span><strong>Take test</strong><small>Timed CBT mode. Solutions after submission.</small></button></section>`;
      return;
    }
    view.innerHTML = pyqInstructions(subject, chapter);
  } catch (error) {
    view.innerHTML = `<article class="card empty"><strong>Could not load PYQs</strong>${escape(error.message)}<br><br>Check the PYQ API environment variables and redeploy the portal.</article>`;
  }
}

function noteSubjectCard(subject) {
  return `<article class="folder-card note-subject-card"><div class="folder-copy"><span class="note-subject-icon">${escape(subject.name.slice(0, 1))}</span><strong>${escape(subject.name)}</strong><small>${Number(subject.chapterCount || 0)} chapters</small><button class="button primary explore-button" data-open-note-subject="${escape(subject.id)}">Explore chapters <span>→</span></button></div></article>`;
}
function noteChapterCard(chapter) {
  const duration = Number(chapter.durationMinutes || 0);
  return `<article class="test-card note-chapter-card"><div class="test-card-top"><span class="tag">Chapter ${chapter.order}</span><span class="test-status">${duration ? `${duration} min` : "Notes"}</span></div><h3>${escape(chapter.title)}</h3><p>Browse ${Number(chapter.materialCount || 0)} revision materials, including key points, diagrams, formula sets, and common confusions.</p><div class="test-meta"><span>${Number(chapter.materialCount || 0)} materials</span><span>${duration ? `${duration} minutes` : "Self-paced"}</span></div><div class="card-actions"><button class="button primary" data-open-note-chapter="${escape(chapter.id)}">Open chapter</button></div></article>`;
}
function noteMaterialCard(material, index) {
  const labels = [...new Set([material.noteType, ...(material.tags || [])].filter(Boolean))].slice(0, 5);
  const count = Array.isArray(material.blocks) ? material.blocks.length : 0;
  return `<article class="note-material-card note-material-select"><button class="note-material-open" data-open-note-material="${escape(material.id)}"><div class="note-material-heading"><span>${String(index + 1).padStart(2, "0")}</span><div><h3>${escape(material.name)}</h3><p>${escape(material.description || material.subtype || "Revision material")}</p></div>${material.durationMinutes ? `<b>${escape(String(material.durationMinutes))} min</b>` : ""}</div><div class="note-tags">${labels.map((label) => `<span>${escape(label.replaceAll("_", " "))}</span>`).join("") || "<span>Revision notes</span>"}<span>${count} learning blocks</span></div><i class="note-open-arrow">Open →</i></button></article>`;
}
function safeExternalUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return /^https?:$/.test(url.protocol) ? url.href : "";
  } catch { return ""; }
}
function noteTextHtml(value) {
  const lines = String(value || "").replace(/\r/g, "").split("\n");
  const blocks = [];
  let paragraph = [];
  let list = [];
  // Some source notes are exported as one value per line (with an empty
  // line between each value). Those are commonly formula/reference lists,
  // not separate paragraphs. Display them as a compact study grid instead
  // of producing a tall, PDF-like column of single-line paragraphs.
  const dataLine = (raw) => {
    const text = String(raw || "").replace(/^[•·▪◦\-–]\s*/, "").trim();
    if (!text || text.length > 42) return false;
    return /(?:\d|[=<>±→↔]|\\|\/|\^|_|\b(?:V|K|Hz|cm|mm|mol|g|kg|pH|°C)\b)/i.test(text)
      || /^[A-Z][a-z]?\d*(?:\([^)]*\))?$/.test(text);
  };
  const gridLine = (raw) => String(raw || "").replace(/^[•·▪◦\-–]\s*/, "").trim();
  const flushParagraph = () => {
    const text = paragraph.join(" ").trim();
    if (!text) return;
    const className = /[:：-]\s*$/.test(text) && text.length < 110 ? "note-section-label" : "";
    blocks.push(`<p class="${className}">${escape(text)}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    blocks.push(`<ul class="note-bullet-list">${list.map((item) => `<li class="${item.depth ? "nested" : ""}">${escape(item.text)}</li>`).join("")}</ul>`);
    list = [];
  };
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    // Collect 3+ consecutive compact data lines, allowing blank separator
    // lines. Example: Pb / 0.13 V / H2 / 0.00 V.
    if (dataLine(line)) {
      const values = [];
      let cursor = lineIndex;
      while (cursor < lines.length) {
        if (!lines[cursor].trim()) { cursor += 1; continue; }
        if (!dataLine(lines[cursor])) break;
        values.push(gridLine(lines[cursor]));
        cursor += 1;
      }
      if (values.length >= 3) {
        flushParagraph();
        flushList();
        blocks.push(`<div class="note-data-grid">${values.map((item) => `<span>${escape(item)}</span>`).join("")}</div>`);
        lineIndex = cursor - 1;
        continue;
      }
    }
    const bullet = line.match(/^(\s*)[•·▪◦\-–]\s*(.+)$/);
    if (bullet) {
      flushParagraph();
      list.push({ depth: bullet[1].length > 1, text: bullet[2].trim() });
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  return blocks.join("") || `<p>${escape("No readable text was included for this material.")}</p>`;
}
function noteBlock(block, index) {
  const tags = (block.tags || []).slice(0, 3).map((tag) => `<span>${escape(String(tag).replaceAll("_", " "))}</span>`).join("");
  const heading = `<header><span>${String(index + 1).padStart(2, "0")}</span><div><small>${escape(block.subtype || block.kind || "Revision")}</small><h2>${escape(block.title || "Revision material")}</h2></div>${tags ? `<div class="note-block-tags">${tags}</div>` : ""}</header>`;
  if (block.kind === "table") {
    const tables = Array.isArray(block.tables) ? block.tables : [];
    const tableHtml = tables.map((table) => {
      const columns = Array.isArray(table.columns) ? table.columns : [];
      const rows = Array.isArray(table.rows) ? table.rows : [];
      const annotations = Array.isArray(table.annotations) ? table.annotations : [];
      return `<div class="note-table-wrap">${annotations.length ? `<div class="note-table-hints">${annotations.map((item) => `<span>${escape(item)}</span>`).join("")}</div>` : ""}<div class="note-table-scroll"><table class="note-study-table"><thead><tr>${columns.map((column) => `<th>${escape(column)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((_, cellIndex) => `<td>${escape(row[cellIndex] || "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`;
    }).join("");
    return `<article class="note-reader-block note-table-block">${heading}${block.text ? `<div class="note-text-copy note-table-intro">${noteTextHtml(block.text)}</div>` : ""}${tableHtml}</article>`;
  }
  if (block.kind === "image" || block.kind === "model") {
    const localMedia = /^[a-f0-9-]{36}\.webp$/i.test(String(block.mediaFile || ""))
      ? `/api/revision-media?file=${encodeURIComponent(block.mediaFile)}`
      : "";
    const imageUrl = localMedia || safeExternalUrl(block.imageUrl);
    return `<article class="note-reader-block note-visual-block">${heading}${imageUrl ? `<figure><img src="${escape(imageUrl)}" alt="${escape(block.title || "Diagram")}" loading="lazy"><figcaption>${block.kind === "model" ? "3D visual preview" : "Diagram"}</figcaption></figure>` : `<p class="note-empty-block">Diagram preview is unavailable in this export.</p>`}</article>`;
  }
  if (block.kind === "question") {
    return `<article class="note-reader-block note-question-block">${heading}<div class="note-question-copy">${noteTextHtml(block.question || "Question text unavailable.")}</div><details><summary>Show answer</summary><div class="note-answer-copy">${noteTextHtml(block.answer || "Answer not available.")}</div></details></article>`;
  }
  return `<article class="note-reader-block note-text-block">${heading}<div class="note-text-copy">${noteTextHtml(block.text || "No readable text was included for this material.")}</div></article>`;
}
async function renderNotes() {
  view.innerHTML = `<section class="loading-screen"><div class="spinner"></div><strong>Opening revision notes</strong><span>Loading subjects and chapter materials…</span></section>`;
  try {
    await loadNoteSubjects();
    if (!state.selectedNoteSubject) {
      view.innerHTML = `<button class="back-control" data-go-dashboard>← <span>Back to dashboard</span></button><span class="eyebrow">Revision library</span><h1 class="page-title">Revision Notes</h1><p class="sub">Choose a subject, open a chapter, and organise your revision material in one place.</p><section class="folder-grid note-subject-grid">${state.noteSubjects.map(noteSubjectCard).join("") || `<article class="card empty"><strong>No revision subjects found</strong>Check the Revision Notes API deployment.</article>`}</section>${adSlot("library")}`;
      return;
    }
    const subject = state.noteSubjects.find((item) => item.id === state.selectedNoteSubject);
    await loadNoteChapters(state.selectedNoteSubject);
    if (!state.selectedNoteChapter) {
      view.innerHTML = `<button class="back-control" data-back-note-subjects>← <span>All subjects</span></button><span class="eyebrow">${escape(subject?.name || "Revision notes")}</span><h1 class="page-title">Choose a chapter</h1><p class="sub">Each chapter groups its captured revision materials by topic and note type.</p><section class="test-grid note-chapter-grid">${state.noteChapters.map(noteChapterCard).join("") || `<article class="card empty"><strong>No chapters found</strong>This subject has no readable chapter manifest.</article>`}</section>${adSlot("library")}`;
      return;
    }
    const chapter = await loadNoteChapter(state.selectedNoteChapter);
    if (!state.selectedNoteMaterial) {
      view.innerHTML = `<button class="back-control" data-back-note-chapters>← <span>All ${escape(subject?.name || "subject")} chapters</span></button><span class="eyebrow">${escape(chapter.subject?.name || subject?.name || "Revision notes")}</span><h1 class="page-title">${escape(chapter.chapter?.title || "Chapter")}</h1><p class="sub">${Number(chapter.materials?.length || 0)} organised revision notes${chapter.chapter?.durationMinutes ? ` · ${escape(String(chapter.chapter.durationMinutes))} minutes` : ""}. Select one to read its notes, diagrams, and PYQs.</p><section class="note-material-list">${(chapter.materials || []).map(noteMaterialCard).join("") || `<article class="card empty"><strong>No materials found</strong>The chapter metadata is available, but it does not contain material entries.</article>`}</section>`;
      return;
    }
    const material = (chapter.materials || []).find((item) => item.id === state.selectedNoteMaterial);
    if (!material) {
      state.selectedNoteMaterial = "";
      return renderNotes();
    }
    const blocks = Array.isArray(material.blocks) ? material.blocks : [];
    view.innerHTML = `<button class="back-control" data-back-note-materials>← <span>Back to ${escape(chapter.chapter?.title || "chapter")}</span></button><span class="eyebrow">${escape(chapter.subject?.name || subject?.name || "Revision notes")} · ${escape(chapter.chapter?.title || "Chapter")}</span><h1 class="page-title note-reader-title">${escape(material.name)}</h1><p class="sub">${blocks.length} learning blocks${material.durationMinutes ? ` · ${escape(String(material.durationMinutes))} minutes` : ""}. Text, diagrams, and PYQs are arranged in the original note order.</p><section class="note-reader">${blocks.map(noteBlock).join("") || `<article class="card empty"><strong>No readable blocks found</strong>This material is available in the source, but contains no text, question, or diagram block.</article>`}</section>`;
    typesetMath();
  } catch (error) {
    view.innerHTML = `<article class="card empty"><strong>Could not load revision notes</strong>${escape(error.message)}<br><br>Check the Revision Notes API environment variables and redeploy the portal.</article>`;
  }
}

async function startTest(batchId, testSlug, openSaved = false) {
  const saved = attemptStatus(batchId, testSlug);
  if (!openSaved && !saved?.submitted) enterExamFullscreen();
  if (saved) {
    const expectedDuration = testDurationSeconds(saved.questions?.length);
    if (saved.durationSeconds !== expectedDuration) {
      saved.durationSeconds = expectedDuration;
      saveJson(attemptKey(batchId, testSlug), saved);
    }
    reviewMarks(saved);
    state.attempt = saved; state.view = "cbt"; state.attempt.reviewMode = Boolean(saved.submitted && openSaved); saveBrowserRoute(); renderCbt(); window.scrollTo(0, 0); return;
  }
  view.innerHTML = `<section class="loading-screen"><div class="spinner"></div><strong>Preparing your CBT</strong><span>Loading your secure test…</span><div class="loading-bars"><i></i><i></i><i></i></div></section>`;
  try {
    const pending = state.pending && state.pending.batchId === batchId && state.pending.slug === testSlug ? state.pending : null;
    const first = pending ? { test: { name: pending.name } } : await api(`/api/test?batch=${encodeURIComponent(batchId)}&test=${encodeURIComponent(testSlug)}`);
    const questions = pending ? pending.questions : (first.questions || []).map(normaliseQuestion);
    state.pending = null;
    if (!questions.length) throw new Error("This test does not contain readable questions.");
    const batchName = state.batches.find((batch) => batch.id === batchId)?.name || batchId;
    state.attempt = { batchId, batchName, testSlug, testName: first.test.name, startedAt: Date.now(), durationSeconds: testDurationSeconds(questions.length), questions, answers: {}, markedForReview: {}, visited: {}, current: 0, submitted: false, reviewMode: false };
    persistAttempt(); state.view = "cbt"; saveBrowserRoute(); renderCbt(); window.scrollTo(0, 0);
  } catch (error) { exitExamFullscreen(); toast(error.message); state.view = backToLibraryView(batchId); state.view === "chapters" ? renderChapters() : renderTests(); }
}
function enterExamFullscreen() {
  if (document.fullscreenElement || !document.documentElement.requestFullscreen) return;
  document.documentElement.requestFullscreen().catch(() => {
    toast("Fullscreen could not start. Your browser may have blocked it.");
  });
}
function exitExamFullscreen() {
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
}
function persistAttempt() { if (state.attempt) saveJson(attemptKey(state.attempt.batchId, state.attempt.testSlug), state.attempt); }
function remainingTime() { return Math.max(0, state.attempt.durationSeconds - Math.floor((Date.now() - state.attempt.startedAt) / 1000)); }
/* ---------- Chapter helpers ---------- */
function isChapterId(id = "") { return String(id).startsWith("sl-") && id !== "sl-full-length"; }
function isChapterBatch(ref) {
  const batch = typeof ref === "string" ? state.batches.find((item) => item.id === ref) : ref;
  if (batch?.group) return /chapter/i.test(batch.group);
  return isChapterId(typeof ref === "string" ? ref : batch?.id || "");
}
function chapterSubjectOf(batch) {
  const text = `${batch.group || ""} ${batch.id || ""}`.toLowerCase();
  if (/physics|sl-phys/.test(text)) return "Physics";
  if (/chem/.test(text)) return "Chemistry";
  if (/biolog|sl-biol/.test(text)) return "Biology";
  return "Other";
}
function backToLibraryView(batchId) { return isChapterBatch(batchId || "") ? "chapters" : "tests"; }

/* ---------- Countdown + dashboard ---------- */
function countdownParts() {
  const date = examDate(); if (!date) return null;
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  const diff = Math.max(0, end - new Date());
  return { days: Math.floor(diff / 86400000), hours: Math.floor(diff % 86400000 / 3600000), minutes: Math.floor(diff % 3600000 / 60000), seconds: Math.floor(diff % 60000 / 1000) };
}
function setCdDigit(id, text) {
  const box = $("#" + id); if (!box) return;
  const cur = box.querySelector(".cdj-digit:not(.leaving)");
  if (cur && cur.textContent === text) return;
  const next = document.createElement("span");
  next.className = "cdj-digit entering"; next.textContent = text;
  if (cur) { cur.classList.add("leaving"); setTimeout(() => cur.remove(), 300); }
  box.appendChild(next);
}
function updateCountdown() {
  const parts = countdownParts(); if (!parts || !$("#cdDays")) return;
  const pad = (value) => String(value).padStart(2, "0");
  setCdDigit("cdDays", pad(parts.days)); setCdDigit("cdHours", pad(parts.hours)); setCdDigit("cdMinutes", pad(parts.minutes)); setCdDigit("cdSeconds", pad(parts.seconds));
  const left = $("#cdLeft"); if (left) left.textContent = `${parts.days}d left`;
}
function renderDashboard() {
  const info = examInfo(), nm = examName(), date = examDate();
  const attempts = currentAttempts();
  const loaded = state.batches.length > 0;
  const fullBatches = state.batches.filter((batch) => !isChapterBatch(batch));
  const chapterBatches = state.batches.filter((batch) => isChapterBatch(batch));
  const sum = (list) => list.reduce((total, batch) => total + Number(batch.testCount || 0), 0);
  const parts = countdownParts();
  const pad2 = (value) => String(value).padStart(2, "0");
  const dateText = date ? date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "";
  const iso = date ? `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` : "";
  const unit = (id, value, label) => `<div class="cdj-unit"><div class="cdj-box" id="${id}"><span class="cdj-digit">${pad2(value)}</span></div><span>${label}</span></div>`;
  const sep = `<div class="cdj-sep">:</div>`;
  const hero = parts
    ? `<section class="card countdown-hero cd-jee" id="cdTracker"><div class="cdj-head"><span class="cdj-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg></span><div class="cdj-title"><strong>${escape(nm)} ${escape(String(date.getFullYear()))}</strong><small>${escape(dateText)}${examDateOverridden() ? "" : " (Tentative)"}</small></div><div class="cdj-right"><label class="cdj-change"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>Change<input type="date" id="cdDateInput" value="${iso}" aria-label="Change exam date" /></label><b id="cdLeft">${parts.days}d left</b></div></div><div class="cdj-row">${unit("cdDays", parts.days, "Days")}${sep}${unit("cdHours", parts.hours, "Hrs")}${sep}${unit("cdMinutes", parts.minutes, "Min")}${sep}${unit("cdSeconds", parts.seconds, "Sec")}</div><p class="cd-note">One test a day, one chapter a day. Let's begin! 🚀</p></section>`
    : `<section class="card countdown-hero cd-jee"><div class="cdj-head"><span class="cdj-icon">${escape(info?.icon || "🎯")}</span><div class="cdj-title"><strong>${escape(nm)} Preparation</strong><small>The exam date has not been announced yet.</small></div></div></section>`;
  const dashCard = (icon, title, text, meta, view, cta) => `<button class="dash-card" data-go-view="${view}"><span class="dash-icon">${icon}</span><strong>${title}</strong><small>${text}</small>${meta ? `<em>${meta}</em>` : ""}<span class="button primary explore-button dash-cta">${cta} <span>→</span></span></button>`;
  view.innerHTML = `${hero}
  ${loaded && !state.batches.length ? "" : ""}
  ${loaded && !fullBatches.length && !chapterBatches.length ? `<section class="card exam-soon-note"><strong>${escape(nm)} content is coming soon 🚀</strong><span>No tests have been uploaded for this exam yet. Join our Telegram channel to get updates first.</span></section>` : ""}
  <div class="dash-grid">
    ${dashCard("▣", "Full-Length Tests", "Full syllabus mock tests, like the RE-NEET series.", loaded ? `${sum(fullBatches)} tests` : "", "tests", "Explore tests")}
    ${dashCard("📘", "Chapter-wise Tests", "Chapter-wise tests for Physics, Chemistry and Biology.", loaded ? `${chapterBatches.length} chapters · ${sum(chapterBatches)} tests` : "", "chapters", "Explore chapters")}
    ${dashCard("◉", "PYQ", "Previous year questions chapter-wise: practice and timed tests.", "", "pyq", "Explore PYQs")}
    ${dashCard("✦", "Revision Notes", "Chapter-wise revision notes and quick material.", "", "notes", "Explore notes")}
  </div>
  ${adSlot("dashboard")}
  ${attempts.length ? `<div class="row space"><div><span class="eyebrow">Your workspace</span><h2 class="section-title">Pick up where you left off</h2></div></div><section class="test-grid">${attempts.slice(0, 3).map((item) => dashboardAttemptCard(item)).join("")}</section>` : ""}`;
}
async function renderTestList(backAttr, backLabel) {
  await loadTests(state.selectedBatch);
  view.innerHTML = `<button class="back-control" ${backAttr}>← <span>${escape(backLabel)}</span></button><h1 class="page-title">Choose a test</h1><p class="sub">Each test saves separately on this browser. Submitted tests show analysis and restart options; unfinished tests can be continued.</p><section class="test-grid">${state.tests.map((test) => testCard(test, state.selectedBatch)).join("") || `<article class="card empty"><strong>No tests found</strong>This batch has no readable JSON files in the catalog.</article>`}</section>${adSlot("library")}`;
}
async function renderTests() {
  view.innerHTML = `<section class="loading-screen"><div class="spinner"></div><strong>Opening test library</strong><span>Loading your batch folders…</span></section>`;
  try {
    await loadBatches();
    if (!state.selectedBatch) {
      const full = state.batches.filter((batch) => !isChapterBatch(batch));
      view.innerHTML = `<button class="back-control" data-go-dashboard>← <span>Back to dashboard</span></button><span class="eyebrow">Full-length tests</span><h1 class="page-title">Your batches</h1><p class="sub">Open a batch folder to see its full-length CBT tests. Chapter-wise tests are in the Chapter Tests section.</p><section class="batch-groups">${batchGroupsHtml(full) || `<article class="card empty"><strong>No batch found</strong>Upload the JSON files and regenerate the API catalog.</article>`}</section>${adSlot("library")}`;
      return;
    }
    await renderTestList("data-back-batches", "All batches");
  } catch (error) {
    view.innerHTML = `<article class="card empty"><strong>Could not load tests</strong>${escape(error.message)}<br><br>Check the API URL in <code>config.js</code>, then redeploy the API catalog.</article>`;
  }
}
async function renderChapters() {
  view.innerHTML = `<section class="loading-screen"><div class="spinner"></div><strong>Opening chapter tests</strong><span>Loading chapters…</span></section>`;
  try {
    await loadBatches();
    const chapters = state.batches.filter((batch) => isChapterBatch(batch));
    const subjects = ["Physics", "Chemistry", "Biology", "Other"].filter((name) => chapters.some((batch) => chapterSubjectOf(batch) === name));
    const subject = subjects.includes(state.selectedChapterSubject) ? state.selectedChapterSubject : "";
    const inSubject = (name) => chapters.filter((batch) => chapterSubjectOf(batch) === name);
    const total = (list) => list.reduce((sum, batch) => sum + Number(batch.testCount || 0), 0);
    if (state.selectedBatch && chapters.some((batch) => batch.id === state.selectedBatch)) {
      const own = chapters.find((batch) => batch.id === state.selectedBatch);
      if (!subject && own) state.selectedChapterSubject = chapterSubjectOf(own);
      await renderTestList("data-back-chapters", `All ${chapterSubjectOf(own)} chapters`);
      return;
    }
    state.selectedBatch = "";
    if (!subject) {
      state.selectedChapterSubject = "";
      view.innerHTML = `<button class="back-control" data-go-dashboard>← <span>Back to dashboard</span></button><span class="eyebrow">Chapter-wise tests</span><h1 class="page-title">Chapter tests</h1><p class="sub">Choose a subject to see all of its chapter tests.</p><section class="folder-grid pyq-subject-grid">${subjects.map((name) => `<article class="folder-card pyq-subject-card"><div class="folder-copy"><span class="pyq-subject-icon">${escape(name.slice(0, 1))}</span><strong>${escape(name)}</strong><small>${inSubject(name).length} chapters · ${total(inSubject(name))} tests</small><button class="button primary explore-button" data-chapter-subject="${escape(name)}">Explore tests <span>→</span></button></div></article>`).join("") || `<article class="card empty"><strong>No chapter tests yet</strong>Chapter-wise tests have not been uploaded for this exam.</article>`}</section>${adSlot("library")}`;
      return;
    }
    const numeric = (x, y) => String(x.name).localeCompare(String(y.name), undefined, { numeric: true, sensitivity: "base" });
    const chapterCard = (batch) => {
      const count = Number(batch.testCount || 0);
      return `<article class="test-card pyq-chapter-card"><div class="test-card-top"><span class="tag">Chapter Tests</span><span class="test-status">${count} tests</span></div><h3>${escape(batch.name)}</h3><p>Chapter-wise CBT tests with instant analysis. Open the chapter and pick any test to begin.</p><div class="test-meta"><span>English</span><span>${count} tests</span></div><div class="card-actions"><button class="button primary explore-button" data-open-chapter="${escape(batch.id)}">Explore tests <span>→</span></button></div></article>`;
    };
    view.innerHTML = `<button class="back-control" data-back-chapter-subjects>← <span>All subjects</span></button><span class="eyebrow">${escape(subject)}</span><h1 class="page-title">Choose a chapter</h1><p class="sub">Every chapter has its own set of CBT tests.</p><section class="test-grid pyq-chapter-grid">${inSubject(subject).sort(numeric).map(chapterCard).join("") || `<article class="card empty"><strong>No chapters found</strong>This subject has no chapter tests yet.</article>`}</section>${adSlot("library")}`;
  } catch (error) {
    view.innerHTML = `<article class="card empty"><strong>Could not load chapters</strong>${escape(error.message)}</article>`;
  }
}

/* ---------- Instructions page ---------- */
async function showInstructions(batchId, testSlug) {
  view.innerHTML = `<section class="loading-screen"><div class="spinner"></div><strong>Loading instructions</strong><span>Preparing your test…</span></section>`;
  try {
    const first = await api(`/api/test?batch=${encodeURIComponent(batchId)}&test=${encodeURIComponent(testSlug)}`);
    const questions = (first.questions || []).map(normaliseQuestion);
    if (!questions.length) throw new Error("This test does not contain readable questions.");
    const batch = state.batches.find((item) => item.id === batchId);
    state.pending = { batchId, slug: testSlug, name: first.test?.name || testSlug, questions, hindi: /hindi/i.test(`${batchId} ${batch?.name || ""}`) };
    state.view = "cbt"; renderInstructions(); window.scrollTo(0, 0);
  } catch (error) { toast(error.message); state.view = backToLibraryView(batchId); state.pending = null; state.view === "chapters" ? renderChapters() : renderTests(); }
}
function renderInstructions() {
  const p = state.pending; if (!p) return renderTests();
  const minutes = Math.round(testDurationSeconds(p.questions.length) / 60);
  const maxMarks = p.questions.length * 4;
  const bySubject = new Map();
  p.questions.forEach((q) => { const key = q.subject || "General"; if (!bySubject.has(key)) bySubject.set(key, new Set()); if (q.topic && q.topic !== "General") bySubject.get(key).add(q.topic); });
  const syllabus = bySubject.size > 1
    ? [...bySubject.entries()].map(([name, topics]) => `<p><b>${escape(name)}:</b> ${escape([...topics].join(", ") || "—")}</p>`).join("")
    : `<p>${escape([...(bySubject.values().next().value || [])].join(", ") || p.name)}</p>`;
  const swatch = (cls, text) => `<div class="legend-row"><span class="qn ${cls}"></span><span>${text}</span></div>`;
  view.innerHTML = `<section class="ins-page"><div class="ins-head"><button class="button secondary" data-ins-back>← Back</button><h1>TEST INSTRUCTIONS</h1></div>
  <article class="card ins-card">
    <p class="ins-line">1. Total duration of <b>${escape(p.name)}</b> is <b>${minutes} min</b>.</p>
    <p class="ins-line">2. The test consists of <b>${p.questions.length} questions</b>. The maximum marks are <b>${maxMarks}</b>.</p>
    <ul class="ins-list">
      <li>The countdown timer at the top of the screen will display the remaining time available for you to complete the examination. When the timer reaches zero, the examination will end by itself. You will not be required to end or submit your examination.</li>
      <li>The question number strip displayed at the top of the screen will show the status of each question using one of the following symbols:</li>
    </ul>
    <div class="legend-box">${swatch("nv", "You have not visited the question yet.")}${swatch("na", "You have not answered the question.")}${swatch("an", "You have answered the question.")}${swatch("mk", "You have NOT answered the question, but have marked the question for review.")}${swatch("am", "The question(s) \"Answered and Marked for Review\" will be considered for evaluation.")}</div>
    <h3 class="ins-sub">Navigating to a Question:</h3>
    <ul class="ins-list">
      <li>Tap on a question number in the strip at the top to go to that question directly. You can also use the Previous and Next buttons.</li>
      <li>Tap the grid icon at the right end of the strip to see all question numbers at once.</li>
    </ul>
    <h3 class="ins-sub">Answering a Question:</h3>
    <ul class="ins-list">
      <li>To select your answer, click on the button of one of the options. Your answer is saved automatically.</li>
      <li>To change your chosen answer, click on the button of another option.</li>
      <li>To deselect your chosen answer, click on <b>Clear response</b>.</li>
      <li>To mark the question for review, click on the <b>Mark for review</b> button.</li>
      <li>To change your answer to a question that has already been answered, first select that question and then choose a different option.</li>
    </ul>
    <h3 class="ins-sub">Navigating through sections:</h3>
    <ul class="ins-list">
      <li>Sections in this question paper (if more than one) are displayed above the question number strip. Questions in a section can be viewed by clicking on the section name. The section you are currently viewing is highlighted.</li>
      <li>You can shuffle between sections and questions any time during the examination as per your convenience only during the time stipulated.</li>
      <li>Tap <b>Submit</b> at the top to see the Test Summary (answered, not answered, not visited, marked) before you submit.</li>
    </ul>
    <div class="ins-box"><h3>Syllabus</h3>${syllabus}</div>
    <div class="ins-box"><h3>Choose your default language</h3><select class="ins-select" id="insLang"><option>English</option></select><p class="ins-warn">Please note all questions will appear in your default language.</p></div>
  </article></section>
  <div class="ins-bar"><button class="button secondary" data-ins-back>‹ Previous</button><button class="button primary" data-ins-begin>I'm ready to begin</button></div>`;
}

/* ---------- Question number strip, grid, summary ---------- */
function activeSession() { return state.view === "pyq" ? state.pyqSession : state.attempt; }
function rerenderActive() { return state.view === "pyq" ? renderPyqSession() : renderCbt(); }
function persistActive() { return state.view === "pyq" ? persistPyqSession() : persistAttempt(); }
function isReviewSession(session) { return session === state.pyqSession ? Boolean(session.mode === "test" && session.reviewMode) : Boolean(session?.reviewMode); }
function markVisited(session, question) {
  if (!session.visited || typeof session.visited !== "object") session.visited = {};
  if (!session.visited[question.id]) { session.visited[question.id] = true; persistActive(); }
}
function sectionsOf(session) {
  const map = new Map();
  session.questions.forEach((question, index) => { const key = question.subject || "General"; if (!map.has(key)) map.set(key, []); map.get(key).push(index); });
  return [...map.entries()].map(([name, indices]) => ({ name, indices }));
}
function qStatus(session, index) {
  const question = session.questions[index]; const answer = session.answers[question.id];
  if (isReviewSession(session)) return answer === undefined ? "skipped" : answer === question.correctIndex ? "correct" : "incorrect";
  const marked = isMarkedForReview(session, question.id);
  if (answer !== undefined && marked) return "am";
  if (marked) return "mk";
  if (answer !== undefined) return "an";
  return session.visited?.[question.id] || index === session.current ? "na" : "nv";
}
function reviewMatches(session, index, filter) {
  if (filter === "all") return true;
  if (filter === "review") return isMarkedForReview(session, session.questions[index].id);
  return qStatus(session, index) === filter;
}
function visibleIndices(session) {
  const filter = isReviewSession(session) ? state.reviewFilter : "all";
  return session.questions.map((_, index) => index).filter((index) => reviewMatches(session, index, filter));
}
function positionInSection(session, index) {
  const section = sectionsOf(session).find((item) => item.indices.includes(index));
  return { pos: section ? section.indices.indexOf(index) + 1 : index + 1, size: section ? section.indices.length : session.questions.length, name: section?.name || "" };
}
const GRID_ICON = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="5" height="4" rx="1.5"/><rect x="9.5" y="3" width="5" height="4" rx="1.5"/><rect x="16" y="3" width="5" height="4" rx="1.5"/><rect x="3" y="10" width="5" height="4" rx="1.5"/><rect x="9.5" y="10" width="5" height="4" rx="1.5"/><rect x="16" y="10" width="5" height="4" rx="1.5"/><rect x="3" y="17" width="5" height="4" rx="1.5"/><rect x="9.5" y="17" width="5" height="4" rx="1.5"/><rect x="16" y="17" width="5" height="4" rx="1.5"/></svg>`;
function reviewFilterHtml(session) {
  const all = session.questions.map((_, index) => index);
  const count = (filter) => all.filter((index) => reviewMatches(session, index, filter)).length;
  const chip = (key, label) => `<button class="rf ${key} ${state.reviewFilter === key ? "active" : ""}" data-review-filter="${key}"><b>${count(key)}</b><span>${label}</span></button>`;
  return `<div class="rf-row">${chip("all", "All")}${chip("correct", "Correct")}${chip("incorrect", "Incorrect")}${chip("skipped", "Skipped")}${chip("review", "Review")}</div>`;
}
function navHtml(session) {
  const review = isReviewSession(session);
  const sections = sectionsOf(session); const visible = new Set(visibleIndices(session));
  let active = sections.findIndex((item) => item.indices.includes(session.current)); if (active < 0) active = 0;
  const tabs = sections.length > 1
    ? `<div class="sec-tabs">${sections.map((section, si) => (!review || section.indices.some((index) => visible.has(index))) ? `<button class="${si === active ? "active" : ""}" data-nav-section="${si}">${escape(section.name)}</button>` : "").join("")}</div>` : "";
  const strip = sections[active].indices.map((index, pos) => visible.has(index) ? `<button class="qn ${qStatus(session, index)} ${index === session.current ? "current" : ""}" data-nav-jump="${index}">${pos + 1}</button>` : "").join("");
  const gridBody = sections.map((section) => `${sections.length > 1 ? `<h4>${escape(section.name)}</h4>` : ""}<div class="qgrid">${section.indices.map((index, pos) => `<button class="qn ${qStatus(session, index)} ${index === session.current ? "current" : ""}" data-nav-jump="${index}">${pos + 1}</button>`).join("")}</div>`).join("");
  const legend = review
    ? `<span><i class="qn correct"></i>Correct</span><span><i class="qn incorrect"></i>Incorrect</span><span><i class="qn skipped"></i>Skipped</span>`
    : `<span><i class="qn an"></i>Answered</span><span><i class="qn na"></i>Not answered</span><span><i class="qn nv"></i>Not visited</span><span><i class="qn mk"></i>Marked</span><span><i class="qn am"></i>Answered &amp; marked</span>`;
  return `<div class="exam-nav">${review ? reviewFilterHtml(session) : ""}${tabs}<div class="qstrip-row"><div class="qstrip" id="qstrip">${strip || `<span class="qstrip-empty">No questions match this filter.</span>`}</div><button class="qgrid-btn" data-open-grid aria-label="Show all questions">${GRID_ICON}</button></div></div>
  <div class="qgrid-overlay" id="qGrid"><div class="qgrid-card"><div class="qgrid-head"><strong>All questions</strong><button class="icon-button small" data-close-grid aria-label="Close">×</button></div><div class="qgrid-legend">${legend}</div><div class="qgrid-scroll">${gridBody}</div></div></div>`;
}
function centerStrip() {
  const strip = $("#qstrip"), current = strip?.querySelector(".qn.current"); if (!strip || !current) return;
  strip.scrollLeft = current.offsetLeft - strip.clientWidth / 2 + current.clientWidth / 2;
}
function navMove(session, direction) {
  const visible = visibleIndices(session); if (!visible.length) return;
  const at = visible.indexOf(session.current);
  session.current = at < 0 ? visible[0] : visible[Math.min(Math.max(0, at + direction), visible.length - 1)];
}
function summaryCounts(session) {
  const counts = { total: session.questions.length, answered: 0, notAnswered: 0, notVisited: 0, marked: 0, answeredMarked: 0 };
  session.questions.forEach((question, index) => {
    const status = qStatus(session, index);
    if (status === "an") counts.answered++; else if (status === "na") counts.notAnswered++; else if (status === "nv") counts.notVisited++; else if (status === "mk") counts.marked++; else if (status === "am") counts.answeredMarked++;
  });
  return counts;
}
function openSummary() {
  const session = activeSession(); if (!session) return;
  $("#summaryModal")?.remove();
  const c = summaryCounts(session);
  const row = (cls, label, value) => `<div class="sum-row"><span>${cls ? `<i class="qn ${cls}"></i>` : ""}${label}</span><b>${value}</b></div>`;
  const modal = document.createElement("div"); modal.className = "summary-overlay"; modal.id = "summaryModal";
  modal.innerHTML = `<div class="summary-card"><h2>Test Summary</h2><p>Review before submitting</p><div class="sum-list">${row("", "Total Questions", c.total)}${row("an", "Answered", c.answered)}${row("na", "Not Answered", c.notAnswered)}${row("nv", "Not Visited", c.notVisited)}${row("mk", "Marked", c.marked)}${row("am", "Answered &amp; Marked", c.answeredMarked)}</div><div class="sum-actions"><button class="button secondary" data-close-summary>Resume Test</button><button class="button primary" data-confirm-submit>Submit Test</button></div></div>`;
  document.body.appendChild(modal);
}
function closeSummary() { $("#summaryModal")?.remove(); }

/* ---------- CBT ---------- */

function renderCbt() {
  const attempt = state.attempt;
  if (!attempt) return renderTests();
  if (attempt.submitted && !attempt.reviewMode) return renderResult();
  const question = attempt.questions[attempt.current]; const answer = attempt.answers[question.id];
  const review = Boolean(attempt.reviewMode);
  if (!review) markVisited(attempt, question);
  const where = positionInSection(attempt, attempt.current);
  const visible = visibleIndices(attempt); const at = visible.indexOf(attempt.current);
  const responseControls = !review
    ? `<div class="response-controls"><button class="button review-button ${isMarkedForReview(attempt, question.id) ? "active" : ""}" data-toggle-review>${isMarkedForReview(attempt, question.id) ? "Remove review mark" : "Mark for review"}</button><button class="button secondary" data-clear-response ${answer === undefined ? "disabled" : ""}>Clear response</button></div>`
    : "";
  const top = review
    ? `<div class="card cbt-top review-top"><div class="cbt-title"><small>TEST NAME</small><strong>${escape(attempt.testName)}</strong></div><div class="review-top-actions"><button class="button danger" data-exit-cbt>Leave Test</button><button class="button primary" data-result>Exit Solutions</button></div></div>`
    : `<div class="card cbt-top"><button class="button secondary" data-exit-cbt>Exit</button><div class="cbt-title"><small>${escape(attempt.batchName || attempt.batchId)}</small><strong>${escape(attempt.testName)}</strong></div><strong class="question-count">${escape(where.name)} · Q ${where.pos}/${where.size}</strong><span class="timer" id="timer">${formatTime(remainingTime())}</span><button class="button primary" data-open-summary>Submit</button></div>`;
  const optionBadge = (index) => {
    if (!review) return "";
    if (index === question.correctIndex) return `<span class="opt-badge ok">✓ Correct Answer</span>`;
    if (answer === index) return `<span class="opt-badge bad">✗ Your Answer</span>`;
    return "";
  };
  view.innerHTML = `<section class="cbt-shell">${top}${navHtml(attempt)}<article class="card question-card"><div class="question-head"><span>${escape(question.subject)} · ${escape(question.topic)}</span><div class="question-head-right"><span class="question-number">Question ${where.pos}</span><span>${escape(question.marks)} marks</span></div></div><div class="question-content">${safeHtml(question.prompt)}</div><div class="options">${question.options.map((option, index) => { const selected = answer === index; const cls = review ? (index === question.correctIndex ? "correct" : selected ? "incorrect" : "") : selected ? "selected" : ""; return `<button class="option ${cls}" data-answer="${index}" ${review ? "disabled" : ""}><span class="letter">${"ABCD"[index] || index + 1}</span><span class="option-text">${safeHtml(option)}</span>${optionBadge(index)}</button>`; }).join("")}</div>${review ? `<div class="solution-box"><div class="solution-heading"><h3>Solution</h3></div><div class="solution-content">${safeHtml(question.solution)}</div></div>` : ""}<div class="question-actions"><span>${review ? "Review each question and return to analysis when finished." : "Your answers save automatically on this device."}</span><div class="question-action-controls">${review ? "" : PALETTE_BTN}${responseControls}<div class="row"><button class="button secondary" data-nav-move="-1" ${at === 0 ? "disabled" : ""}>Previous</button><button class="button primary" data-nav-move="1" ${at === visible.length - 1 ? "disabled" : ""}>Next</button></div></div></div></article>${review ? "" : paletteHtml(attempt, "data-nav-jump")}</section>`;
  centerStrip(); typesetMath();
}
function scoreAttempt(attempt) {
  const total = attempt.questions.length; const answered = Object.keys(attempt.answers).length;
  const correct = attempt.questions.filter((question) => attempt.answers[question.id] === question.correctIndex).length;
  const incorrect = Math.max(0, answered - correct); const unattempted = total - answered;
  const subjects = Object.values(attempt.questions.reduce((grouped, question) => { const key = question.subject || "General"; (grouped[key] ||= []).push(question); return grouped; }, {})).map((questions) => ({ name: questions[0].subject || "General", total: questions.length, correct: questions.filter((question) => attempt.answers[question.id] === question.correctIndex).length }));
  return { total, answered, correct, incorrect, unattempted, accuracy: total ? Math.round(correct / total * 100) : 0, subjects };
}
function pdfText(value) {
  const doc = new DOMParser().parseFromString(textValue(value), "text/html");
  doc.querySelectorAll("img").forEach((image) => image.replaceWith(` ${image.getAttribute("alt") || "[diagram]"} `));
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}
function pdfFileName(value) { return String(value || "CBT Test").replace(/[\\/:*?"<>|]/g, "-").trim(); }
function exportProgressLegacy() {
  const attempt = state.attempt;
  if (!attempt?.submitted) return;
  const score = scoreAttempt(attempt);
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) { toast("Allow pop-ups once to export the PDF report."); return; }
  reportWindow.opener = null;
  const questionCards = attempt.questions.map((question, index) => {
    const selected = attempt.answers[question.id];
    const selectedHtml = selected === undefined ? "Unattempted" : `${"ABCD"[selected] || selected + 1}. ${safeHtml(question.options[selected])}`;
    const correctHtml = `${"ABCD"[question.correctIndex] || question.correctIndex + 1}. ${safeHtml(question.options[question.correctIndex])}`;
    return `<article class="question-card"><div class="question-meta"><span>${escape(question.subject)} · Question ${index + 1}</span><span>${escape(question.marks)} marks</span></div><div class="question-html">${safeHtml(question.prompt)}</div><div class="answer-grid"><section class="answer-box ${selected === question.correctIndex ? "is-correct" : "is-wrong"}"><small>Your answer</small><strong>${selectedHtml}</strong></section><section class="answer-box is-correct"><small>Correct answer</small><strong>${correctHtml}</strong></section></div><section class="solution-box"><h3>Solution</h3><div>${safeHtml(question.solution)}</div></section></article>`;
  }).join("");
  const title = escape(`${attempt.testName} - Progress Report`);
  reportWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;color:#172036;font-family:Arial,sans-serif;background:#fff}.watermark{position:fixed;top:42%;left:10%;z-index:-1;transform:rotate(-42deg);font:800 72px Arial;color:#eef0f8;letter-spacing:8px}.report-header{padding:22px 24px;border-radius:18px;background:linear-gradient(135deg,#5144ed,#7d45e8);color:white;margin-bottom:18px}.report-header h1{margin:0 0 7px;font-size:24px}.report-header p{margin:0;color:#eae8ff;font-size:13px}.score-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin:16px 0 20px}.stat{padding:12px;border:1px solid #dce3f0;border-radius:12px;background:#fafbff}.stat small{display:block;color:#69758e;font-size:10px;font-weight:bold;text-transform:uppercase}.stat strong{display:block;margin-top:5px;color:#5144ed;font-size:19px}.question-card{break-inside:avoid;page-break-inside:avoid;margin:0 0 14px;padding:18px;border:1px solid #dce3f0;border-radius:16px;background:#fff;box-shadow:0 5px 14px #1720360d}.question-meta{display:flex;justify-content:space-between;gap:12px;margin-bottom:12px;color:#61708e;font-size:11px;font-weight:bold}.question-html{font-size:13px;line-height:1.55}.question-html img,.solution-box img{max-width:100%;height:auto}.answer-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:15px 0}.answer-box{padding:11px 12px;border:1px solid #f0bcc4;border-radius:12px;background:#fff4f5;color:#a23042;font-size:12px}.answer-box.is-correct{border-color:#a7ddc1;background:#edfbf3;color:#16724d}.answer-box small{display:block;color:#69758e;font-size:10px;font-weight:bold;text-transform:uppercase}.answer-box strong{display:block;margin-top:5px;color:#172036;font-size:19px}.solution-box{padding:14px 16px;border-left:4px solid #16a46e;border-radius:10px;background:#edfbf3;color:#174e3a;font-size:12px;line-height:1.55}.solution-box h3{margin:0 0 8px;font-size:14px}@media print{.watermark{z-index:0}.report-header,.question-card,.stat{break-inside:avoid;page-break-inside:avoid}}@media(max-width:600px){.score-grid,.answer-grid{grid-template-columns:1fr}}</style></head><body><div class="watermark">CODEXSTUDYS</div><header class="report-header"><h1>Codexstudys - Progress Report</h1><p>${escape(attempt.testName)} · ${score.correct}/${score.total} correct · ${score.accuracy}% accuracy</p></header><section class="score-grid"><div class="stat"><small>Correct</small><strong>${score.correct}</strong></div><div class="stat"><small>Incorrect</small><strong>${score.incorrect}</strong></div><div class="stat"><small>Unattempted</small><strong>${score.unattempted}</strong></div><div class="stat"><small>Accuracy</small><strong>${score.accuracy}%</strong></div></section>${questionCards}<script>window.onload=async()=>{const imgs=[...document.images];await Promise.all(imgs.map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=i.onerror=r})));setTimeout(()=>window.print(),450)};<\/script></body></html>`);
  reportWindow.document.close();
  const watermarkStyle = reportWindow.document.createElement("style");
  watermarkStyle.textContent = ".watermark{color:#cfd3e2 !important;opacity:.11 !important;font-weight:700 !important;}@media print{.watermark{color:#cfd3e2 !important;opacity:.11 !important;}}";
  reportWindow.document.head.append(watermarkStyle);
  const saveButton = reportWindow.document.createElement("button");
  saveButton.type = "button"; saveButton.textContent = "Save as PDF";
  saveButton.setAttribute("aria-label", "Open the browser print dialog and save this progress report as a PDF");
  Object.assign(saveButton.style, { position: "fixed", right: "22px", bottom: "22px", zIndex: "20", border: "0", borderRadius: "12px", padding: "13px 18px", background: "linear-gradient(135deg, #5144ed, #7d45e8)", color: "#fff", boxShadow: "0 10px 24px rgba(81,68,237,.35)", cursor: "pointer", font: "800 14px Arial, sans-serif" });
  saveButton.addEventListener("click", () => reportWindow.print());
  reportWindow.document.body.append(saveButton);
  toast("Report opened. Click Save as PDF at the bottom-right.");
}
function exportProgress() {
  const attempt = state.attempt;
  if (!attempt?.submitted) return;
  const score = scoreAttempt(attempt);
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) { toast("Allow pop-ups once to export the PDF report."); return; }
  reportWindow.opener = null;
  const cards = attempt.questions.map((question, index) => {
    const selected = attempt.answers[question.id];
    const status = selected === undefined ? "Unattempted" : `Selected: ${"ABCD"[selected] || selected + 1}`;
    const options = question.options.map((option, optionIndex) => {
      const classes = ["option"];
      if (optionIndex === question.correctIndex) classes.push("correct");
      if (selected === optionIndex && optionIndex !== question.correctIndex) classes.push("wrong");
      return `<div class="${classes.join(" ")}"><span class="letter">${"ABCD"[optionIndex] || optionIndex + 1}</span><div>${safeHtml(option)}</div></div>`;
    }).join("");
    return `<article class="question-card"><span class="watermark">CODEXSTUDYS</span><div class="question-meta"><span>${escape(question.subject)} · Question ${index + 1}</span><span>${escape(question.marks)} marks</span></div><div class="question-html">${safeHtml(question.prompt)}</div><div class="answer-status"><span>Your response: <b>${escape(status)}</b></span><span>Correct option: <b>${"ABCD"[question.correctIndex] || question.correctIndex + 1}</b></span></div><div class="options-grid">${options}</div><section class="solution-box"><h3>Solution</h3><div>${safeHtml(question.solution)}</div></section></article>`;
  }).join("");
  reportWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escape(`${attempt.testName} - Progress Report`)}</title><style>@page{size:A4;margin:13mm}*{box-sizing:border-box}body{margin:0;color:#172036;font-family:Arial,sans-serif;background:#fff}.report-header{padding:20px 22px;border-radius:17px;background:linear-gradient(135deg,#5144ed,#7d45e8);color:#fff;margin-bottom:15px}.report-header h1{margin:0 0 6px;font-size:23px}.report-header p{margin:0;color:#efedff;font-size:12px}.score-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:0 0 17px}.stat{padding:10px 11px;border:1px solid #dce3f0;border-radius:11px;background:#fafbff}.stat small{display:block;color:#69758e;font-size:9px;font-weight:700;text-transform:uppercase}.stat strong{display:block;margin-top:4px;color:#5144ed;font-size:18px}.question-card{position:relative;overflow:hidden;break-inside:avoid;page-break-inside:avoid;margin:0 0 12px;padding:15px;border:1px solid #dce3f0;border-radius:15px;background:#fff;box-shadow:0 4px 12px #1720360b}.question-card>*:not(.watermark){position:relative;z-index:1}.watermark{position:absolute;z-index:0;top:43%;left:13%;transform:rotate(-35deg);color:#cfd3e2;opacity:.11;font:700 43px Arial;letter-spacing:6px}.question-meta{display:flex;justify-content:space-between;gap:10px;margin-bottom:10px;color:#61708e;font-size:10px;font-weight:700}.question-html{font-size:12px;line-height:1.52}.question-html img,.solution-box img,.option img{max-width:100%;height:auto}.answer-status{display:flex;gap:14px;flex-wrap:wrap;margin:12px 0 8px;padding:8px 10px;border-radius:9px;background:#f7f8ff;color:#55637e;font-size:10px}.answer-status b{color:#172036}.options-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.option{display:flex;align-items:center;gap:8px;min-height:45px;padding:9px;border:1px solid #dce3f0;border-radius:10px;background:#fff;font-size:11px;line-height:1.4}.letter{display:grid;place-items:center;flex:none;width:25px;height:25px;border:1px solid #cad3e7;border-radius:8px;color:#61708e;font-weight:700}.option.correct{border:1.5px solid #77cf9e;background:#edfbf3;color:#126b47}.option.correct .letter{border-color:#16a46e;background:#16a46e;color:#fff}.option.wrong{border:1.5px solid #f0aab4;background:#fff4f5;color:#a23042}.option.wrong .letter{border-color:#e24b5e;background:#e24b5e;color:#fff}.solution-box{margin-top:11px;padding:12px 13px;border-left:4px solid #16a46e;border-radius:9px;background:#edfbf3;color:#174e3a;font-size:11px;line-height:1.5}.solution-box h3{margin:0 0 7px;font-size:13px}.save-button{position:fixed;right:22px;bottom:22px;z-index:20;border:0;border-radius:12px;padding:13px 18px;background:linear-gradient(135deg,#5144ed,#7d45e8);color:#fff;box-shadow:0 10px 24px rgba(81,68,237,.35);cursor:pointer;font:800 14px Arial,sans-serif}@media print{.save-button{display:none}.watermark{color:#cfd3e2!important;opacity:.11!important}}@media(max-width:600px){.score-grid,.options-grid{grid-template-columns:1fr}}</style></head><body><header class="report-header"><h1>Codexstudys - Progress Report</h1><p>${escape(attempt.testName)} · ${score.correct}/${score.total} correct · ${score.accuracy}% accuracy</p></header><section class="score-grid"><div class="stat"><small>Correct</small><strong>${score.correct}</strong></div><div class="stat"><small>Incorrect</small><strong>${score.incorrect}</strong></div><div class="stat"><small>Unattempted</small><strong>${score.unattempted}</strong></div><div class="stat"><small>Accuracy</small><strong>${score.accuracy}%</strong></div></section>${cards}<button class="save-button" id="savePdf">Save as PDF</button><script>document.getElementById('savePdf').addEventListener('click',()=>window.print());<\/script></body></html>`);
  reportWindow.document.close();
  const printLayoutFix = reportWindow.document.createElement("style");
  printLayoutFix.textContent = ".watermark{z-index:2!important;color:#9fa7bd!important;opacity:.055!important;pointer-events:none!important}.question-card{break-inside:auto!important;page-break-inside:auto!important;margin-bottom:8px!important;padding:12px!important}.question-card.page-break-before{break-before:page!important;page-break-before:always!important}.question-meta,.question-html,.answer-status,.options-grid,.option,.solution-box{break-inside:avoid!important;page-break-inside:avoid!important}.options-grid{gap:6px!important}.solution-box{margin-top:8px!important;padding:10px 11px!important}";
  reportWindow.document.head.append(printLayoutFix);
  reportWindow.requestAnimationFrame(() => {
    const printableHeight = (297 - 26) * (96 / 25.4);
    const minimumStartSpace = 260;
    reportWindow.document.querySelectorAll(".question-card").forEach((card) => {
      const usedOnPage = card.offsetTop % printableHeight;
      if (printableHeight - usedOnPage < minimumStartSpace) card.classList.add("page-break-before");
    });
  });
  toast("Report opened. Click Save as PDF at the bottom-right.");
}
async function exportProgressDownload() {
  const attempt = state.attempt;
  if (!attempt?.submitted) return;
  if (!window.html2pdf) { toast("PDF exporter is loading. Please try again in a moment."); return; }
  const score = scoreAttempt(attempt);
  const report = document.createElement("section"); report.className = "export-report";
  report.innerHTML = `<header class="export-header"><h1>Codexstudys - Progress Report</h1><p>${escape(attempt.testName)} · ${score.correct}/${score.total} correct · ${score.accuracy}% accuracy</p></header><section class="export-score-grid"><div><small>Correct</small><strong>${score.correct}</strong></div><div><small>Incorrect</small><strong>${score.incorrect}</strong></div><div><small>Unattempted</small><strong>${score.unattempted}</strong></div><div><small>Accuracy</small><strong>${score.accuracy}%</strong></div></section>${attempt.questions.map((question, index) => {
    const selected = attempt.answers[question.id];
    const selectedHtml = selected === undefined ? "Unattempted" : `${"ABCD"[selected] || selected + 1}. ${safeHtml(question.options[selected])}`;
    const correctHtml = `${"ABCD"[question.correctIndex] || question.correctIndex + 1}. ${safeHtml(question.options[question.correctIndex])}`;
    return `<article class="export-question"><span class="export-watermark">CODEXSTUDYS</span><div class="export-question-meta"><span>${escape(question.subject)} · Question ${index + 1}</span><span>${escape(question.marks)} marks</span></div><div class="export-question-html">${safeHtml(question.prompt)}</div><div class="export-answer-grid"><section class="export-answer ${selected === question.correctIndex ? "correct" : "wrong"}"><small>Your answer</small><strong>${selectedHtml}</strong></section><section class="export-answer correct"><small>Correct answer</small><strong>${correctHtml}</strong></section></div><section class="export-solution"><h3>Solution</h3><div>${safeHtml(question.solution)}</div></section></article>`;
  }).join("")}`;
  document.body.append(report);
  toast("Generating your progress PDF… this may take a few seconds.");
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const images = [...report.querySelectorAll("img")];
  images.forEach((image) => { image.loading = "eager"; image.decoding = "sync"; });
  await Promise.all(images.map((image) => image.complete ? Promise.resolve() : Promise.race([
    new Promise((resolve) => { image.onload = image.onerror = resolve; }),
    new Promise((resolve) => setTimeout(resolve, 5000))
  ])));
  try {
    await window.html2pdf().set({ margin: 0, filename: `${pdfFileName(attempt.testName)} - Progress.pdf`, image: { type: "jpeg", quality: 0.93 }, html2canvas: { scale: 1.25, useCORS: true, allowTaint: false, logging: false }, jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }, pagebreak: { mode: ["css", "legacy"], avoid: [".export-question"] } }).from(report).save();
    toast("Progress PDF downloaded.");
  } catch (error) { console.error("Progress PDF export failed", error); toast("Could not export the PDF. Check your internet, then try again."); }
  finally { report.remove(); }
}
function renderResult() {
  const attempt = state.attempt; const score = scoreAttempt(attempt);
  view.innerHTML = `<section class="result-layout"><article class="card result-hero"><span class="tag">Test submitted</span><h1>${escape(attempt.testName)}</h1><p>Local attempt saved successfully. You can now inspect every solution, restart fresh, or download a detailed progress report.</p><div class="result-score"><strong>${score.correct}</strong><span>correct<br>out of ${score.total}</span></div><div class="result-actions large-actions"><button class="button secondary" data-review>View Solution</button><button class="button danger" data-restart>Restart</button><button class="button primary" data-export-progress>Export Progress</button></div></article><section class="score-grid"><article class="card score-card"><small>Correct</small><strong class="green-text">${score.correct}</strong></article><article class="card score-card"><small>Incorrect</small><strong class="red-text">${score.incorrect}</strong></article><article class="card score-card"><small>Unattempted</small><strong>${score.unattempted}</strong></article><article class="card score-card"><small>Accuracy</small><strong>${score.accuracy}%</strong></article></section><article class="card subject-analysis"><div><span class="eyebrow">Performance summary</span><h2>Subject-wise analysis</h2></div>${score.subjects.map((subject) => `<div class="subject-row"><span>${escape(subject.name)}</span><div class="subject-progress"><i style="width:${subject.total ? Math.round(subject.correct / subject.total * 100) : 0}%"></i></div><b>${subject.correct}/${subject.total}</b></div>`).join("")}</article></section>`;
}
function submitTest() {
  closeSummary(); exitExamFullscreen();
  state.attempt.submitted = true; state.attempt.reviewMode = false;
  const score = scoreAttempt(state.attempt); const history = getHistory().filter((item) => item.key !== attemptKey(state.attempt.batchId, state.attempt.testSlug));
  history.unshift({ key: attemptKey(state.attempt.batchId, state.attempt.testSlug), testName: state.attempt.testName, total: score.total, correct: score.correct, accuracy: score.accuracy, finishedAt: new Date().toISOString() });
  saveJson(historyKey(), history); persistAttempt(); renderResult();
}
function restartSaved(batch, slug) {
  const saved = attemptStatus(batch, slug); if (!saved) return;
  const key = attemptKey(batch, slug);
  const fresh = {
    ...saved, startedAt: Date.now(), durationSeconds: testDurationSeconds(saved.questions?.length),
    answers: {}, markedForReview: {}, visited: {}, current: 0, submitted: false, reviewMode: false
  };
  saveJson(historyKey(), getHistory().filter((item) => item.key !== key));
  localStorage.removeItem("neet-cbt:bookmarks");
  enterExamFullscreen(); state.attempt = fresh; persistAttempt(); state.view = "cbt"; saveBrowserRoute(); window.scrollTo(0, 0);
  toast(`Fresh attempt started. Timer reset to ${formatTime(fresh.durationSeconds)}.`); renderCbt();
}
function changeView(next, options = {}) {
  const { batch = "", noteSubject = "", noteChapter = "", noteMaterial = "", pdfBatch = "", pyqSubject = "", pyqChapter = "", pyqMode = "", pyqLanguage = "en", historyMode = "push", exam, chapterSubject = "" } = options;
  if (next === "home") setExam(""); else if (exam !== undefined) setExam(exam);
  state.view = next;
  if (next === "tests" || next === "chapters") state.selectedBatch = batch;
  if (next === "chapters") state.selectedChapterSubject = chapterSubject;
  if (next === "notes") {
    state.selectedNoteSubject = noteSubject;
    state.selectedNoteChapter = noteChapter;
    state.selectedNoteMaterial = noteMaterial;
  }
  if (next === "pdfs") state.selectedPdfBatch = pdfBatch;
  if (next === "pyq") {
    state.selectedPyqSubject = pyqSubject;
    state.selectedPyqChapter = pyqChapter;
    state.pyqMode = ["practice", "test"].includes(pyqMode) ? pyqMode : "";
    state.pyqLanguage = "en";
    state.pyqSession = null;
  }
  navActive(); closeDrawer();
  if (historyMode) saveBrowserRoute(historyMode);
  if (next === "home") { renderHome(); return window.scrollTo(0, 0); }
  if (next === "dashboard") {
    renderDashboard(); window.scrollTo(0, 0);
    loadBatches().then(() => { if (state.view === "dashboard") renderDashboard(); }).catch(() => {});
  }
  if (next === "chapters") renderChapters();
  if (next === "tests") renderTests();
  if (next === "notes") renderNotes();
  if (next === "pdfs") renderPdfs();
  if (next === "pyq") renderPyq();
}
function tick() {
  updateCountdown();
  if (state.attempt && !state.attempt.submitted && !state.attempt.reviewMode) {
    const timer = $("#timer"); if (timer) timer.textContent = formatTime(remainingTime()); if (remainingTime() === 0) submitTest();
  }
  const pyq = state.pyqSession;
  if (pyq?.mode === "test" && !pyq.submitted && !pyq.reviewMode) {
    const timer = $("#pyqTimer"); if (timer) timer.textContent = formatTime(pyqRemainingTime()); if (pyqRemainingTime() === 0) submitPyqTest();
  }
}

document.addEventListener("click", (event) => {
  const syllabusLink = event.target.closest("[data-syllabus]");
  if (syllabusLink) { event.preventDefault(); return openSyllabusModal(syllabusLink.href, syllabusLink.dataset.syllabusTitle); }
  const pdfLink = event.target.closest("[data-pdf]");
  if (pdfLink) { event.preventDefault(); return openSyllabusModal(pdfLink.href, pdfLink.dataset.pdfTitle); }
  if (event.target.classList?.contains("qgrid-overlay")) return event.target.classList.remove("open");
  const button = event.target.closest("button"); if (!button) return;
  if (button.dataset.goView) return changeView(button.dataset.goView);
  if (button.dataset.openChapter) return changeView("chapters", { batch: button.dataset.openChapter, chapterSubject: state.selectedChapterSubject });
  if (button.hasAttribute("data-back-chapters")) return changeView("chapters", { chapterSubject: state.selectedChapterSubject });
  if (button.hasAttribute("data-back-chapter-subjects")) { state.selectedChapterSubject = ""; saveBrowserRoute("replace"); return renderChapters(); }
  if (button.dataset.chapterSubject) { state.selectedChapterSubject = button.dataset.chapterSubject; saveBrowserRoute("replace"); return renderChapters(); }
  if (button.hasAttribute("data-ins-back")) { const id = state.pending?.batchId || ""; state.pending = null; return changeView(backToLibraryView(id), { batch: id, chapterSubject: state.selectedChapterSubject }); }
  if (button.hasAttribute("data-ins-begin")) { if (!state.pending) return; return startTest(state.pending.batchId, state.pending.slug); }
  if (button.hasAttribute("data-open-grid")) return $("#qGrid")?.classList.add("open");
  if (button.hasAttribute("data-close-grid")) return $("#qGrid")?.classList.remove("open");
  if (button.hasAttribute("data-open-summary")) return openSummary();
  if (button.hasAttribute("data-close-summary")) return closeSummary();
  if (button.hasAttribute("data-confirm-submit")) return state.view === "pyq" ? submitPyqTest() : submitTest();
  if (button.dataset.navJump !== undefined) { const session = activeSession(); if (!session) return; session.current = Number(button.dataset.navJump); persistActive(); return rerenderActive(); }
  if (button.dataset.navMove) { const session = activeSession(); if (!session) return; navMove(session, Number(button.dataset.navMove)); persistActive(); return rerenderActive(); }
  if (button.dataset.navSection !== undefined) {
    const session = activeSession(); if (!session) return;
    const section = sectionsOf(session)[Number(button.dataset.navSection)]; if (!section) return;
    const visible = new Set(visibleIndices(session));
    session.current = section.indices.find((index) => visible.has(index)) ?? section.indices[0]; persistActive(); return rerenderActive();
  }
  if (button.dataset.reviewFilter) {
    const session = activeSession(); if (!session) return;
    state.reviewFilter = button.dataset.reviewFilter;
    const visible = visibleIndices(session);
    if (!visible.length) toast("No questions match this filter."); else if (!visible.includes(session.current)) session.current = visible[0];
    return rerenderActive();
  }
  if (button.dataset.openExam) return changeView("dashboard", { exam: button.dataset.openExam });
  if (button.hasAttribute("data-change-exam")) { exitExamFullscreen(); return changeView("home"); }
  if (button.matches(".nav-link")) return changeView(button.dataset.view);
  if (button.dataset.action === "go-tests") return changeView("tests");
  if (button.hasAttribute("data-go-dashboard")) return changeView("dashboard");
  if (button.dataset.openBatch) return changeView("tests", { batch: button.dataset.openBatch });
  if (button.hasAttribute("data-back-batches")) return changeView("tests");
  if (button.dataset.openNoteSubject) return changeView("notes", { noteSubject: button.dataset.openNoteSubject });
  if (button.dataset.openNoteChapter) return changeView("notes", { noteSubject: state.selectedNoteSubject, noteChapter: button.dataset.openNoteChapter });
  if (button.dataset.openNoteMaterial) return changeView("notes", { noteSubject: state.selectedNoteSubject, noteChapter: state.selectedNoteChapter, noteMaterial: button.dataset.openNoteMaterial });
  if (button.hasAttribute("data-back-note-subjects")) return changeView("notes");
  if (button.hasAttribute("data-back-note-chapters")) return changeView("notes", { noteSubject: state.selectedNoteSubject });
  if (button.hasAttribute("data-back-note-materials")) return changeView("notes", { noteSubject: state.selectedNoteSubject, noteChapter: state.selectedNoteChapter });
  if (button.dataset.openPdfBatch) return changeView("pdfs", { pdfBatch: button.dataset.openPdfBatch });
  if (button.hasAttribute("data-back-pdf-batches")) return changeView("pdfs");
  if (button.dataset.openPyqSubject) return changeView("pyq", { pyqSubject: button.dataset.openPyqSubject });
  if (button.hasAttribute("data-back-pyq-subjects")) return changeView("pyq");
  if (button.hasAttribute("data-back-pyq-chapters")) return changeView("pyq", { pyqSubject: state.selectedPyqSubject });
  if (button.dataset.openPyqChapter) return changeView("pyq", { pyqSubject: state.selectedPyqSubject, pyqChapter: button.dataset.openPyqChapter, pyqMode: button.dataset.pyqMode || "" });
  if (button.dataset.selectPyqMode) { state.pyqMode = button.dataset.selectPyqMode; saveBrowserRoute(); return renderPyq(); }
  if (button.dataset.pyqLanguage) { state.pyqLanguage = button.dataset.pyqLanguage; saveBrowserRoute("replace"); return renderPyq(); }
  if (button.hasAttribute("data-start-pyq")) return startPyqSession();
  if (button.hasAttribute("data-pyq-clear-response") && state.pyqSession?.mode === "test" && !state.pyqSession.reviewMode) {
    const question = state.pyqSession.questions[state.pyqSession.current];
    delete state.pyqSession.answers[question.id]; persistPyqSession(); return renderPyqSession();
  }
  if (button.hasAttribute("data-pyq-toggle-review") && state.pyqSession?.mode === "test" && !state.pyqSession.reviewMode) {
    const question = state.pyqSession.questions[state.pyqSession.current]; const marks = reviewMarks(state.pyqSession);
    if (marks[question.id]) delete marks[question.id]; else marks[question.id] = true;
    persistPyqSession(); return renderPyqSession();
  }
  if (button.dataset.pyqAnswer !== undefined && state.pyqSession) {
    const question = state.pyqSession.questions[state.pyqSession.current];
    if (state.pyqSession.mode === "practice" && state.pyqSession.answers[question.id] !== undefined) return;
    state.pyqSession.answers[question.id] = Number(button.dataset.pyqAnswer); persistPyqSession(); return renderPyqSession();
  }
  if (button.dataset.pyqMove && state.pyqSession) { state.pyqSession.current = Math.min(Math.max(0, state.pyqSession.current + Number(button.dataset.pyqMove)), state.pyqSession.questions.length - 1); persistPyqSession(); return renderPyqSession(); }
  if (button.dataset.pyqJump !== undefined && state.pyqSession) { state.pyqSession.current = Number(button.dataset.pyqJump); persistPyqSession(); return renderPyqSession(); }
  if (button.hasAttribute("data-submit-pyq")) return submitPyqTest();
  if (button.hasAttribute("data-review-pyq") && state.pyqSession) { state.reviewFilter = "all"; state.pyqSession.reviewMode = true; persistPyqSession(); return renderPyqSession(); }
  if (button.hasAttribute("data-pyq-result") && state.pyqSession) { state.pyqSession.reviewMode = false; persistPyqSession(); return renderPyqResult(); }
  if (button.hasAttribute("data-restart-pyq")) return restartPyqSession();
  if (button.hasAttribute("data-exit-pyq")) { exitExamFullscreen(); state.pyqSession = null; return changeView("pyq", { pyqSubject: state.selectedPyqSubject, pyqChapter: state.selectedPyqChapter, pyqMode: state.pyqMode, pyqLanguage: state.pyqLanguage }); }
  if (button.dataset.startTest) { const [batch, slug] = button.dataset.startTest.split("|"); return attemptStatus(batch, slug) ? startTest(batch, slug) : showInstructions(batch, slug); }
  if (button.dataset.openSaved) { const [batch, slug] = button.dataset.openSaved.split("|"); return startTest(batch, slug, true); }
  if (button.dataset.openAnalysis) { const [batch, slug] = button.dataset.openAnalysis.split("|"); return startTest(batch, slug, false); }
  if (button.dataset.restartSaved) { const [batch, slug] = button.dataset.restartSaved.split("|"); return restartSaved(batch, slug); }
  if (button.hasAttribute("data-clear-response") && state.attempt && !state.attempt.reviewMode) {
    const question = state.attempt.questions[state.attempt.current];
    delete state.attempt.answers[question.id]; persistAttempt(); return renderCbt();
  }
  if (button.hasAttribute("data-toggle-review") && state.attempt && !state.attempt.reviewMode) {
    const question = state.attempt.questions[state.attempt.current]; const marks = reviewMarks(state.attempt);
    if (marks[question.id]) delete marks[question.id]; else marks[question.id] = true;
    persistAttempt(); return renderCbt();
  }
  if (button.dataset.answer !== undefined && !state.attempt?.reviewMode) { const question = state.attempt.questions[state.attempt.current]; state.attempt.answers[question.id] = Number(button.dataset.answer); persistAttempt(); return renderCbt(); }
  if (button.dataset.move) { state.attempt.current = Math.min(Math.max(0, state.attempt.current + Number(button.dataset.move)), state.attempt.questions.length - 1); return renderCbt(); }
  if (button.dataset.jump !== undefined) { state.attempt.current = Number(button.dataset.jump); return renderCbt(); }
  if (button.hasAttribute("data-open-palette")) return $("#paletteDrawer")?.classList.add("open");
  if (button.hasAttribute("data-close-palette")) return $("#paletteDrawer")?.classList.remove("open");
  if (button.hasAttribute("data-submit")) return submitTest();
  if (button.hasAttribute("data-review")) { state.reviewFilter = "all"; state.attempt.reviewMode = true; persistAttempt(); return renderCbt(); }
  if (button.hasAttribute("data-result")) { state.attempt.reviewMode = false; return renderResult(); }
  if (button.hasAttribute("data-restart")) return restartSaved(state.attempt.batchId, state.attempt.testSlug);
  if (button.hasAttribute("data-export-progress")) return exportProgress();
  if (button.hasAttribute("data-exit-cbt")) { exitExamFullscreen(); return changeView(backToLibraryView(state.attempt?.batchId), { batch: state.attempt?.batchId || "", chapterSubject: state.selectedChapterSubject }); }
});
document.addEventListener("error", (event) => {
  if (event.target instanceof HTMLImageElement && event.target.dataset.formulaAlt !== undefined) replaceUnavailableImage(event.target);
}, true);
$("#menuButton").addEventListener("click", () => { $("#sidebar").classList.add("open"); $("#drawerBackdrop").classList.add("show"); });
$("#drawerBackdrop").addEventListener("click", closeDrawer);

$("#closePdfModal").addEventListener("click", closeSyllabusModal);
$("#pdfModal").addEventListener("click", (event) => { if (event.target.id === "pdfModal") closeSyllabusModal(); });
$(".telegram-link").href = TELEGRAM_URL;
$(".whatsapp-link").href = window.CBT_CONFIG?.whatsappUrl || "#";
$("#telegramTopLink").href = TELEGRAM_URL;
window.addEventListener("popstate", () => {
  exitExamFullscreen();
  const route = routeFromBrowser();
  changeView(route.view, { exam: route.exam, batch: route.batch, noteSubject: route.noteSubject, noteChapter: route.noteChapter, noteMaterial: route.noteMaterial, pdfBatch: route.pdfBatch, pyqSubject: route.pyqSubject, pyqChapter: route.pyqChapter, pyqMode: route.pyqMode, pyqLanguage: route.pyqLanguage, chapterSubject: route.chapterSubject, historyMode: null });
});
localStorage.removeItem("neet-cbt:bookmarks");
setTheme(state.theme);
(async () => {
  await loadExams();
  const initialRoute = routeFromBrowser();
  if (initialRoute.exam && !state.exams.some((item) => item.id === initialRoute.exam)) { initialRoute.exam = ""; initialRoute.view = "home"; }
  changeView(initialRoute.view, { exam: initialRoute.exam, batch: initialRoute.batch, noteSubject: initialRoute.noteSubject, noteChapter: initialRoute.noteChapter, noteMaterial: initialRoute.noteMaterial, pdfBatch: initialRoute.pdfBatch, pyqSubject: initialRoute.pyqSubject, pyqChapter: initialRoute.pyqChapter, pyqMode: initialRoute.pyqMode, pyqLanguage: initialRoute.pyqLanguage, chapterSubject: initialRoute.chapterSubject, historyMode: "replace" });
})();
setInterval(tick, 1000);

/* ---------- Modals, theme picker and animation effects (from cww-main) ---------- */
const $$ = (selector) => [...document.querySelectorAll(selector)];
function openModal(id) {
  const modal = document.getElementById(id); if (!modal) return;
  $$(".overlay.visible").forEach((other) => { if (other.id !== id) other.classList.remove("visible"); });
  modal.classList.add("visible"); document.body.classList.add("modal-open");
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove("visible");
  if (!$$(".overlay.visible").length) document.body.classList.remove("modal-open");
}
document.addEventListener("click", (event) => {
  const closer = event.target.closest("[data-close]"); if (closer) return closeModal(closer.dataset.close);
  if (event.target.classList?.contains("overlay")) closeModal(event.target.id);
});
document.addEventListener("keydown", (event) => { if (event.key === "Escape") $$(".overlay.visible").forEach((modal) => closeModal(modal.id)); });
function setupThemePicker() {
  const markActive = () => $$(".theme-option").forEach((option) => option.classList.toggle("active", option.dataset.theme === state.theme));
  $("#themeButton")?.addEventListener("click", () => { markActive(); openModal("themeModal"); });
  $$(".theme-option").forEach((option) => option.addEventListener("click", () => { setTheme(option.dataset.theme); markActive(); }));
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { if (state.theme === "system") setTheme("system"); });
  const root = document.documentElement;
  const bind = (id, key, attr, onValue) => {
    const toggle = document.getElementById(id); if (!toggle) return;
    const apply = (on) => { toggle.setAttribute("aria-checked", String(on)); if (on) root.setAttribute(attr, onValue); else root.removeAttribute(attr); };
    apply(localStorage.getItem(key) === "true");
    toggle.addEventListener("click", () => { const on = toggle.getAttribute("aria-checked") !== "true"; localStorage.setItem(key, String(on)); apply(on); });
  };
  bind("contrastToggle", "codex-studys-contrast", "data-contrast", "high");
  bind("motionToggle", "codex-studys-reduced-motion", "data-reduced-motion", "true");
}


setupThemePicker();


/* ---------- Install as web app (PWA) — permanent button + modal (like cww) ---------- */
(function setupInstall() {
  let deferred = null;
  const standalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); deferred = event; refresh(); });
  const buttons = () => [document.getElementById("installBtn"), document.getElementById("installSideBtn")].filter(Boolean);
  const hideIfInstalled = () => { if (standalone()) buttons().forEach((b) => { b.hidden = true; }); };
  function refresh() {
    const action = document.getElementById("installActionBtn"), steps = document.getElementById("iosInstallSteps"), body = document.getElementById("installBody");
    if (!action) return;
    if (deferred) { action.style.display = ""; steps.style.display = "none"; body.textContent = "Add Codexstudys to your home screen for a faster, app-like experience."; }
    else { action.style.display = "none"; steps.style.display = "grid"; body.textContent = isIos ? "Safari me Share (⬆) dabao, phir Add to Home Screen." : "Is browser me direct install option nahi mila — menu se install karo."; }
  }
  buttons().forEach((b) => b.addEventListener("click", async () => {
    if (deferred) { const ev = deferred; deferred = null; ev.prompt(); await ev.userChoice.catch(() => {}); refresh(); return; }
    refresh(); openModal("installModal");
  }));
  document.getElementById("installActionBtn")?.addEventListener("click", async () => {
    if (!deferred) return;
    deferred.prompt(); await deferred.userChoice.catch(() => {}); deferred = null; closeModal("installModal"); refresh();
  });
  window.addEventListener("appinstalled", () => { deferred = null; closeModal("installModal"); hideIfInstalled(); });
  hideIfInstalled(); refresh();
})();

document.addEventListener("change", (event) => {
  if (event.target?.id !== "cdDateInput") return;
  const value = event.target.value;
  try { if (value) localStorage.setItem(examDateKey(), value); else localStorage.removeItem(examDateKey()); } catch (e) {}
  if (state.view === "dashboard") renderDashboard();
});
