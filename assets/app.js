/* =========================================================================
   multipage · app.js   (vanilla, no build, no chart lib)

   The PAGE-LEVEL LAYOUT ENGINE. shell.js has already injected the shared
   chrome and published window.LDW. This script:

     1. reads the current page from <body data-page="..."> (via LDW),
     2. picks a renderer from RENDERERS by that page's `layout`,
     3. paints it into <main id="page"> and wires its interactions.

   The language comes from the URL (see shell.js), so the body is painted once
   per page load — there is no in-place language switch to subscribe to.

   RENDERERS is the LAYOUT REGISTRY — one entry per supported page layout:
     hub | gallery | article | dashboard | timeline | table |
     bento | kanban | faq | comparison | leaderboard | scrolly | map
   To add a layout, add one renderer (returns the inner HTML for #page) and,
   if it needs interaction, one matching WIRE entry. Nothing else changes.
   ========================================================================= */
(function () {
  "use strict";

  function boot() {
    // Wait until shell.js has injected the chrome (app bar, nav, footer, #dialog)
    // and published LDW. End-of-body scripts run while readyState === "loading",
    // so the shell defers its injection to DOMContentLoaded — we must wait for it.
    if (!window.LDW || !window.LDW.ready) {
      document.addEventListener("ldw:shell-ready", boot, { once: true });
      return;
    }
    var L = window.LDW;

    var t = L.t, esc = L.escapeHtml, r = L.r;
    var pageEl = document.getElementById("page");
    var teardowns = [];   // observers / listeners to disconnect before each repaint

    /* ---------- shared bits ---------- */
    function head(p) {
      var sub = t(p.subtitle)
        ? '<p class="page-head__sub">' + esc(t(p.subtitle)) + "</p>" : "";
      return '<header class="page-head"><h1>' + esc(t(p.title)) + "</h1>" + sub + "</header>";
    }

    /* ---- the library vocabulary shared by the hub, compare and project pages ---- */
    var en = L.state.lang === "en";
    var ext = L.svg(L.icon.ext);
    function projects() { return L.pages.filter(function (q) { return q.slug !== "home" && q.category; }); }
    function catLabel(key) { return L.catLabel(key); }
    function host(u) { try { return new URL(u).host.replace(/^www\./, ""); } catch (e) { return u; } }
    /* "thicker" books are the longer entries on this site; series (category)
       share a height, the way a publisher's series does on a real shelf */
    var SERIES_H = { guide: 100, ai: 88, "supply-chain": 80, tool: 93 };
    function entryLength(q) {
      var n = 0;
      (q.sections || []).forEach(function (s) {
        (s.blocks || []).forEach(function (b) {
          if (b.text) n += (b.text.en || "").length;
          if (b.items && b.items.en) n += b.items.en.join(" ").length;
        });
      });
      return n;
    }
    function shelfMetrics(list) {
      var lens = list.map(entryLength);
      var lo = Math.min.apply(null, lens), hi = Math.max.apply(null, lens), span = (hi - lo) || 1;
      return list.map(function (q, i) {
        return { w: r(1 + 0.9 * (lens[i] - lo) / span), h: SERIES_H[q.category] || 90 };
      });
    }

    /* project page header: a library catalogue card */
    function catCard(p) {
      var m = p.meta || {};
      var rows = [
        { k: en ? "Type" : "類型", v: t(m.type) },
        { k: en ? "Edition" : "最新版本", v: t(m.latest) },
        { k: en ? "Licence" : "授權", v: m.license },
        { k: en ? "Readers" : "適用對象", v: t(m.audience), wide: true },
        { k: en ? "Format" : "形式", v: t(m.format), wide: true }
      ].filter(function (x) { return x.v; });
      var fields = rows.map(function (x) {
        return '<div' + (x.wide ? ' class="f-wide"' : "") + "><dt>" + esc(x.k) + "</dt><dd>" + esc(x.v) + "</dd></div>";
      }).join("");
      var link = m.url ?
        '<div class="catcard__foot"><a class="borrow" href="' + esc(m.url) + '" target="_blank" rel="noopener">' +
          esc(en ? "Borrow it at the official site" : "到官方網站借閱") + ext + "</a>" +
          '<span class="catcard__host">' + esc(host(m.url)) + "</span></div>" : "";
      return '<header class="catcard">' +
        '<div class="catcard__top"><span class="catcard__call">' + esc(p.callno || "") + "</span>" +
          '<a class="catcard__cat" href="index.html#shelf-' + esc(p.category) + '">' + esc(catLabel(p.category)) + "</a></div>" +
        "<h1>" + esc(t(p.title)) + "</h1>" +
        (t(p.subtitle) ? '<p class="catcard__sub">' + esc(t(p.subtitle)) + "</p>" : "") +
        '<dl class="catcard__fields">' + fields + "</dl>" + link +
      "</header>";
    }

    /* right-hand column of a project page: its shelf-mates + the whole shelf */
    function related(p) {
      var all = projects();
      var mates = all.filter(function (q) { return q.category === p.category; });
      var li = mates.map(function (q) {
        var here = q.slug === p.slug;
        return '<li><a class="rel cat-' + esc(q.category) + (here ? " rel--here" : "") + '" href="' + esc(L.pageHref(q)) + '"' +
          (here ? ' aria-current="page"' : "") + "><span><b>" + esc(t(q.title)) + "</b><small>" + esc(q.callno || "") + "</small></span></a></li>";
      }).join("");
      var met = shelfMetrics(all);
      var mini = all.map(function (q, i) {
        return '<a class="cat-' + esc(q.category) + '" href="' + esc(L.pageHref(q)) + '" style="--h:' + met[i].h + '%" title="' +
          esc(t(q.title)) + '" aria-label="' + esc(t(q.title)) + '"' + (q.slug === p.slug ? ' aria-current="page"' : "") + "></a>";
      }).join("");
      return '<aside class="related" aria-label="' + (en ? "Related projects" : "相關專案") + '">' +
        "<section><h2>" + esc(en ? "On the same shelf" : "同一層書架") + " · " + esc(catLabel(p.category)) + "</h2><ul>" + li + "</ul></section>" +
        "<section><h2>" + esc(en ? "The whole shelf" : "整排書架") + '</h2><div class="minishelf">' + mini + "</div></section>" +
      "</aside>";
    }

    function pager(p) {
      var all = projects(), i = all.map(function (q) { return q.slug; }).indexOf(p.slug);
      if (i < 0) return "";
      var prev = all[(i - 1 + all.length) % all.length], next = all[(i + 1) % all.length];
      return '<nav class="pager" aria-label="' + (en ? "Previous and next project" : "上一本與下一本") + '">' +
        '<a href="' + esc(L.pageHref(prev)) + '" rel="prev"><small>' + (en ? "Previous on the shelf" : "書架上的前一本") + "</small><b>" + esc(t(prev.title)) + "</b></a>" +
        '<a href="' + esc(L.pageHref(next)) + '" rel="next"><small>' + (en ? "Next on the shelf" : "書架上的下一本") + "</small><b>" + esc(t(next.title)) + "</b></a>" +
      "</nav>";
    }

    function legend(id, counts) {
      var keys = ["guide", "ai", "supply-chain", "tool"];
      var total = 0; keys.forEach(function (k) { total += counts[k] || 0; });
      return '<div class="legend" id="' + id + '" role="group" aria-label="' + (en ? "Filter by category" : "依分類篩選") + '">' +
        '<button class="legend__btn legend__btn--all" type="button" data-cat="" aria-pressed="true"><span class="legend__sw" aria-hidden="true"></span>' +
          esc(en ? "All" : "全部") + ' <span class="legend__n">' + total + "</span></button>" +
        keys.map(function (k) {
          return '<button class="legend__btn cat-' + k + '" type="button" data-cat="' + k + '" aria-pressed="false" id="shelf-' + k + '">' +
            '<span class="legend__sw" aria-hidden="true"></span>' + esc(catLabel(k)) + ' <span class="legend__n">' + (counts[k] || 0) + "</span></button>";
        }).join("") + "</div>";
    }
    function countByCat(list) {
      var c = {}; list.forEach(function (q) { c[q.category] = (c[q.category] || 0) + 1; }); return c;
    }
    function searchBox(id, ph) {
      return '<label class="searchbox">' + L.svg(L.icon.search) +
        '<input id="' + id + '" class="search" type="search" autocomplete="off" placeholder="' + esc(ph) + '" aria-label="' + esc(ph) + '" /></label>';
    }
    function wireLegend(box, onPick) {
      var btns = [].slice.call(box.querySelectorAll(".legend__btn"));
      btns.forEach(function (b) {
        b.addEventListener("click", function () {
          btns.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
          onPick(b.dataset.cat || "");
        });
      });
      return function select(cat) {
        btns.forEach(function (x) { x.setAttribute("aria-pressed", (x.dataset.cat || "") === cat ? "true" : "false"); });
        onPick(cat);
      };
    }

    function barChart(series, accent) {
      var W = 520, H = 240, padL = 16, padR = 16, padT = 16, padB = 44;
      var plotW = W - padL - padR, plotH = H - padT - padB;
      var max = Math.max.apply(null, series.map(function (d) { return d.value; }).concat([1]));
      var n = series.length || 1, gap = 14, bw = (plotW - gap * (n - 1)) / n, baseY = padT + plotH;
      var bars = series.map(function (d, i) {
        var x = padL + i * (bw + gap), h = (d.value / max) * plotH, y = baseY - h;
        var label = esc(t(d.label)), val = esc(String(d.value));
        return '<rect class="bar-rect" x="' + r(x) + '" y="' + r(y) + '" width="' + r(bw) +
          '" height="' + r(h) + '" rx="5"' + (accent ? ' style="fill:' + esc(accent) + '"' : "") +
          '><title>' + label + ": " + val + "</title></rect>" +
          '<text class="bar-value" x="' + r(x + bw / 2) + '" y="' + r(y - 6) + '" text-anchor="middle">' + val + "</text>" +
          '<text class="bar-label" x="' + r(x + bw / 2) + '" y="' + r(baseY + 18) + '" text-anchor="middle">' + label + "</text>";
      }).join("");
      return '<svg viewBox="0 0 ' + W + " " + H + '" role="img" preserveAspectRatio="xMidYMid meet" aria-label="bar chart">' +
        '<line class="axis-line" x1="' + padL + '" y1="' + r(baseY) + '" x2="' + r(W - padR) + '" y2="' + r(baseY) + '" />' +
        bars + "</svg>";
    }

    function lineChart(points) {
      var W = 520, H = 240, padL = 28, padR = 16, padT = 16, padB = 32;
      var plotW = W - padL - padR, plotH = H - padT - padB;
      var ys = points.map(function (d) { return d.y; });
      var max = Math.max.apply(null, ys.concat([1])), min = Math.min.apply(null, ys.concat([0]));
      var span = (max - min) || 1, n = points.length || 1;
      var xy = points.map(function (d, i) {
        var x = padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
        var y = padT + plotH - ((d.y - min) / span) * plotH;
        return { x: x, y: y, d: d };
      });
      var path = xy.map(function (pt, i) { return (i ? "L" : "M") + r(pt.x) + " " + r(pt.y); }).join(" ");
      var area = path + " L" + r(xy[xy.length - 1].x) + " " + r(padT + plotH) + " L" + r(xy[0].x) + " " + r(padT + plotH) + " Z";
      var dots = xy.map(function (pt) {
        return '<circle class="line-dot" cx="' + r(pt.x) + '" cy="' + r(pt.y) + '" r="3"><title>' +
          esc(String(pt.d.x)) + ": " + esc(String(pt.d.y)) + "</title></circle>";
      }).join("");
      var labels = xy.map(function (pt) {
        return '<text class="bar-label" x="' + r(pt.x) + '" y="' + r(padT + plotH + 20) + '" text-anchor="middle">' + esc(String(pt.d.x)) + "</text>";
      }).join("");
      return '<svg viewBox="0 0 ' + W + " " + H + '" role="img" preserveAspectRatio="xMidYMid meet" aria-label="line chart">' +
        '<path class="line-area" d="' + area + '" />' +
        '<path class="line-path" d="' + path + '" fill="none" />' + dots + labels + "</svg>";
    }

    /* the last slot of the catalogue: a pointer to the side-by-side register */
    function registerCard() {
      return '<a class="icard icard--register" href="compare.html">' +
        '<span class="icard__top"><span class="icard__call">REG.ALL</span></span>' +
        '<h3 class="icard__title">' + esc(en ? "All eleven, side by side" : "十一本並排比較") + "</h3>" +
        '<p class="icard__sum">' + esc(en ? "The register lists every project's category, type, latest edition and official site in one sortable table."
          : "對照表把每個專案的類別、類型、最新版本與官方網站排成一張可排序的表。") + "</p>" +
        '<span class="icard__go">' + esc(en ? "Open the register" : "打開對照表") + "</span>" +
      "</a>";
    }

    function indexCard(q) {
      var m = q.meta || {};
      return '<a class="icard cat-' + esc(q.category) + '" data-item href="' + esc(L.pageHref(q)) + '">' +
        '<span class="icard__top"><span class="icard__call">' + esc(q.callno || "") + "</span>" +
          '<span class="icard__cat">' + esc(catLabel(q.category)) + "</span></span>" +
        '<h3 class="icard__title">' + esc(t(q.title)) + "</h3>" +
        '<p class="icard__sum">' + esc(t(q.subtitle)) + "</p>" +
        '<dl class="icard__fields">' +
          (t(m.latest) ? "<div><dt>" + (en ? "Edition" : "版次") + "</dt><dd>" + esc(t(m.latest)) + "</dd></div>" : "") +
          ((q.tags || []).length ? "<div><dt>" + (en ? "Subjects" : "主題") + "</dt><dd>" + esc((q.tags || []).join(", ")) + "</dd></div>" : "") +
        "</dl>" +
        '<span class="icard__hole" aria-hidden="true"></span>' +
      "</a>";
    }

    /* =====================================================================
       LAYOUT REGISTRY
       ===================================================================== */
    var RENDERERS = {

      /* ---- hub: hero stats + searchable / filterable project cards ----
         Cards are real <a href> links to each project's detail page. The grid
         is painted + filtered in WIRE.hub so search/chips can re-run it. */
      hub: function (p) {
        var list = projects(), met = shelfMetrics(list);
        var line = (p.stats || []).map(function (s) {
          return "<span>" + esc((t(s.line) || "{n} " + t(s.label)).replace("{n}", String(s.value))) + "</span>";
        }).join("");
        var spines = list.map(function (q, i) {
          return '<li style="--w:' + met[i].w + ';--i:' + i + '"><a class="spine cat-' + esc(q.category) + '" data-cat="' + esc(q.category) + '" ' +
            'href="' + esc(L.pageHref(q)) + '" style="--h:' + met[i].h + '%" title="' + esc(t(q.title)) + '">' +
            '<span class="spine__name" aria-hidden="true">' + esc(q.short || t(q.title)) + "</span>" +
            '<span class="spine__label" aria-hidden="true"><b>' + esc((q.callno || "").split(".")[0]) + "</b>" + esc((q.callno || "").split(".")[1] || "") + "</span>" +
            '<span class="sr-only">' + esc(t(q.title)) + "</span>" +
          "</a></li>";
        }).join("");
        return '<section class="hero" aria-labelledby="heroTitle">' +
            '<div class="hero__text">' +
              '<p class="catline">' + line + "</p>" +
              '<h1 class="hero__title" id="heroTitle">' + (t(p.headline) || t(p.title)).split("\n").map(function (ln) { return "<span>" + esc(ln) + "</span>"; }).join("") + "</h1>" +
              '<p class="hero__sub">' + esc(t(p.subtitle)) + "</p>" +
            "</div>" +
            '<div class="shelfwrap">' +
              '<ul class="shelf" id="hubShelf" aria-label="' + (en ? "The shelf: eleven OWASP flagship projects" : "書架：十一個 OWASP 旗艦專案") + '">' + spines + "</ul>" +
              '<div class="board" aria-hidden="true"></div>' +
              legend("hubChips", countByCat(list)) +
            "</div>" +
          "</section>" +
          '<section class="catalogue" aria-labelledby="catTitle">' +
            '<div class="catalogue__head">' +
              '<div><h2 id="catTitle">' + (en ? "The card catalogue" : "館藏目錄卡") + "</h2>" +
              '<p class="catalogue__note">' + (en ? "One card per project. Open a card for the full entry." : "一個專案一張卡，點開看完整條目。") + "</p></div>" +
              searchBox("hubSearch", en ? "Search the catalogue…" : "搜尋館藏…") +
              '<p class="result-count" id="hubCount" aria-live="polite"></p>' +
            "</div>" +
            '<div class="cards" id="hubGrid">' + list.map(indexCard).join("") + registerCard() + "</div>" +
          "</section>";
      },

      /* ---- gallery: search + chips + card grid + dialog ---- */
      gallery: function (p) {
        var cats = (p.categories || []).map(function (c) {
          return '<button class="chip" type="button" data-cat="' + esc(c.key) + '">' +
            esc(c[L.state.lang] || c.en) + "</button>";
        }).join("");
        var allLabel = L.state.lang === "en" ? "All" : "全部";
        return head(p) +
          '<div class="toolbar">' +
            '<input id="search" class="search" type="search" autocomplete="off" ' +
              'placeholder="' + (L.state.lang === "en" ? "Search…" : "搜尋…") + '" ' +
              'aria-label="' + (L.state.lang === "en" ? "Search" : "搜尋") + '" />' +
            (cats ? '<div class="chips"><button class="chip chip--active" type="button" data-cat="">' + esc(allLabel) + "</button>" + cats + "</div>" : "") +
          "</div>" +
          '<p class="result-count" id="resultCount" aria-live="polite"></p>' +
          '<div class="grid" id="grid"></div>';
      },

      /* ---- article: meta strip + sticky TOC + prose + reading progress ---- */
      article: function (p) {
        var toc = (p.sections || []).map(function (s) {
          return '<a class="toc-link" href="#' + esc(s.id) + '" data-toc="' + esc(s.id) + '">' + esc(t(s.heading)) + "</a>";
        }).join("");
        var body = (p.sections || []).map(function (s) {
          var blocks = (s.blocks || []).map(function (b) {
            if (b.type === "h3") return "<h3>" + esc(t(b.text)) + "</h3>";
            if (b.type === "quote") return "<blockquote>" + esc(t(b.text)) + "</blockquote>";
            if (b.type === "code") return "<pre><code>" + esc(t(b.text)) + "</code></pre>";
            if (b.type === "ul") {
              var arr = (b.items && (b.items[L.state.lang] || b.items.en || b.items.zh)) || [];
              return "<ul>" + arr.map(function (li) { return "<li>" + esc(li) + "</li>"; }).join("") + "</ul>";
            }
            if (b.type === "links") {
              var ls = (b.links || []).map(function (l) {
                return '<li><a class="reslink" href="' + esc(l.url) + '" target="_blank" rel="noopener">' +
                  "<span>" + esc(t(l.label)) + "</span>" + ext + "</a></li>";
              }).join("");
              return '<ul class="reslinks">' + ls + "</ul>";
            }
            return "<p>" + esc(t(b.text)) + "</p>";
          }).join("");
          return '<section class="article-section" id="' + esc(s.id) + '" data-item ' +
            'aria-labelledby="' + esc(s.id) + '-h"><h2 id="' + esc(s.id) + '-h">' + esc(t(s.heading)) + "</h2>" + blocks + "</section>";
        }).join("");
        return '<div class="reading-progress" id="readingProgress" aria-hidden="true"></div>' +
          catCard(p) +
          '<div class="article-layout">' +
            '<nav class="toc" aria-label="' + (en ? "Contents" : "目次") + '"><p class="toc__title">' + (en ? "Contents" : "本篇目次") + "</p>" +
              '<div class="toc__inner">' + toc + "</div></nav>" +
            '<div class="article-body prose">' + body + "</div>" +
            related(p) +
          "</div>" + pager(p);
      },

      /* ---- dashboard: stat cards + bar + line + table ---- */
      dashboard: function (p) {
        var stats = (p.stats || []).map(function (s) {
          var d = s.delta;
          var deltaHtml = (d === 0 || d) ?
            '<span class="stat-delta stat-delta--' + (d >= 0 ? "up" : "down") + '">' +
              (d >= 0 ? "▲ " : "▼ ") + esc(String(Math.abs(d))) + "%</span>" : "";
          return '<div class="stat-card" data-item>' +
            '<span class="stat-label">' + esc(t(s.label)) + "</span>" +
            '<b class="stat-value">' + esc(String(s.value)) +
              (t(s.unit) ? ' <span class="stat-unit">' + esc(t(s.unit)) + "</span>" : "") + "</b>" +
            deltaHtml + "</div>";
        }).join("");
        var bars = p.bars ? '<figure class="panel" data-item><figcaption>' + esc(t(p.bars.title)) + "</figcaption>" +
          '<div class="chart-wrap">' + barChart(p.bars.series || []) + "</div></figure>" : "";
        var line = p.line ? '<figure class="panel" data-item><figcaption>' + esc(t(p.line.title)) + "</figcaption>" +
          '<div class="chart-wrap">' + lineChart(p.line.points || []) + "</div></figure>" : "";
        var table = "";
        if (p.table) {
          var thead = (p.table.columns || []).map(function (c) { return "<th>" + esc(t(c.label)) + "</th>"; }).join("");
          var tbody = (p.table.rows || []).map(function (row) {
            return "<tr data-item>" + (p.table.columns || []).map(function (c) {
              var v = row[c.key];
              return "<td>" + esc(typeof v === "object" ? t(v) : String(v == null ? "" : v)) + "</td>";
            }).join("") + "</tr>";
          }).join("");
          table = '<div class="panel panel--wide" data-item><div class="table-wrap"><table class="data-table">' +
            "<thead><tr>" + thead + "</tr></thead><tbody>" + tbody + "</tbody></table></div></div>";
        }
        return head(p) +
          '<div class="stat-grid">' + stats + "</div>" +
          '<div class="panel-grid">' + bars + line + "</div>" + table;
      },

      /* ---- timeline: dated event cards down a rail ---- */
      timeline: function (p) {
        var items = (p.events || []).map(function (ev) {
          return '<li class="tl-item" data-item><div class="tl-dot" aria-hidden="true"></div>' +
            '<div class="tl-card"><span class="tl-date">' + esc(t(ev.date)) + "</span>" +
            '<h3 class="tl-title">' + esc(t(ev.title)) + "</h3>" +
            '<p class="tl-body">' + esc(t(ev.body)) + "</p></div></li>";
        }).join("");
        return head(p) + '<ol class="timeline">' + items + "</ol>";
      },

      /* ---- table: the accession register — filter by shelf, search, sort ---- */
      table: function (p) {
        var rows = p.rows || [];
        var counts = {}; rows.forEach(function (row) { counts[row.catKey] = (counts[row.catKey] || 0) + 1; });
        return '<header class="page-head"><h1>' + esc(t(p.title)) + "</h1>" +
            (t(p.subtitle) ? '<p class="page-head__sub">' + esc(t(p.subtitle)) + "</p>" : "") + "</header>" +
          '<div class="toolbar">' + legend("tableChips", counts) + searchBox("search", en ? "Search the register…" : "搜尋對照表…") + "</div>" +
          '<div class="table-scroll" tabindex="0" role="region" aria-label="' + esc(t(p.title)) + '">' +
            '<table class="register" id="dataTable"><thead></thead><tbody></tbody></table></div>' +
          '<p class="scroll-hint">' + (en ? "Swipe the table sideways to see every column." : "表格可左右滑動，看完所有欄位。") + "</p>";
      },

      /* ---- bento: asymmetric tile grid ---- */
      bento: function (p) {
        var tiles = (p.tiles || []).map(function (tile) {
          return '<article class="tile tile--' + esc(tile.size || "sm") + (tile.accent ? " tile--accent" : "") + '" data-item>' +
            (tile.icon ? '<span class="material-symbols-rounded tile__icon" aria-hidden="true">' + esc(tile.icon) + "</span>" : "") +
            (tile.value ? '<b class="tile__value">' + esc(tile.value) + "</b>" : "") +
            '<h3 class="tile__title">' + esc(t(tile.title)) + "</h3>" +
            (t(tile.body) ? '<p class="tile__body">' + esc(t(tile.body)) + "</p>" : "") + "</article>";
        }).join("");
        return head(p) + '<div class="bento">' + tiles + "</div>";
      },

      /* ---- kanban: cards grouped by status column ---- */
      kanban: function (p) {
        var cols = (p.columns || []).map(function (col) {
          var cards = (p.cards || []).filter(function (c) { return c.column === col.key; }).map(function (c) {
            var tags = (c.tags || []).map(function (g) { return '<span class="tag">' + esc(g) + "</span>"; }).join("");
            return '<article class="kb-card" data-item><h3 class="kb-card__title">' + esc(t(c.title)) + "</h3>" +
              (t(c.body) ? '<p class="kb-card__body">' + esc(t(c.body)) + "</p>" : "") +
              (tags ? '<div class="card__tags">' + tags + "</div>" : "") + "</article>";
          }).join("");
          var count = (p.cards || []).filter(function (c) { return c.column === col.key; }).length;
          return '<div class="kb-col"><div class="kb-col__head">' + esc(t(col.label)) +
            ' <span class="kb-col__count">' + count + "</span></div>" +
            '<div class="kb-col__body">' + cards + "</div></div>";
        }).join("");
        return head(p) + '<div class="kanban">' + cols + "</div>";
      },

      /* ---- faq: searchable accordion ---- */
      faq: function (p) {
        var items = (p.qa || []).map(function (row) {
          return '<details class="acc-item" data-item data-q="' + esc((t(row.q) + " " + t(row.a)).toLowerCase()) + '">' +
            '<summary class="acc-q"><span>' + esc(t(row.q)) + "</span>" +
            '<span class="material-symbols-rounded acc-chevron" aria-hidden="true">expand_more</span></summary>' +
            '<div class="acc-a">' + esc(t(row.a)) + "</div></details>";
        }).join("");
        return head(p) +
          '<div class="toolbar"><input id="search" class="search" type="search" autocomplete="off" ' +
            'placeholder="' + (L.state.lang === "en" ? "Search…" : "搜尋…") + '" ' +
            'aria-label="' + (L.state.lang === "en" ? "Search" : "搜尋") + '" /></div>' +
          '<div class="accordion" id="accordion">' + items + "</div>";
      },

      /* ---- comparison: plans (cols) x features (rows) ---- */
      comparison: function (p) {
        var plans = p.plans || [], feats = p.features || [];
        var thead = '<th scope="col"></th>' + plans.map(function (pl) {
          return '<th scope="col" class="' + (pl.highlight ? "cmp-col--hl" : "") + '">' +
            '<div class="cmp-plan">' + esc(t(pl.name)) + "</div>" +
            '<div class="cmp-price">' + esc(t(pl.price)) + "</div>" +
            (t(pl.note) ? '<div class="cmp-note">' + esc(t(pl.note)) + "</div>" : "") + "</th>";
        }).join("");
        var rows = feats.map(function (f) {
          var cells = plans.map(function (pl) {
            var v = f.values ? f.values[pl.key] : undefined;
            var cell;
            if (v === true) cell = '<span class="cmp-yes material-symbols-rounded" aria-label="yes">check</span>';
            else if (v === false || v == null) cell = '<span class="cmp-no" aria-label="no">—</span>';
            else cell = esc(t(v));
            return '<td class="' + (pl.highlight ? "cmp-col--hl" : "") + '">' + cell + "</td>";
          }).join("");
          return '<tr data-item><th scope="row" class="cmp-feat">' + esc(t(f.label)) + "</th>" + cells + "</tr>";
        }).join("");
        return head(p) + '<div class="table-wrap"><table class="cmp-table">' +
          "<thead><tr>" + thead + "</tr></thead><tbody>" + rows + "</tbody></table></div>";
      },

      /* ---- leaderboard: ranked list + tier grouping toggle ---- */
      leaderboard: function (p) {
        var listLabel = L.state.lang === "en" ? "List" : "排名";
        var tierLabel = L.state.lang === "en" ? "Tiers" : "階級";
        return head(p) +
          '<div class="seg" role="tablist">' +
            '<button class="seg__btn seg__btn--active" type="button" data-view="list">' + esc(listLabel) + "</button>" +
            '<button class="seg__btn" type="button" data-view="tier">' + esc(tierLabel) + "</button>" +
          "</div>" +
          '<div id="lbView"></div>';
      },

      /* ---- scrolly: sticky visual + stepped narrative ---- */
      scrolly: function (p) {
        var steps = (p.steps || []).map(function (s, i) {
          return '<div class="scrolly-step" data-item data-step="' + i + '"><p>' + esc(t(s.text)) + "</p></div>";
        }).join("");
        return head(p) +
          '<div class="scrolly">' +
            '<div class="scrolly-sticky"><div class="scrolly-visual" id="scrollyVisual"></div></div>' +
            '<div class="scrolly-steps">' + steps + "</div>" +
          "</div>";
      },

      /* ---- map: Leaflet map + list (needs Leaflet on the page) ---- */
      map: function (p) {
        return head(p) +
          '<div class="map-layout">' +
            '<div class="map-box" id="map" role="application" aria-label="Map"></div>' +
            '<ul class="map-list" id="mapList"></ul>' +
          "</div>";
      }
    };

    /* =====================================================================
       WIRING (interactions) — keyed by layout, run after innerHTML is set
       ===================================================================== */
    var WIRE = {
      hub: function (p) {
        var grid = document.getElementById("hubGrid");
        var search = document.getElementById("hubSearch");
        var count = document.getElementById("hubCount");
        var shelf = document.getElementById("hubShelf");
        var list = projects();
        var st = { q: "", cat: "" };

        function matches(q) {
          if (st.cat && q.category !== st.cat) return false;
          if (!st.q) return true;
          var hay = (t(q.title) + " " + t(q.subtitle) + " " + (q.tags || []).join(" ") + " " + (q.callno || "") + " " +
            (q.short || "") + " " + catLabel(q.category)).toLowerCase();
          return hay.indexOf(st.q) !== -1;
        }
        function paint() {
          var rows = list.filter(matches), hit = {}, filtered = !!(st.q || st.cat);
          rows.forEach(function (q) { hit[q.slug] = true; });
          grid.innerHTML = (rows.length ? rows.map(indexCard).join("") :
            '<p class="cards__empty">' + (en ? "No card matches. Try another word or pick “All”." : "沒有符合的目錄卡，換個關鍵字或選「全部」。") + "</p>") +
            (filtered ? "" : registerCard());
          shelf.classList.toggle("shelf--filtered", filtered);
          [].forEach.call(shelf.querySelectorAll(".spine"), function (a) {
            var slug = a.getAttribute("href").replace(/\.html$/, "");
            a.classList.toggle("is-match", !!hit[slug]);
          });
          if (count) count.textContent = filtered ?
            (en ? rows.length + " of " + list.length + " cards" : "符合 " + rows.length + " 張，共 " + list.length + " 張") : "";
        }
        if (search) search.addEventListener("input", function () { st.q = this.value.trim().toLowerCase(); paint(); });
        var select = wireLegend(document.getElementById("hubChips"), function (cat) { st.cat = cat; paint(); });
        /* #shelf-<category> deep links (used by the category link on project pages) */
        function fromHash() {
          var m = /^#shelf-(.+)$/.exec(location.hash);
          if (m && ["guide", "ai", "supply-chain", "tool"].indexOf(m[1]) !== -1) select(m[1]);
        }
        window.addEventListener("hashchange", fromHash);
        teardowns.push(function () { window.removeEventListener("hashchange", fromHash); });
        paint();
        fromHash();
      },

      gallery: function (p) {
        var grid = document.getElementById("grid");
        var search = document.getElementById("search");
        var count = document.getElementById("resultCount");
        var chips = [].slice.call(pageEl.querySelectorAll(".chip"));
        var st = { q: "", cat: "" };

        function matches(item) {
          if (st.cat && item.category !== st.cat) return false;
          if (!st.q) return true;
          var hay = (t(item.title) + " " + t(item.summary) + " " + (item.tags || []).join(" ")).toLowerCase();
          return hay.indexOf(st.q) !== -1;
        }
        function paint() {
          var rows = (p.items || []).filter(matches);
          grid.innerHTML = rows.map(function (item) {
            var tags = (item.tags || []).map(function (g) { return '<span class="tag">' + esc(g) + "</span>"; }).join("");
            return '<article class="card" tabindex="0" role="button" data-item data-slug="' + esc(item.slug) + '" ' +
              'aria-label="' + esc(t(item.title)) + '">' +
              '<h3 class="card__title">' + esc(t(item.title)) + "</h3>" +
              '<p class="card__summary">' + esc(t(item.summary)) + "</p>" +
              (tags ? '<div class="card__tags">' + tags + "</div>" : "") + "</article>";
          }).join("");
          if (count) count.textContent = rows.length + (L.state.lang === "en" ? " result(s)" : " 筆結果");
          wireCards();
        }
        function wireCards() {
          [].forEach.call(grid.querySelectorAll(".card[data-slug]"), function (card) {
            var slug = card.dataset.slug;
            card.addEventListener("click", function () { openItem(slug); });
            card.addEventListener("keydown", function (e) {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openItem(slug); }
            });
          });
        }
        function findItem(slug) {
          return (p.items || []).filter(function (it) { return it.slug === slug; })[0] || null;
        }
        function openItem(slug) {
          var item = findItem(slug); if (!item) return;
          var dlg = L.dialog(), body = document.getElementById("dialogBody");
          var tags = (item.tags || []).map(function (g) { return '<span class="tag">' + esc(g) + "</span>"; }).join("");
          body.innerHTML = '<h2 id="dialogTitle">' + esc(t(item.title)) + "</h2>" +
            (tags ? '<div class="card__tags">' + tags + "</div>" : "") +
            "<p>" + esc(t(item.overview) || t(item.summary)) + "</p>";
          if (!dlg.open) dlg.showModal();
          if (location.hash.slice(1) !== slug) history.replaceState(null, "", "#" + slug);
        }
        function syncHash() {
          var slug = location.hash.slice(1);
          if (slug && findItem(slug)) openItem(slug);
        }
        if (search) search.addEventListener("input", function () { st.q = this.value.trim().toLowerCase(); paint(); });
        chips.forEach(function (chip) {
          chip.addEventListener("click", function () {
            chips.forEach(function (c) { c.classList.remove("chip--active"); });
            chip.classList.add("chip--active");
            st.cat = chip.dataset.cat || "";
            paint();
          });
        });
        /* closing the dialog clears the #slug so the URL returns to clean state
           and a later deep link to the SAME slug fires hashchange again */
        var dlg = L.dialog();
        function onClose() {
          var slug = location.hash.slice(1);
          if (slug && findItem(slug)) history.replaceState(null, "", location.pathname + location.search);
        }
        dlg.addEventListener("close", onClose);
        var onHash = function () { syncHash(); };
        window.addEventListener("hashchange", onHash);
        teardowns.push(function () {
          window.removeEventListener("hashchange", onHash);
          dlg.removeEventListener("close", onClose);
        });
        paint();
        syncHash();
      },

      article: function () {
        var prog = document.getElementById("readingProgress");
        var links = [].slice.call(pageEl.querySelectorAll(".toc-link"));
        var secs = [].slice.call(pageEl.querySelectorAll(".article-section"));
        function onScroll() {
          var h = document.documentElement;
          var max = h.scrollHeight - h.clientHeight;
          if (prog) prog.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + "%";
        }
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
        teardowns.push(function () { window.removeEventListener("scroll", onScroll); });
        if ("IntersectionObserver" in window) {
          var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
              if (!en.isIntersecting) return;
              links.forEach(function (a) {
                var on = a.dataset.toc === en.target.id;
                a.classList.toggle("toc-link--active", on);
              });
            });
          }, { rootMargin: "-30% 0px -60% 0px" });
          secs.forEach(function (s) { io.observe(s); });
          teardowns.push(function () { io.disconnect(); });
        }
      },

      dashboard: function () { /* static charts; nothing to wire */ },

      table: function (p) {
        var table = document.getElementById("dataTable");
        var thead = table.querySelector("thead"), tbody = table.querySelector("tbody");
        var search = document.getElementById("search");
        var rows = p.rows || [];
        var cols = p.columns || [];
        var st = { q: "", cat: "", sortKey: null, dir: 1 };
        var bySlug = {}; projects().forEach(function (q) { bySlug[q.slug] = q; });

        function cellText(row, c) { var v = row[c.key]; return typeof v === "object" ? t(v) : String(v == null ? "" : v); }
        function rowMatches(row) {
          if (st.cat && row.catKey !== st.cat) return false;
          if (!st.q) return true;
          return cols.some(function (c) { return cellText(row, c).toLowerCase().indexOf(st.q) !== -1; }) ||
            ((bySlug[row.slug] || {}).callno || "").toLowerCase().indexOf(st.q) !== -1;
        }
        function cell(row, c) {
          var q = bySlug[row.slug] || {};
          if (c.key === "name") {
            return '<th scope="row" class="col-name"><a class="reg-name cat-' + esc(row.catKey) + '" href="' + esc(row.slug ? row.slug + ".html" : "#") + '">' +
              '<span class="reg-name__dot" aria-hidden="true"></span><span><span class="reg-name__t">' + esc(cellText(row, c)) + "</span>" +
              '<span class="reg-name__c">' + esc(q.callno || "") + "</span></span></a></th>";
          }
          if (c.key === "cat") return '<td class="col-cat"><span class="reg-cat cat-' + esc(row.catKey) + '">' + esc(cellText(row, c)) + "</span></td>";
          if (c.type === "link") {
            var u = row[c.key];
            return '<td class="col-url"><a class="reg-link" href="' + esc(u) + '" target="_blank" rel="noopener" title="' + esc(u) + '">' + esc(host(u)) + ext + "</a></td>";
          }
          return '<td class="col-' + esc(c.key) + '">' + esc(cellText(row, c)) + "</td>";
        }
        function paintHead() {
          thead.innerHTML = "<tr>" + cols.map(function (c) {
            var on = st.sortKey === c.key;
            return '<th scope="col" class="col-' + esc(c.key) + '" data-key="' + esc(c.key) + '" tabindex="0" aria-sort="' +
              (on ? (st.dir > 0 ? "ascending" : "descending") : "none") + '">' + esc(t(c.label)) +
              '<span class="sort" aria-hidden="true">' + (on ? (st.dir > 0 ? "↑" : "↓") : "") + "</span></th>";
          }).join("") + "</tr>";
          [].forEach.call(thead.querySelectorAll("th"), function (th) {
            th.addEventListener("click", function () { sortBy(th.dataset.key); });
            th.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sortBy(th.dataset.key); } });
          });
        }
        function sortBy(key) {
          if (st.sortKey === key) st.dir = -st.dir; else { st.sortKey = key; st.dir = 1; }
          paint();
        }
        function paint() {
          paintHead();
          var col = cols.filter(function (c) { return c.key === st.sortKey; })[0];
          var list = rows.filter(rowMatches).slice();
          if (col) list.sort(function (a, b) { return cellText(a, col).localeCompare(cellText(b, col)) * st.dir; });
          tbody.innerHTML = list.length ? list.map(function (row) {
            return "<tr>" + cols.map(function (c) { return cell(row, c); }).join("") + "</tr>";
          }).join("") : '<tr><td colspan="' + cols.length + '">' + (en ? "No project matches." : "沒有符合的專案。") + "</td></tr>";
        }
        wireLegend(document.getElementById("tableChips"), function (cat) { st.cat = cat; paint(); });
        if (search) search.addEventListener("input", function () { st.q = this.value.trim().toLowerCase(); paint(); });
        paint();
      },

      bento: function () { /* static */ },
      kanban: function () { /* static */ },

      faq: function () {
        var search = document.getElementById("search");
        var items = [].slice.call(pageEl.querySelectorAll(".acc-item"));
        if (search) search.addEventListener("input", function () {
          var q = this.value.trim().toLowerCase();
          items.forEach(function (it) {
            var hit = !q || (it.dataset.q || "").indexOf(q) !== -1;
            it.style.display = hit ? "" : "none";
          });
        });
      },

      comparison: function () { /* static */ },

      leaderboard: function (p) {
        var view = document.getElementById("lbView");
        var btns = [].slice.call(pageEl.querySelectorAll(".seg__btn"));
        var entries = (p.entries || []).slice().sort(function (a, b) { return b.score - a.score; });
        function row(e, rank) {
          return '<li class="lb-row" data-item>' +
            (rank ? '<span class="lb-rank">' + rank + "</span>" : "") +
            '<span class="lb-tier lb-tier--' + esc(e.tier || "") + '">' + esc(e.tier || "") + "</span>" +
            '<span class="lb-name">' + esc(t(e.name)) + "</span>" +
            '<span class="lb-meta">' + esc(t(e.meta)) + "</span>" +
            '<span class="lb-score">' + esc(String(e.score)) + "</span></li>";
        }
        function listView() {
          view.innerHTML = '<ol class="lb-list">' + entries.map(function (e, i) { return row(e, i + 1); }).join("") + "</ol>";
        }
        function tierView() {
          var tiers = [];
          entries.forEach(function (e) { if (tiers.indexOf(e.tier) === -1) tiers.push(e.tier); });
          view.innerHTML = tiers.map(function (tier) {
            var rows = entries.filter(function (e) { return e.tier === tier; }).map(function (e) { return row(e); }).join("");
            return '<div class="lb-tier-group"><div class="lb-tier-head lb-tier--' + esc(tier) + '">' + esc(tier) + "</div>" +
              '<ol class="lb-list">' + rows + "</ol></div>";
          }).join("");
        }
        btns.forEach(function (b) {
          b.addEventListener("click", function () {
            btns.forEach(function (x) { x.classList.remove("seg__btn--active"); });
            b.classList.add("seg__btn--active");
            if (b.dataset.view === "tier") tierView(); else listView();
          });
        });
        listView();
      },

      scrolly: function (p) {
        var visual = document.getElementById("scrollyVisual");
        var steps = [].slice.call(pageEl.querySelectorAll(".scrolly-step"));
        function paintVisual(i) {
          var s = (p.steps || [])[i]; if (!s) return;
          var v = s.visual || {};
          if (v.type === "bars") {
            visual.innerHTML = '<div class="chart-wrap">' + barChart(v.bars || [], v.color) + "</div>";
          } else {
            visual.innerHTML = '<div class="scrolly-stat" style="color:' + esc(v.color || "var(--primary)") + '">' +
              esc(t(v.value)) + "</div>";
          }
        }
        paintVisual(0);
        if ("IntersectionObserver" in window) {
          var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
              if (en.isIntersecting) {
                steps.forEach(function (s) { s.classList.remove("scrolly-step--active"); });
                en.target.classList.add("scrolly-step--active");
                paintVisual(parseInt(en.target.dataset.step, 10) || 0);
              }
            });
          }, { rootMargin: "-45% 0px -45% 0px" });
          steps.forEach(function (s) { io.observe(s); });
          teardowns.push(function () { io.disconnect(); });
        }
      },

      map: function (p) {
        var listEl = document.getElementById("mapList");
        var places = p.places || [];
        listEl.innerHTML = places.map(function (pl) {
          return '<li class="place" data-item data-slug="' + esc(pl.slug) + '" tabindex="0" role="button" ' +
            'aria-label="' + esc(t(pl.name)) + '"><b>' + esc(t(pl.name)) + "</b>" +
            '<span>' + esc(t(pl.body)) + "</span></li>";
        }).join("");

        if (typeof window.L === "undefined" || !window.L.map) {
          // Leaflet not loaded (offline / blocked): list-only graceful fallback.
          document.getElementById("map").innerHTML =
            '<div class="map-fallback">' + esc(L.state.lang === "en" ? "Map unavailable offline — see the list." : "離線時地圖無法載入 — 請看清單。") + "</div>";
          return;
        }
        var map = window.L.map("map", { scrollWheelZoom: false });
        window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap", maxZoom: 19
        }).addTo(map);
        var markers = {}, group = [];
        places.forEach(function (pl) {
          /* alt + title give Leaflet's marker <img role="button"> an accessible name */
          var m = window.L.marker([pl.lat, pl.lng], { alt: t(pl.name), title: t(pl.name), keyboard: true })
            .addTo(map).bindPopup("<b>" + esc(t(pl.name)) + "</b><br>" + esc(t(pl.body)));
          markers[pl.slug] = m; group.push([pl.lat, pl.lng]);
        });
        if (group.length) map.fitBounds(group, { padding: [30, 30] });
        [].forEach.call(listEl.querySelectorAll(".place"), function (li) {
          function go() { var m = markers[li.dataset.slug]; if (m) { map.panTo(m.getLatLng()); m.openPopup(); } }
          li.addEventListener("click", go);
          li.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
        });
        teardowns.push(function () { try { map.remove(); } catch (e) {} });
      }
    };

    /* ---- hero count-up (shared by hub) ---- */
    function animateCounters() {
      var els = [].slice.call(pageEl.querySelectorAll(".hero__stat-value[data-count]"));
      if (!els.length) return;
      function run(el) {
        var target = parseFloat(el.dataset.count) || 0, dur = 1000, start = null;
        function step(ts) {
          if (start === null) start = ts;
          var pr = Math.min(1, (ts - start) / dur), eased = 1 - Math.pow(1 - pr, 3);
          el.textContent = String(Math.round(target * eased));
          if (pr < 1) requestAnimationFrame(step); else el.textContent = String(target);
        }
        requestAnimationFrame(step);
      }
      if (!("IntersectionObserver" in window)) { els.forEach(run); return; }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { run(en.target); io.unobserve(en.target); } });
      }, { threshold: 0.4 });
      els.forEach(function (el) { io.observe(el); });
      teardowns.push(function () { io.disconnect(); });
    }

    /* =====================================================================
       RENDER the current page
       ===================================================================== */
    function render() {
      teardowns.forEach(function (fn) { try { fn(); } catch (e) {} });
      teardowns = [];
      var p = L.currentPage();
      if (!p) { pageEl.innerHTML = '<p class="empty">No page data.</p>'; return; }
      var fn = RENDERERS[p.layout] || RENDERERS.gallery;
      pageEl.className = "page page--" + p.layout + (p.category ? " cat-" + p.category : "");
      pageEl.innerHTML = fn(p);
      var w = WIRE[p.layout];
      if (w) w(p);
    }

    render();
  }

  boot();
})();
