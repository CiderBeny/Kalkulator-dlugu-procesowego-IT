# AGENTS.md — Process Debt Engine

## Tech Stack
- **Frontend:** Vanilla HTML5 + Tailwind CSS v4.3 (via CDN + CLI) + custom CSS
- **Logic:** Vanilla JavaScript (ES6+), no framework
- **Build:** Tailwind CLI (`npx @tailwindcss/cli -i src/input.css -o output.css`)
- **Testing:** Node.js built-in test runner (`node:test`)
- **Hosting:** Static — GitHub Pages ready

## Key Dependencies (loaded via CDN with SRI hashes)
- Chart.js 4.4.4, jsPDF 4.2.1, html2canvas 1.4.1, SheetJS/XLSX 0.18.5
- Bundled in `index.html` via `<script defer src="...">` with `integrity` attributes
- Google Fonts: Space Grotesk (headings) + Inter (body) — 3-tier fallback (base64 → CDN → system)

## Project Structure
```
├── fonts/                # Inter TTF files for PDF export (Polish support)
├── src/
│   ├── config.js          # Constants, coefficients, defaults (~135 lines)
│   ├── i18n.js            # Translations (EN + PL, ~711 lines)
│   ├── utils.js           # Utility functions (~194 lines)
│   ├── state.js           # URL hash state — encode/decode/copy (~76 lines)
│   ├── model.js           # Financial model — pure computation (~298 lines)
│   ├── charts.js          # Chart.js wrappers (~120 lines)
│   ├── ui-renderers.js    # UI rendering — calculate, recs, roadmap, scenarios (~395 lines)
│   ├── exports.js         # Excel + PDF export, font cache (~700 lines)
│   ├── main.js            # Entry point — DOMContentLoaded + window.onload
│   ├── input.css          # Tailwind CSS entry point
│   ├── security.test.js   # Security/safety unit tests
│   └── model-audit.test.js# Model integrity audit tests
├── .vscode/              # Recommended extensions
├── index.html            # Main HTML (UI, CSP, font bootstrap + cache)
├── style.css             # Custom CSS + base64-embedded fonts
├── output.css            # Compiled Tailwind output
├── package.json
└── AGENTS.md
```

## Module Dependency Order (script tags in index.html)
1. `config.js` — pure constants (no PDE dependency)
2. `i18n.js` — `PDE.TRANSLATIONS`, `PDE.currentLang`, `PDE.currentCurrency`, `PDE.nbpDate`
3. `utils.js` — helpers (depends on config + i18n)
4. `state.js` — URL hash (depends on config + utils)
5. `model.js` — computation engine (depends on config + utils)
6. `charts.js` — Chart.js rendering (depends on i18n + config + utils)
7. `ui-renderers.js` — DOM updates (depends on all above)
8. `exports.js` — export features (depends on all above)
9. `main.js` — startup (depends on all above)

## How to Run
```sh
# No dev server needed — just open index.html in a browser.
# For full functionality (fetch, fonts), serve via local HTTP:
python -m http.server 8080          # or:
npx serve .
```

## How to Build CSS (optional, Tailwind changes only)
```sh
npx @tailwindcss/cli -i src/input.css -o output.css
```

## How to Run Tests
```sh
npm test
# Runs: node --test src/security.test.js src/model-audit.test.js
```

## i18n Conventions
- Translations live in `PDE.TRANSLATIONS` object (`src/i18n.js`) — keys `en` and `pl`
- ~140 keys per language, with `{C}` (currency symbol) and `{CC}` (currency code) placeholders
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
