/* =========================================================================
   OWASP Flagship Projects — data merge step (Node, zero deps)

   Reads the 11 per-project research files in data/research/*.json (raw output
   from the research agents, which used slightly different shapes) and emits a
   single canonical data/data.js with window.SITE_META + window.SITE_PAGES for
   the lazy-data2web multipage engine.

   Run:  node data/build-data.js     (re-runnable; data/data.js is generated)
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");

const RESEARCH = path.join(__dirname, "research");

/* ----- site-level config ----- */
const SITE_META = {
  title:    { en: "OWASP Flagship Projects", zh: "OWASP 旗艦專案導覽" },
  subtitle: { en: "A detailed, bilingual field guide to eleven OWASP flagship projects.",
              zh: "十一個 OWASP 旗艦專案的詳盡雙語導覽。" },
  footer:   { en: "Unofficial educational guide · content © OWASP under each project's own license · built with lazy-data2web (static, no build).",
              zh: "非官方教育用導覽 · 內容著作權屬 OWASP,依各專案授權條款 · 以 lazy-data2web 建置(純靜態、無建置流程)。" }
};

const CATEGORIES = [
  { key: "guide",        en: "Guides & Standards", zh: "指南與標準" },
  { key: "ai",           en: "AI Security",        zh: "AI 安全" },
  { key: "supply-chain", en: "Supply Chain / SBOM",zh: "供應鏈 / SBOM" },
  { key: "tool",         en: "Tools",              zh: "工具" }
];
const CAT_LABEL = {};
CATEGORIES.forEach(c => { CAT_LABEL[c.key] = { en: c.en, zh: c.zh }; });

/* nav / card / table order — grouped by category */
const ORDER = [
  "top-ten", "asvs", "wstg", "mas", "samm",
  "genai-security", "ai-exchange",
  "cyclonedx",
  "dependency-track", "juice-shop", "crs"
];

/* fallback section headings (only used when a research file omits a heading) */
const HEADINGS_BY_ID = {
  overview:    { en: "Overview",                  zh: "概述" },
  core:        { en: "Core content",              zh: "核心內容" },
  levels:      { en: "Verification levels",       zh: "驗證等級" },
  methodology: { en: "Methodology",               zh: "方法論" },
  concepts:    { en: "Key concepts",              zh: "核心概念" },
  components:  { en: "Components",                 zh: "組成元件" },
  initiatives: { en: "Initiatives & working groups", zh: "計畫與工作組" },
  standards:   { en: "Standards alignment",       zh: "標準對接" },
  datasources: { en: "Data sources",              zh: "資料來源" },
  ecosystem:   { en: "Ecosystem & tooling",       zh: "生態系與工具" },
  challenges:  { en: "Challenges",                 zh: "挑戰系統" },
  assessment:  { en: "Assessment",                zh: "評估與藍圖" },
  usage:       { en: "How it's used",             zh: "使用情境" },
  history:     { en: "History & versions",        zh: "沿革與版本" },
  resources:   { en: "Resources",                 zh: "資源連結" }
};

/* ----- normalizers (tolerate every agent shape) ----- */
function asLang(x) {
  if (x == null) return { en: "", zh: "" };
  if (typeof x === "string") return { en: x, zh: x };
  return { en: x.en || x.zh || "", zh: x.zh || x.en || "" };
}
function asLangList(en, zh) {
  en = Array.isArray(en) ? en : [];
  zh = Array.isArray(zh) ? zh : [];
  // pad the shorter side so en/zh stay index-aligned
  const n = Math.max(en.length, zh.length);
  const oen = [], ozh = [];
  for (let i = 0; i < n; i++) { oen.push(en[i] != null ? en[i] : (zh[i] || "")); ozh.push(zh[i] != null ? zh[i] : (en[i] || "")); }
  return { en: oen, zh: ozh };
}
function normBlock(b) {
  if (b.type === "ul") {
    const src = b.items || b;            // items:{en,zh}  OR  en/zh directly on block
    return { type: "ul", items: asLangList(src.en, src.zh) };
  }
  if (b.type === "links") {
    const arr = b.links || b.items || (Array.isArray(b.en) ? b.en : []);
    return { type: "links", links: arr.map(e => ({ label: asLang(e.label), url: String(e.url || "") })) };
  }
  // p / h3 / quote / code
  const text = b.text !== undefined ? b.text : { en: b.en, zh: b.zh };
  return { type: b.type, text: asLang(text) };
}
function normSection(s) {
  const heading = s.heading || s.title || HEADINGS_BY_ID[s.id] || { en: s.id, zh: s.id };
  return { id: s.id, heading: asLang(heading), blocks: (s.blocks || []).map(normBlock) };
}

