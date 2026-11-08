/* =========================================================================
   multipage · shell.js   (vanilla, no build)

   The SHARED CHROME for every page: app bar, cross-page nav, footer and the
   detail <dialog>. It also owns global state (language + theme) and exposes a
   tiny toolkit on window.LDW that each page's app.js reuses.

   Loaded on EVERY page BEFORE app.js. It:
     1. reads the language from <html lang> and the theme from localStorage,
     2. injects app bar + nav + footer + dialog around <main id="page">,
     3. wires the theme toggle and points the language link at this page's
        counterpart in the other language,
     4. highlights the current page (from <body data-page="...">).

   Language belongs to the URL, not to the visitor: the Chinese pages live at
   the root and the English ones under /en/, so switching language is a
   navigation rather than an in-place repaint. Theme still persists in
   localStorage (an origin-wide store) and survives moving between pages.
   ========================================================================= */
(function () {
  "use strict";

  var META = window.SITE_META || { title: {}, subtitle: {}, footer: {} };
  var PAGES = Array.isArray(window.SITE_PAGES) ? window.SITE_PAGES : [];

  /* ---------- source repo (linked from the footer; no API call, so nothing
     can fail or be rate-limited on page load) ---------- */
  var REPO_URL = "https://github.com/tingwei161803/owasp";

  /* ---------- chrome i18n (page content strings live in the data) ---------- */
  var I18N = {
    en: { close: "Close", menu: "Site", skip: "Skip to content", home: "Home", compare: "Compare",
          projects: "Projects", theme: "Toggle dark mode", source: "Source on GitHub" },
    zh: { close: "關閉", menu: "網站導覽", skip: "跳到內容", home: "首頁", compare: "對照表",
          projects: "專案", theme: "切換深色模式", source: "GitHub 原始碼" }
  };

  /* ---------- inline icons (replaces the Material Symbols icon font) ---------- */
  function svg(d, extra) {
    return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || "") + ">" + d + "</svg>";
  }
  var ICON = {
    moon:  '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
    sun:   '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
    down:  '<path d="m6 9 6 6 6-6"/>',
    ext:   '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    home:  '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1Z"/>',
    search:'<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'
  };
  var LINKEDIN = '<svg class="icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z"/></svg>';
  var GITHUB = '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z"/></svg>';
  /* three book spines in the four category colours */
  var MARK = '<svg class="brand__mark" viewBox="0 0 32 32" aria-hidden="true">' +
    '<rect x="3" y="7" width="6" height="21" fill="var(--s-guide)"/>' +
    '<rect x="10" y="4" width="6" height="24" fill="var(--s-ai)"/>' +
    '<rect x="17" y="9" width="5" height="19" fill="var(--s-sbom)"/>' +
    '<rect x="22.6" y="6.6" width="5.6" height="21.5" fill="var(--s-tool)" transform="rotate(8 25.4 28)"/>' +
    '<rect x="1" y="28" width="30" height="2.4" fill="var(--ink)"/></svg>';

  /* ---------- sandbox-safe localStorage ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  /* ---------- global state ----------
     The URL decides the language, so <html lang> is what we read. localStorage
     must not seed it: a crawler has no localStorage and would always be handed
     the fallback, which is how one half of the site ended up with no address of
     its own — and why a first-time reader of the Chinese pages was shown
     English. Writing the choice back is gone too; the address carries it now. */
  function langFromDocument() {
    var declared = (document.documentElement.getAttribute("lang") || "en").toLowerCase();
    return declared.indexOf("zh") === 0 ? "zh" : "en";
  }

  /* the same page in the other language — mirror the path, never guess */
  var TWIN_DIR = "/en";
  function altLangHref() {
    var path = location.pathname || "/";
    if (path === TWIN_DIR || path.indexOf(TWIN_DIR + "/") === 0) {
      return path.slice(TWIN_DIR.length) || "/";
    }
    return TWIN_DIR + path;
  }

  /* no saved choice → follow the system setting (and keep following it) */
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  var saved = lsGet("theme");
  var state = {
    lang:  langFromDocument(),
    theme: saved === "dark" || saved === "light" ? saved : (mq && mq.matches ? "dark" : "light"),
    themeChosen: saved === "dark" || saved === "light"
  };

  /* ---------- helpers shared with app.js ---------- */
  function t(obj) {
    if (obj == null) return "";
    if (typeof obj === "string") return obj;
    return obj[state.lang] || obj.en || obj.zh || "";
  }
  function ui(key) { return (I18N[state.lang] || I18N.en)[key]; }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }
  function r(n) { return Math.round(n * 100) / 100; }

  function pageHref(p) { return p.slug === "home" ? "index.html" : p.slug + ".html"; }
  function currentSlug() { return document.body.getAttribute("data-page") || "home"; }
  function currentPage() {
    var slug = currentSlug();
    for (var i = 0; i < PAGES.length; i++) if (PAGES[i].slug === slug) return PAGES[i];
    return PAGES[0] || null;
  }

  /* =======================================================================
     CHROME INJECTION — app bar, nav, footer, dialog around <main id="page">
     ===================================================================== */
  function injectChrome() {
    var main = document.getElementById("page");
    if (!main) return;

    /* skip link */
    var skip = document.createElement("a");
    skip.className = "skip-link";
    skip.href = "#page";
    skip.id = "skipLink";
    document.body.insertBefore(skip, document.body.firstChild);

    /* app bar: brand · 首頁 · 對照表 · 專案 ▾ · language · theme */
    var appbar = document.createElement("header");
    appbar.className = "appbar";
    appbar.innerHTML =
      '<div class="appbar__inner">' +
        '<a class="brand" href="index.html">' + MARK +
          '<span class="brand__name" id="brandName"></span>' +
        '</a>' +
        '<nav class="mainnav" id="pageNav"></nav>' +
        '<div class="appbar__tools">' +
          '<a class="icon-btn" id="langToggle" href="' + escapeHtml(altLangHref()) + '" ' +
             'hreflang="' + (state.lang === "en" ? "zh-Hant" : "en") + '" rel="alternate" ' +
             'lang="' + (state.lang === "en" ? "zh-Hant" : "en") + '" ' +
             'aria-label="' + (state.lang === "en" ? "切換到中文版 / View in Chinese" : "View in English / 切換到英文版") + '">' +
            '<span id="langLabel"></span>' +
          '</a>' +
          '<button class="icon-btn" id="themeToggle" type="button" aria-label="' + escapeHtml(ui("theme")) + '">' +
            '<span id="themeIcon"></span>' +
          '</button>' +
        '</div>' +
      '</div>';
    document.body.insertBefore(appbar, main);

    /* footer — the static "English version / 中文版" link that each HTML file
       carries (so crawlers and no-JS readers still get it) is moved in here */
    var footer = document.createElement("footer");
    footer.className = "footer";
    footer.innerHTML = '<div class="footer__inner"><p class="footer__text" id="footerText"></p>' +
      '<div class="footer__links" id="footerLinks">' +
        '<a class="icon-btn" href="https://www.peteraim.com" target="_blank" rel="noopener" title="peteraim.com" aria-label="Back to peteraim.com / 返回首頁">' +
          svg(ICON.home) + '</a>' +
        '<a class="icon-btn" href="https://www.linkedin.com/in/ai-med/" target="_blank" rel="noopener" title="LinkedIn" aria-label="LinkedIn (opens in new tab)">' +
          LINKEDIN + '</a>' +
        '<a class="icon-btn" href="' + REPO_URL + '" target="_blank" rel="noopener" title="GitHub" aria-label="' + escapeHtml(ui("source")) + '">' +
          GITHUB + '</a>' +
      '</div></div>';
    main.parentNode.insertBefore(footer, main.nextSibling);
    var alt = document.querySelector("body > .lang-alt-link");
    if (alt) { alt.removeAttribute("style"); document.getElementById("footerLinks").insertBefore(alt, document.getElementById("footerLinks").firstChild); }

    /* shared detail dialog (used by card layouts) */
    var dialog = document.createElement("dialog");
    dialog.className = "dialog";
    dialog.id = "dialog";
    dialog.setAttribute("aria-labelledby", "dialogTitle");
    dialog.innerHTML =
      '<div class="dialog__bar">' +
        '<span class="dialog__spacer"></span>' +
        '<button class="icon-btn" id="dialogClose" type="button" aria-label="Close / 關閉">' +
          svg(ICON.close) +
        '</button>' +
      '</div>' +
      '<div class="dialog__body" id="dialogBody"></div>';
    document.body.appendChild(dialog);

    /* dialog wiring (shared close behaviour; deep links handled by app.js) */
    document.getElementById("dialogClose").addEventListener("click", function () {
      if (dialog.open) dialog.close();
    });
    dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
  }

  var CAT_ORDER = ["guide", "ai", "supply-chain", "tool"];
  function catLabel(key) {
    var home = PAGES.filter(function (p) { return p.slug === "home"; })[0] || {};
    var c = (home.categories || []).filter(function (c) { return c.key === key; })[0];
    return c ? (c[state.lang] || c.en) : key;
  }

  /* three destinations instead of thirteen pills: the projects live in a
     disclosure panel grouped by shelf, so no label is ever cut off */
  function paintNav() {
    var nav = document.getElementById("pageNav");
    if (!nav) return;
    var here = currentSlug();
    var hereIsProject = here !== "home" && here !== "compare";
    function top(slug, label) {
      return '<a class="mainnav__link" href="' + (slug === "home" ? "index.html" : slug + ".html") + '"' +
        (here === slug ? ' aria-current="page"' : "") + ">" + escapeHtml(label) + "</a>";
    }
    var groups = CAT_ORDER.map(function (key) {
      var items = PAGES.filter(function (p) { return p.category === key; }).map(function (p) {
        return '<li><a href="' + pageHref(p) + '"' + (p.slug === here ? ' aria-current="page"' : "") + ">" +
          escapeHtml(t(p.title)) + '<span class="mono">' + escapeHtml(p.callno || "") + "</span></a></li>";
      }).join("");
      return '<div class="projmenu__group cat-' + key + '"><h2>' + escapeHtml(catLabel(key)) + "</h2><ul>" + items + "</ul></div>";
    }).join("");
    nav.innerHTML = top("home", ui("home")) + top("compare", ui("compare")) +
      '<details class="projmenu' + (hereIsProject ? " projmenu--here" : "") + '" id="projMenu">' +
        "<summary>" + escapeHtml(ui("projects")) + svg(ICON.down) + "</summary>" +
        '<div class="projmenu__panel">' + groups + "</div>" +
      "</details>";
  }
  function wireMenu() {
    var menu = document.getElementById("projMenu");
    if (!menu) return;
    document.addEventListener("click", function (e) {
      if (menu.open && !menu.contains(e.target)) menu.open = false;
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.open) { menu.open = false; menu.querySelector("summary").focus(); }
    });
  }

  /* ---------- chrome text in the active language ---------- */
  function refreshChrome() {
    var page = currentPage();
    var siteTitle = t(META.title);
    /* the hub is the site, so it is titled with the site name alone — in English
       the two strings are identical and appending one to the other read as a
       stutter once each language had its own <title> in the static HTML. */
    var pageTitle = page && page.slug !== "home" ? t(page.title) : "";
    document.title = pageTitle ? pageTitle + " · " + siteTitle : siteTitle;

    var brand = document.getElementById("brandName");
    if (brand) brand.textContent = siteTitle;
    var foot = document.getElementById("footerText");
    if (foot) foot.textContent = t(META.footer);
    var skip = document.getElementById("skipLink");
    if (skip) skip.textContent = ui("skip");
    paintNav();
    var nav = document.getElementById("pageNav");
    if (nav) nav.setAttribute("aria-label", ui("menu"));
    var dc = document.getElementById("dialogClose");
    if (dc) dc.setAttribute("aria-label", ui("close"));
  }

  /* =======================================================================
     THEME + LANGUAGE
     ===================================================================== */
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.theme);
    var icon = document.getElementById("themeIcon");
    if (icon) icon.innerHTML = svg(state.theme === "dark" ? ICON.sun : ICON.moon);
    var btn = document.getElementById("themeToggle");
    if (btn) btn.setAttribute("aria-pressed", state.theme === "dark" ? "true" : "false");
  }
  /* The toggle is a link now, so it is labelled with the language it leads TO,
     not the one already on screen. */
  function applyLangChrome() {
    var label = document.getElementById("langLabel");
    if (label) label.textContent = state.lang === "en" ? "中" : "EN";
  }

  function wire() {
    document.getElementById("themeToggle").addEventListener("click", function () {
      state.theme = state.theme === "dark" ? "light" : "dark";
      state.themeChosen = true;
      lsSet("theme", state.theme);   // only an explicit choice is remembered
      applyTheme();
    });
    if (mq) {
      var follow = function (e) { if (!state.themeChosen) { state.theme = e.matches ? "dark" : "light"; applyTheme(); } };
      if (mq.addEventListener) mq.addEventListener("change", follow); else if (mq.addListener) mq.addListener(follow);
    }
    wireMenu();
  }

  /* =======================================================================
     PUBLIC TOOLKIT (app.js uses this)
     ===================================================================== */
  window.LDW = {
    ready: false,          // flipped true once the chrome (incl. #dialog) is injected
    state: state,
    t: t, ui: ui, escapeHtml: escapeHtml, r: r, svg: svg, icon: ICON, catLabel: catLabel,
    lsGet: lsGet, lsSet: lsSet,
    pages: PAGES, meta: META,
    currentPage: currentPage, currentSlug: currentSlug, pageHref: pageHref,
    refreshChrome: refreshChrome,
    dialog: function () { return document.getElementById("dialog"); }
  };

  /* =======================================================================
     INIT
     ===================================================================== */
  function init() {
    injectChrome();
    applyTheme();
    applyLangChrome();
    refreshChrome();
    wire();
    window.LDW.ready = true;
    document.dispatchEvent(new CustomEvent("ldw:shell-ready"));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
