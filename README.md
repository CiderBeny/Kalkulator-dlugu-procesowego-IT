# Process Debt Engine

[PL] **Process Debt Engine** to narzędzie typu SPA (Single Page Application) zaprojektowane dla IT Managerów i liderów operacyjnych. Pozwala na kwantyfikację finansową nieefektywności w procesach IT (tzw. długu procesowego) i przekłada zmarnowane roboczogodziny na realne straty budżetowe.

[EN] **Process Debt Engine** is a Single Page Application (SPA) designed for IT Managers and operational leaders. It enables the financial quantification of IT process inefficiencies (Process Debt) and translates wasted man-hours into tangible budgetary losses.

---

## 🇵🇱 Opis Projektu (Polish)

### Cel
W świecie IT Service Managementu często trudno jest przekonać zarząd do inwestycji w automatyzację, używając jedynie argumentów technicznych. To narzędzie służy do budowania **Business Case** – pokazuje czarno na białym, ile kosztuje organizację brak automatyzacji, słaba jakość danych w CMDB czy nieefektywny proces Change Managementu.

### Kluczowe Funkcje
* **Kalkulacja Kosztu Chaosu:** OPEX waste, Risk Exposure, Opportunity Loss, Net Debt, Payback Period — wyliczenia oparte na 12 pytaniach diagnostycznych (Q1–Q12: Manual Effort, Lead Time, Documentation Standard, Downtime Cost, Human Errors, itd.).
* **Model Finansowy Multi-Czynnikowy:** NPV/IRR oparte na konfigurowalnych mnożnikach — premia kontekstu, szybkość erozji, stopa dyskonta, horyzont inwestycji, lewary, współczynniki scenariuszy i parametry Monte Carlo.
* **WACC 9.3% (Damodaran 2025):** domyślna stopa dyskonta — mediana IT Infrastructure (edytowalna — suwak 5–20%).
* **IRR i Payback z 6-miesięcznym ramp-upem:** przepływy ze scenariusza inwestycyjnego narastają stopniowo przez pierwsze 6 miesięcy (3 miesiące 0 oszczędności, 3 miesiące 50%) — realistyczny, spójny rollout dla NPV, IRR i payback.
* **Tax Shield:** wartość odpisów amortyzacyjnych CAPEX włączona do NPV (zależna od stawki CIT).
* **Region Presets (PL/EU/US):** predefiniowane stawki (wynagrodzenie, koszt przestoju, marża szans, CAPEX) z automatycznym przeliczeniem walut wg aktualnych kursów NBP. WACC pozostaje edytowalny i nie zmienia się przy wyborze regionu.
* **Benchmark DORA:** 3 metryki (Lead Time, Manual Effort, Human Error Rate) klasyfikowane według standardu DORA (Elite / High / Medium / Low) z kolorowaniem i opisem.
* **Porównanie Scenariuszy Inwestycyjnych:** 3 ścieżki — "Do Nothing" (brak inwestycji), "Targeted Investment" (twój poziom automatyzacji + CAPEX), "Full Automation (80%)" (maksymalna automatyzacja, domyślnie 1.5× CAPEX — mnożnik konfigurowalny 1.0–3.0×) — z automatyczną rekomendacją najlepszej opcji.
* **Adekwatność CAPEX (Capture Factor):** potencjalne oszczędności są skalowane wprost proporcjonalnie do finansowania CAPEX poniżej progu referencyjnego (10% docelowych oszczędności rocznych) — `captureFactor = min(1, CAPEX ÷ (10% × targetSavings))`. Zapobiega to przypisywaniu małej inwestycji zasług za oszczędności, których nie jest w stanie sfinansować (pełne 100% tylko gdy CAPEX ≥ próg referencyjny).
* **Top 3 Financial Levers:** rankingowane rekomendacje (Process Automation, Risk Reduction, Innovation Runway, Management Efficiency, Retention & Burnout) z szacowanym odzyskiem rocznym, poziomem wysiłku i timeline.
* **90-Dniowa Mapa Drogowa:** automatycznie generowana z top 3 levers — 3 fazy (Month 1: Foundation, Month 2–3: Core, Month 4–6: Scale) z konkretnymi zadaniami.
* **Analiza Wrażliwości + Monte Carlo:** worker przelicza rozkłady wyników przy losowych perturbacjach parametrów zgodnie z zadaną siłą korelacji.
* **Wizualizacje:** 4 interaktywne wykresy Chart.js — Waterfall Capacity Erosion, Strategic Debt Bridge, Cumulative ROI & Payback, Risk Heatmap + wykres wrażliwości (tornado) NPV.
* **Eksport Excel:** 6 arkuszy (Inputs, Financial Results, Top Levers, Scenarios, Sensitivity Views, DORA Benchmark) z pełną dokumentacją kalkulacji.
* **Eksport PDF:** Wielostronicowy raport A4 — strona 1 z pytaniami diagnostycznymi, strony 2+ ze screenshotami bloków (html2canvas + jsPDF).
* **Link współdzielenia:** Stan kalkulacji zakodowany w URL hash — skopiuj link i wyślij zespołowi.
* **Dwujęzyczność:** Pełny przełącznik EN/PL (430+ kluczy translacji każdy).
* **Offline Font Cache:** Space Grotesk + Inter cachowane jako base64 w localStorage — strona renderuje się z właściwymi fontami nawet offline.
* **Bezpieczeństwo:** Content-Security-Policy (CSP), SRI hashes na wszystkich CDN, walidacja localStorage przed użyciem w CSS, ochrona przed formula injection w Excelu.
* **Testy:** 240+ testów automatycznych (bezpieczeństwo + audyt modelu + widoki wrażliwości + deklinacja i18n + zgodność worker↔model + round-trip linków współdzielenia + przypadki brzegowe finansowe) weryfikujących realny kod źródłowy, nie tylko kopię logiki.