/* ----- load + normalize each project ----- */
const projects = ORDER.map(slug => {
  const raw = JSON.parse(fs.readFileSync(path.join(RESEARCH, slug + ".json"), "utf8"));
  return {
    slug: raw.slug || slug,
    layout: "article",
    icon: raw.icon,
    category: raw.category,
    tags: raw.tags || [],
    title: asLang(raw.title),
    subtitle: asLang(raw.subtitle),
    meta: {
      type:     asLang(raw.meta.type),
      latest:   asLang(raw.meta.latest),
      audience: asLang(raw.meta.audience),
      format:   asLang(raw.meta.format),
      license:  String(raw.meta.license || ""),
      url:      String(raw.meta.url || "")
    },
    sections: (raw.sections || []).map(normSection)
  };
});

/* ----- validate ----- */
const seen = new Set();
let problems = 0;
projects.forEach(p => {
  if (seen.has(p.slug)) { console.error("DUP slug:", p.slug); problems++; }
  seen.add(p.slug);
  if (!CAT_LABEL[p.category]) { console.error("bad category:", p.slug, p.category); problems++; }
  p.sections.forEach(s => s.blocks.forEach(b => {
    if (b.type === "ul" && b.items.en.length !== b.items.zh.length) { console.error("ul mismatch:", p.slug, s.id); problems++; }
  }));
});
if (problems) { console.error("ABORT:", problems, "problem(s)"); process.exit(1); }

/* ----- build SITE_PAGES ----- */
const home = {
  slug: "home", layout: "hub", icon: "verified_user",
  title:    { en: "OWASP Flagship Projects", zh: "OWASP 旗艦專案" },
  subtitle: { en: "Eleven of OWASP's flagship projects — the standards, guides and tools that define modern application security. Search or filter by category, then open any card for a detailed bilingual breakdown.",
              zh: "十一個 OWASP 旗艦專案——定義現代應用程式安全的標準、指南與工具。可搜尋或依分類篩選,再點任一張卡片查看詳盡的雙語解說。" },
  stats: [
    { value: 11,  label: { en: "Flagship projects", zh: "旗艦專案" } },
    { value: 4,   label: { en: "Categories",        zh: "主題分類" } },
    { value: 25,  label: { en: "Years of OWASP",    zh: "OWASP 年資" } }
  ],
  categories: CATEGORIES
};

const compare = {
  slug: "compare", layout: "table", icon: "table_chart",
  title:    { en: "Compare all projects", zh: "專案對照表" },
  subtitle: { en: "Every project side by side — category, type, latest release and official site. Sort any column or filter by category.",
              zh: "所有專案並列比較——類別、類型、最新版本與官方網站。可點欄位排序或依類別篩選。" },
  columns: [
    { key: "name",   label: { en: "Project",       zh: "專案" },     type: "text" },
    { key: "cat",    label: { en: "Category",      zh: "類別" },     type: "tag", filter: true },
    { key: "type",   label: { en: "Type",          zh: "類型" },     type: "text" },
    { key: "latest", label: { en: "Latest release",zh: "最新版本" }, type: "text" },
    { key: "url",    label: { en: "Official site", zh: "官方網站" }, type: "link" }
  ],
  rows: projects.map(p => ({
    name:   p.title,
    cat:    CAT_LABEL[p.category],
    type:   p.meta.type,
    latest: p.meta.latest,
    url:    p.meta.url
  }))
};

const pages = [home, compare].concat(projects);

/* ----- emit data/data.js (JSON object literals = valid JS, no escaping pitfalls) ----- */
const banner =
`/* =========================================================================
   data/data.js  —  GENERATED by data/build-data.js. DO NOT EDIT BY HAND.
   Source of truth: data/research/<slug>.json  (re-run: node data/build-data.js)

   window.SITE_META  : site title / subtitle / footer (bilingual)
   window.SITE_PAGES : one entry per .html page (home hub + compare table + 11
                       project article pages). Each visible string is {en,zh}.
   ========================================================================= */
`;
const out =
  banner +
  "\nwindow.SITE_META = " + JSON.stringify(SITE_META, null, 2) + ";\n" +
  "\nwindow.SITE_PAGES = " + JSON.stringify(pages, null, 2) + ";\n";

fs.writeFileSync(path.join(__dirname, "data.js"), out, "utf8");
console.log("wrote data/data.js :", pages.length, "pages,", projects.length, "projects,", (out.length / 1024).toFixed(1) + "KB");
