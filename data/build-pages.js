/* =========================================================================
   OWASP Flagship Projects — page-shell generator (Node, zero deps)

   Reads data/data.js and writes one thin .html per SITE_PAGES entry at the repo
   root. Each shell is minimal (<body data-page> + <main id="page">); shell.js
   injects the chrome and app.js renders the page. We enrich each <head> with
   per-page SEO / Open Graph / Twitter / JSON-LD so crawlers and shares work
   before any JS runs.

   Run:  node data/build-pages.js
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE_URL = "https://tingwei161803.github.io/owasp/";

global.window = {};
require(path.join(__dirname, "data.js"));
const META = window.SITE_META;
const PAGES = window.SITE_PAGES;

const siteTitle = META.title.zh;
function attr(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/"/g, "&quot;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function fileFor(p) { return p.slug === "home" ? "index.html" : p.slug + ".html"; }

function jsonLd(p, file, pageTitle, desc) {
  var url = SITE_URL + (p.slug === "home" ? "" : file);
  if (p.slug === "home") {
    return {
      "@context": "https://schema.org", "@type": "WebSite",
      name: siteTitle, url: SITE_URL, description: desc, inLanguage: ["zh-Hant", "en"]
    };
  }
  return {
    "@context": "https://schema.org",
    "@type": p.layout === "article" ? "TechArticle" : "WebPage",
    headline: pageTitle, name: pageTitle, url: url, description: desc, inLanguage: ["zh-Hant", "en"],
    isPartOf: { "@type": "WebSite", name: siteTitle, url: SITE_URL }
  };
}

function shell(p) {
  var file = fileFor(p);
  var canonical = SITE_URL + (p.slug === "home" ? "" : file);
  var pageTitleZh = p.slug === "home" ? siteTitle : (p.title.zh + " · " + siteTitle);
  var pageTitleEn = p.slug === "home" ? META.title.en : (p.title.en + " · " + META.title.en);
  // description: bilingual, zh first (site default), trimmed
  var subZh = (p.subtitle && p.subtitle.zh) || META.subtitle.zh;
  var subEn = (p.subtitle && p.subtitle.en) || META.subtitle.en;
  var desc = (subZh + " | " + subEn).slice(0, 300);
  var ld = JSON.stringify(jsonLd(p, file, p.title.zh, subZh));

  return `<!DOCTYPE html>
<html lang="zh" data-theme="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>${attr(pageTitleZh)}</title>
  <meta name="description" content="${attr(desc)}" />
  <meta name="theme-color" content="#6750A4" />
  <link rel="icon" href="favicon.svg" type="image/svg+xml" />
  <link rel="canonical" href="${attr(canonical)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${attr(siteTitle)}" />
  <meta property="og:title" content="${attr(pageTitleZh)}" />
  <meta property="og:description" content="${attr(subZh)}" />
  <meta property="og:url" content="${attr(canonical)}" />
  <meta property="og:locale" content="zh_TW" />
  <meta property="og:locale:alternate" content="en_US" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${attr(pageTitleEn)}" />
  <meta name="twitter:description" content="${attr(subEn)}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Flex:opsz,wght@8..144,400..700&family=Noto+Sans+TC:wght@400;500;700&display=swap" rel="stylesheet" />
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="assets/styles.css" />
  <script type="application/ld+json">${ld}</script>
</head>
<body data-page="${attr(p.slug)}">
  <!-- shell.js injects the app bar, cross-page nav, footer and dialog around this -->
  <main id="page"></main>

  <script src="data/data.js"></script>
  <script src="assets/shell.js"></script>
  <script src="assets/app.js"></script>
</body>
</html>
`;
}

var written = [];
PAGES.forEach(function (p) {
  var file = fileFor(p);
  fs.writeFileSync(path.join(ROOT, file), shell(p), "utf8");
  written.push(file);
});
console.log("wrote " + written.length + " pages: " + written.join(", "));