### Wykorzystana Technologia
* **Frontend:** HTML5, Tailwind CSS + custom CSS (dark theme, CSS custom properties).
* **Logika:** Vanilla JavaScript (ES6+).
* **Model finansowy:** czysty JS bez frameworka — łatwy do audytu, testowania i weryfikacji.
* **Testy:** Node.js built-in test runner (`node:test`) — 240+ testów (security + model audit + sensitivity views + i18n plurals + MC worker parity + share-link round-trip + financial edge).
* **Biblioteki:** Chart.js (wykresy), jsPDF + html2canvas (PDF), SheetJS/XLSX (Excel), Google Fonts Space Grotesk + Inter.
* **Źródła danych:** Damodaran (WACC 2025), Weinberg (1992), Mark et al. UC Irvine (2008), Parnin & DeLine IEEE (2010), NBP FX (kursy walut).
* **Hosting:** GitHub Pages (gotowe do deployu — brak backendu, wszystko w jednym pliku `index.html`).

---

## 🇺🇸 Project Overview (English)

### Purpose
In the world of IT Service Management, it's often difficult to convince the board to invest in automation using only technical arguments. This tool is designed to build a solid **Business Case** – it demonstrates exactly how much the lack of automation, poor CMDB data quality, or inefficient Change Management costs the organization.

### Key Features
* **Chaos Cost Calculation:** OPEX waste, Risk Exposure, Opportunity Loss, Net Debt, Payback Period — based on 12 diagnostic questions (Q1–Q12: Manual Effort, Lead Time, Documentation Standard, Downtime Cost, Human Errors, etc.).
* **Multi-Factor Financial Model:** NPV/IRR built on 14 configurable multipliers — context premium, erosion rate, discount rate, investment horizon, levers, scenario coefficients and Monte Carlo parameters.
* **WACC 9.3% (Damodaran 2025):** default discount rate — IT Infrastructure median (editable — 5–20% slider).
* **IRR & Payback with 6-Month Ramp-Up:** scenario cash flows build up gradually over the first 6 months (3 months at 0% savings, 3 months at 50%) — a realistic, consistent rollout assumption for NPV, IRR and payback.
* **Tax Shield:** CAPEX depreciation value included in NPV (dependent on the CIT rate).
* **Region Presets (PL/EU/US):** predefined rates (salary, downtime cost, opportunity margin, CAPEX) with automatic currency conversion using live NBP FX rates. WACC stays editable and is not changed when you pick a region.
* **DORA Benchmark:** 3 metrics (Lead Time, Manual Effort, Human Error Rate) classified by DORA standards (Elite / High / Medium / Low) with color coding and descriptions.
* **Scenario Comparison:** 3 investment paths — "Do Nothing", "Targeted Investment" (your automation level + CAPEX), "Full Automation (80%)" (max automation, default 1.5× CAPEX — configurable 1.0–3.0× multiplier) — with auto-recommendation.
* **CAPEX Adequacy (Capture Factor):** potential savings scale in direct proportion to CAPEX funding below the reference threshold (10% of target annual savings) — `captureFactor = min(1, CAPEX ÷ (10% × targetSavings))`. This prevents a small investment from claiming credit for savings it cannot fund (100% only when CAPEX ≥ the reference threshold).
* **Top 3 Financial Levers:** Ranked recommendations (Process Automation, Risk Reduction, Innovation Runway, Management Efficiency, Retention & Burnout) with estimated annual recovery, effort level, and timeline.
* **90-Day Roadmap:** Auto-generated from top 3 levers — 3 phases (Month 1: Foundation, Month 2–3: Core, Month 4–6: Scale) with concrete tasks.
* **Sensitivity Analysis + Monte Carlo:** a worker simulates result distributions under random parameter perturbations according to the configured correlation strength.
* **Visualizations:** 4 interactive Chart.js charts — Waterfall Capacity Erosion, Strategic Debt Bridge, Cumulative ROI & Payback, Risk Heatmap + an NPV sensitivity (tornado) chart.
* **Excel Export:** 6 sheets (Inputs, Financial Results, Top Levers, Scenarios, Sensitivity Views, DORA Benchmark) with full calculation documentation.
* **PDF Export:** Multi-page A4 report — page 1 with diagnostic questions, pages 2+ with block screenshots (html2canvas + jsPDF).
* **Share Link:** Calculation state encoded in URL hash — copy the link and share with your team.
* **Bilingual:** Full EN/PL toggle (430+ translation keys each).
* **Offline Font Cache:** Space Grotesk + Inter cached as base64 in localStorage — renders with proper fonts even offline.
* **Security:** Content-Security-Policy (CSP), SRI hashes on all CDNs, localStorage validation before CSS injection, Excel formula injection guard.
* **Testing:** 240+ automated tests (security + model audit + sensitivity views + i18n plurals + worker⇄model parity + share-link round-trips + financial edge cases) verifying the actual source code, not a replicated copy of the logic.

