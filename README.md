# OWASP 旗艦專案導覽 / OWASP Flagship Projects

> 一個詳盡、雙語(中 / EN)、可互動的純靜態網站,整理 OWASP 十一個旗艦(Flagship)專案——定義現代應用程式安全的標準、指南與工具。

本站把 OWASP 官方資料整理成「一個總覽首頁 + 每個專案一頁深入解說 + 一張跨專案對照表」。內容於 **2026 年 6 月**由各專案**官方來源**擷取整理(含最新版本資訊,如 Top 10:2025、ASVS 5.0、CycloneDX 1.7 / ECMA-424、LLM Top 10:2025 等),並保留官方連結。採零建置(zero-build)的 HTML / CSS / JS + Material Design 3 技術棧,可直接部署到 GitHub Pages。

---

## 🔗 線上版 / Live

| | |
|---|---|
| 🌐 網站 | <https://owasp.peteraim.com/> |

> 直接點進去就能用,無需安裝。每個專案都有獨立網址(例如 `…/asvs.html`、`…/juice-shop.html`),可直接分享。

---

## ✨ 功能特色

- 🌏 **全頁雙語切換** — 中文 / English 一鍵切換,整頁(導覽、卡片、內文、事實框、頁尾)同步重繪,無殘留
- 🌗 **深色 / 淺色模式** — 一鍵切換,並以 `localStorage` 記憶
- 🔍 **即時搜尋** — 在首頁輸入關鍵字立即過濾專案
- 🏷️ **分類篩選** — 依「指南與標準 / AI 安全 / 供應鏈・SBOM / 工具」四大分類快速篩選
- 📄 **每專案獨立詳情頁** — 各有獨立 URL、事實框(類型 / 最新版本 / 適用對象 / 形式 / 授權 / 官方連結)、目錄(TOC)與閱讀進度條,對 SEO 與分享友善
- 📊 **專案對照表** — 一頁並列全部 11 個專案,可點欄位排序、依類別篩選
- 🔗 **官方來源連結** — 每頁附上 3–6 個官方資源連結
- 📱 **響應式設計** — 手機、平板、桌機皆適配(已於 375px 驗證無水平溢位)
- ⚡ **純靜態、零 build** — 無後端、無打包工具,載入快、可離線瀏覽
- 🔎 **SEO / 分享友善** — 每頁含 canonical、Open Graph、Twitter Card 與 JSON-LD 結構化資料

---

## 📂 收錄專案 / 資料來源

本站內容整理自各 OWASP 專案的**官方網站**(非官方整理,僅供學習參考)。

| 專案 | 分類 | 官方來源 |
|------|------|----------|
| OWASP Top 10 | 指南與標準 | <https://owasp.org/www-project-top-ten/> · <https://owasp.org/Top10/> |
| Application Security Verification Standard (ASVS) | 指南與標準 | <https://owasp.org/www-project-application-security-verification-standard/> |
| Web Security Testing Guide (WSTG) | 指南與標準 | <https://owasp.org/www-project-web-security-testing-guide/> |
| Mobile Application Security (MAS) | 指南與標準 | <https://mas.owasp.org/> |
| Software Assurance Maturity Model (SAMM) | 指南與標準 | <https://owaspsamm.org/> |
| GenAI Security Project | AI 安全 | <https://genai.owasp.org/> |
| AI Exchange | AI 安全 | <https://owaspai.org/> |
| CycloneDX (Secure Bill of Materials) | 供應鏈・SBOM | <https://cyclonedx.org/> |
| Dependency-Track | 工具 | <https://dependencytrack.org/> |
| Juice Shop | 工具 | <https://owasp.org/www-project-juice-shop/> |
| ModSecurity Core Rule Set (CRS) | 工具 | <https://coreruleset.org/> |

### 專案結構

```
owasp/
├── index.html              # 首頁(hub:搜尋 + 分類 + 專案卡片)
├── compare.html            # 專案對照表(可排序 / 篩選)
├── <slug>.html             # 11 個專案各自的詳情頁(article)
├── assets/
│   ├── styles.css          # MD3 設計 token + 元件樣式
│   ├── shell.js            # 共用 chrome:app bar / 跨頁導覽 / footer / dialog / 語言・主題
│   └── app.js              # 版型引擎:依 data-page 選 renderer 渲染
├── data/
│   ├── data.js             # 產生的資料層(window.SITE_META + SITE_PAGES)— 勿手改
│   ├── build-data.js       # 合併步驟:research/*.json → data.js
│   ├── build-pages.js      # 產生各 .html 頁殼(含 SEO/OG/JSON-LD)
│   └── research/*.json     # 各專案原始研究資料(可重現的來源)
├── favicon.svg
└── .nojekyll               # 讓 GitHub Pages 原樣提供 assets/
```

> ⚠️ **非官方**:本網站為個人整理之非官方教育資源,內容整理自上述各 OWASP 官方來源。
> OWASP®、各專案名稱與標誌均為 OWASP Foundation 之商標。如有錯誤或出入,**請以官方來源為準**。

---

## 🛠 本機使用

```bash
# 1. clone 專案
git clone git@github.com:tingwei161803/owasp.git
cd owasp

# 2a. 最簡單:直接開啟首頁
open index.html

# 2b. 或啟動本機伺服器(建議,跨頁導覽 / 相對路徑才正常)
uv run python -m http.server 4173
# 然後瀏覽 http://localhost:4173
```

> 本專案為純靜態網站,瀏覽不需安裝任何依賴。依使用者偏好,所有 Python 操作一律使用 `uv`。

### 重新產生資料 / 頁面(可選)

資料層與頁殼都是由 `data/research/*.json` 產生的,可重現:

```bash
node data/build-data.js     # research/*.json → data/data.js
node data/build-pages.js    # data/data.js   → 各 .html 頁殼
```

### 驗證(Playwright)

```bash
uv run --with playwright playwright install chromium     # 首次
uv run --with playwright python <skill>/scripts/verify.py --dir .
```

最近一次驗證結果:**96 PASS / 1 SKIP / 0 FAIL**(13 頁全綠;SKIP 為對照表頁無卡片可篩,屬預期)。

---

## 📝 聲明 / License

- 本站為**非官方**整理,內容著作權與商標歸 **OWASP Foundation** 及各專案作者所有,並依各專案自身授權條款(如 CC BY-SA 4.0、Apache-2.0、MIT)。
- 本 repo 的**網站程式碼**以 **MIT** 授權釋出。
- 內容力求準確並標註官方來源,但可能隨官方更新而過時;請以官方為準。
- 如為權利人且希望調整或移除內容,請開 issue 聯絡。

---

<sub>純靜態網站 · Material Design 3。</sub>
