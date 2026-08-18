# AGENTS.md — Process Debt Engine

## Tech Stack
- **Frontend:** Vanilla HTML5 + Tailwind CSS v4.3 (via CDN + CLI) + custom CSS
- **Logic:** Vanilla JavaScript (ES6+), no framework
- **Build:** Tailwind CLI (`npx @tailwindcss/cli -i src/input.css -o output.css`)
- **Testing:** Node.js built-in test runner (`node:test`)
- **Hosting:** Static — GitHub Pages ready

## Key Dependencies (loaded via CDN with SRI hashes)
- Chart.js 4.4.4, jsPDF 4.2.1, html2canvas 1.4.1, SheetJS/XLSX 0.20.3
- Bundled in `index.html` via `<script defer src="...">` with `integrity` attributes
- Google Fonts: Space Grotesk (headings) + Inter (body) — 3-tier fallback (base64 → CDN → system)

## Project Structure
```
├── fonts/                # Inter TTF files for PDF export (Polish support)
├── scripts/
│   └── dev-server.js      # Hardened local dev server (127.0.0.1, CSP + X-Frame-Options, path blocking)
├── src/
│   ├── config.js          # Constants, coefficients, defaults (~201 lines)
│   ├── i18n.js            # Translations (EN + PL, 395 keys/lang, ~894 lines)
│   ├── utils.js           # Utility functions (~288 lines)
│   ├── state.js           # URL hash state — encode/decode/copy (~110 lines)
│   ├── model.js           # Financial model — pure computation (~263 lines)
│   ├── mc-worker.js       # Monte Carlo simulation Web Worker (~255 lines)
│   ├── charts.js          # Chart.js wrappers (~67 lines)
│   ├── sensitivity.js     # Sensitivity analysis — tornado chart (~178 lines)
│   ├── ui-renderers.js    # UI rendering — calculate, recs, roadmap, scenarios, calibration (~573 lines)
│   ├── exports.js         # Excel + PDF export, font cache (~1204 lines)
│   ├── font-bootstrap.js  # Font fallback + framebusting guard (~96 lines)
│   ├── gen-og-image.js    # Build script — generates og-image.png via node-canvas (~53 lines)
│   ├── main.js            # Entry point — DOMContentLoaded + window.onload (~191 lines)
│   ├── input.css          # Tailwind CSS entry point
│   ├── security.test.js   # Security/safety unit tests (~288 lines)
│   ├── model-audit.test.js# Model integrity audit tests (~592 lines)
│   └── sensitivity-views.test.js  # Sensitivity views tests (~158 lines)
├── .vscode/              # Recommended extensions
├── index.html            # Main HTML (UI, CSP, font bootstrap + cache, ~1046 lines)
├── style.css             # Custom CSS + base64-embedded fonts (~938 lines)
├── output.css            # Compiled Tailwind output
├── package.json
└── AGENTS.md
```

## Module Dependency Order (script tags in index.html)
- `font-bootstrap.js` loads first (no `defer` — runs during parsing; sets up font fallback + framebusting)
1. `config.js` — pure constants (no PDE dependency)
2. `i18n.js` — `PDE.TRANSLATIONS`, `PDE.currentLang`, `PDE.currentCurrency`, `PDE.nbpDate`
3. `utils.js` — helpers (depends on config + i18n)
4. `state.js` — URL hash (depends on config + utils)
5. `model.js` — computation engine (depends on config + utils)
6. `charts.js` — Chart.js rendering (depends on i18n + config + utils)
7. `sensitivity.js` — tornado chart (depends on model + charts)
8. `ui-renderers.js` — DOM updates (depends on all above)
9. `exports.js` — export features (depends on all above)
10. `main.js` — startup (depends on all above)
- `mc-worker.js` is NOT a script tag — loaded as a Web Worker by `ui-renderers.js`

## How to Run
```sh
# No dev server needed — just open index.html in a browser.
# For full functionality (fetch, fonts), serve via the hardened local server:
node scripts/dev-server.js 8080   # binds 127.0.0.1; blocks .git/ dotfiles, package.json, README
```

## How to Build CSS (optional, Tailwind changes only)
```sh
npx @tailwindcss/cli -i src/input.css -o output.css
```

## How to Run Tests
```sh
npm test
# Runs: node --test src/security.test.js src/model-audit.test.js src/sensitivity-views.test.js
```

## i18n Conventions
- Translations live in `PDE.TRANSLATIONS` object (`src/i18n.js`) — keys `en` and `pl`
- 399 keys per language, with `{C}` (currency symbol) and `{CC}` (currency code) placeholders
- HTML elements tagged with `data-i18n="key"` for text, `data-i18n-formula="key"` for tooltips
- To add a language: add a new key to `PDE.TRANSLATIONS`, add entries for all existing keys
- `PDE.applyTranslations()` iterates `[data-i18n]` elements and sets `textContent`

## JavaScript Conventions
- Vanilla JS — no imports, no modules (all global scope under `window.PDE` namespace)
- Uses both `var` and `let`/`const` (legacy patterns exist)
- Helper functions use classic `function` keyword, not arrow
- CSS custom properties (e.g., `--bg-base`, `--text-primary`, `--accent`) define the theme
- Currency formatting uses `Intl.NumberFormat` with locale `pl-PL` / `en-US`
- **Language standard:** Code and test comments must be in English. UI strings are defined in `i18n.js` in both EN (default) and PL. All `data-i18n` attribute keys use English.

## PDF Export
- **Page 1** — hand-rendered with jsPDF text API (uses Inter font loaded from `fonts/` via `fetch`)
- **Pages 2+** — DOM screenshots via `html2canvas` with font injection (`buildFontFaceCSS()`)
- Font registration in `exportPDF()`: `addFileToVFS` + `addFont` + `setFont(pdfFont, ...)`
- Falls back to Helvetica if TTF files cannot be loaded

## Security & Safety Rules
- **Never log or expose secrets, API keys, or tokens** — this project has none.
- **CSP** defined in `<meta>` tag — tight allowlist for scripts, styles, fonts, connect-src
- **SRI hashes** on all CDN `<script>` tags — verify integrity before updating versions
- **Font cache validation** (`validateFontFace()` in `src/security.test.js` + inline script) — sanitizes localStorage font data before CSS injection
- **Excel formula injection guard** (`sanitizeCell()`) — prefixes `=`, `+`, `-`, `@` cells with `'`
- **URL hash validation** (`ALLOWED_HASH_KEYS`, `HASH_CONSTRAINTS`) — numeric bounds checks before DOM writes
- **No environment variables** — this is a static SPA with no backend