### Tech Stack
* **Frontend:** HTML5, Tailwind CSS + custom CSS (dark theme, CSS custom properties).
* **Logic:** Vanilla JavaScript (ES6+).
* **Financial model:** framework-free plain JS — easy to audit, test and verify.
* **Testing:** Node.js built-in test runner (`node:test`) — 240+ tests (security + model audit + sensitivity views + i18n plurals + MC worker parity + share-link round-trip + financial edge).
* **Libraries:** Chart.js (charts), jsPDF + html2canvas (PDF), SheetJS/XLSX (Excel), Google Fonts Space Grotesk + Inter.
* **Data sources:** Damodaran (2025 WACC), Weinberg (1992), Mark et al. UC Irvine (2008), Parnin & DeLine IEEE (2010), NBP FX (currency rates).
* **Hosting:** GitHub Pages (ready to deploy — no backend, everything in a single `index.html`).

---

## 🚀 Jak uruchomić / How to run
1. Sklonuj repozytorium / Clone the repository.
2. Otwórz `index.html` w dowolnej przeglądarce / Open `index.html` in any web browser.
3. Dla pełnej funkcjonalności (kursy NBP, fonty) użyj lokalnego serwera w trybie deweloperskim / For full functionality (NBP rates, fonts) use the local dev server:
   ```
   node scripts/dev-server.js 8080   # binds 127.0.0.1, nie serwuje .git/ ani metaplików
   ```
4. Projekt jest gotowy do hostowania na **GitHub Pages**.

## 🌐 Deployment na GitHub Pages / GitHub Pages deployment
* W ustawieniach repozytorium (Settings → Pages) wybierz branch `main` jako źródło deployu / In repository Settings → Pages select branch `main` as the deploy source.
* `.nojekyll` jest już dodany, więc pliki są serwowane bez przetwarzania Jekyll / `.nojekyll` is already present, so files are served without Jekyll processing.
* Po aktualizacji zawartości odśwież podgląd linku na LinkedIn (Post Inspector), aby wyczyścić cache obrazu OG / After content updates, refresh the LinkedIn link preview (Post Inspector) to clear the OG image cache.
* Uwaga o bezpieczeństwie / Security note: GitHub Pages nie pozwala ustawić nagłówków HTTP, więc klikjackingu nie da się w pełni zablokować samą warstwą CDN. `frame-ancestors 'none'` jest egzekwowane wyłącznie przez nagłówek `Content-Security-Policy` dev-servera (przeglądarki ignorują tę dyrektywę w `<meta>`), dlatego wersja publikowana (GitHub Pages) polega na mechanizmie **hide-until-verified**: strona startuje ukryta (`#anti-clickjack`, `body{display:none!important}` w `index.html`), a `antiClickjack()` w `src/font-bootstrap.js` odsłania ją tylko po potwierdzeniu `top === self`. W sandboxowanym iframe (bez `allow-top-navigation`/`allow-scripts`) treść pozostaje ukryta — clickjacking zneutralizowany bez nagłówków. Pełne nagłówki `X-Frame-Options: DENY`/HSTS wymagają warstwy Cloudflare/Netlify. / Security note: GitHub Pages does not allow custom HTTP headers, so clickjacking cannot be fully blocked at the CDN layer alone. `frame-ancestors 'none'` is enforced only by the dev-server `Content-Security-Policy` header (browsers ignore the directive in a `<meta>` tag), so the published GitHub Pages build relies on a **hide-until-verified** mechanism: the page starts hidden (`#anti-clickjack`, `body{display:none!important}` in `index.html`), and `antiClickjack()` in `src/font-bootstrap.js` reveals it only after confirming `top === self`. Inside a sandboxed iframe (no `allow-top-navigation`/`allow-scripts`) the content stays hidden — clickjacking is neutralized without headers. Full `X-Frame-Options: DENY`/HSTS headers require a Cloudflare/Netlify layer.

## 👤 Autor / Author
**Marcin Bendkowski** — Senior Delivery Manager

* GitHub: [CiderBeny](https://github.com/CiderBeny)
