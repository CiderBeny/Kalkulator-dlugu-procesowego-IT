# Process Debt Engine

[PL] **Process Debt Engine** to narzędzie typu SPA (Single Page Application) zaprojektowane dla IT Managerów i liderów operacyjnych. Pozwala na kwantyfikację finansową nieefektywności w procesach IT (tzw. długu procesowego) i przekłada zmarnowane roboczogodziny na realne straty budżetowe.

[EN] **Process Debt Engine** is a Single Page Application (SPA) designed for IT Managers and operational leaders. It enables the financial quantification of IT process inefficiencies (Process Debt) and translates wasted man-hours into tangible budgetary losses.

---

## 🇵🇱 Opis Projektu (Polish)

### Cel
W świecie IT Service Managementu często trudno jest przekonać zarząd do inwestycji w automatyzację, używając jedynie argumentów technicznych. To narzędzie służy do budowania **Business Case** – pokazuje czarno na białym, ile kosztuje organizację brak automatyzacji, słaba jakość danych w CMDB czy nieefektywny proces Change Managementu.

### Kluczowe Funkcje
* **Kalkulacja Kosztu Chaosu:** OPEX waste, Risk Exposure, Opportunity Loss, Net Debt, Payback Period — wyliczenia oparte na 10 pytaniach diagnostycznych (Manual Effort, Lead Time, Documentation Standard, Downtime Cost, Human Errors, itd.).
* **Model Finansowy Multi-Czynnikowy:** NPV/IRR oparte na 14 konfigurowalnych mnożnikach — premia kontekstu, szybkość erozji, stopa dyskonta, horyzont inwestycji, lewary, współczynniki scenariuszy i parametry Monte Carlo.
* **WACC 9.3% (Damodaran 2025):** domyślna stopa dyskonta dla branży Software (edytowalna — suwak 5–20%).
* **IRR z 6-miesięcznym ramp-upem:** przychody ze scenariusza inwestycyjnego narastają stopniowo przez pierwsze 6 miesięcy — realistyczny rollout.
* **Tax Shield:** wartość odpisów amortyzacyjnych CAPEX włączona do NPV (zależna od stawki CIT).
* **Region Presets (PL/EU/US):** predefiniowane stawki (wynagrodzenie, CAPEX, WACC) z automatycznym przeliczeniem walut wg aktualnych kursów NBP.
* **Benchmark DORA:** 3 metryki (Lead Time, Manual Effort, Human Error Rate) klasyfikowane według standardu DORA (Elite / High / Medium / Low) z kolorowaniem i opisem.
* **Porównanie Scenariuszy Inwestycyjnych:** 3 ścieżki — "Do Nothing" (brak inwestycji), "Targeted Investment" (twój poziom automatyzacji + CAPEX), "Full Automation (80%)" (maksymalna automatyzacja, 1.5× CAPEX) — z automatyczną rekomendacją najlepszej opcji.
* **Top 3 Financial Levers:** rankingowane rekomendacje (Process Automation, Risk Reduction, Innovation Runway, Management Efficiency, Retention & Burnout) z szacowanym odzyskiem rocznym, poziomem wysiłku i timeline.
* **90-Dniowa Mapa Drogowa:** automatycznie generowana z top 3 levers — 3 fazy (Month 1: Foundation, Month 2–3: Core, Month 4–6: Scale) z konkretnymi zadaniami.
* **Analiza Wrażliwości + Monte Carlo:** worker przelicza rozkłady wyników przy losowych perturbacjach parametrów zgodnie z zadaną siłą korelacji.
* **Wizualizacje:** 3 interaktywne wykresy Chart.js — Waterfall Capacity Erosion, Strategic Debt Bridge, Risk Heatmap + wykres wrażliwości NPV.
* **Eksport Excel:** 5 arkuszy (Inputs, Financial Results, Top Levers, Scenario Comparison, DORA Benchmark) z pełną dokumentacją kalkulacji.
* **Eksport PDF:** Wielostronicowy raport A4 — strona 1 z pytaniami diagnostycznymi, strony 2+ ze screenshotami bloków (html2canvas + jsPDF).
* **Link współdzielenia:** Stan kalkulacji zakodowany w URL hash — skopiuj link i wyślij zespołowi.
* **Dwujęzyczność:** Pełny przełącznik EN/PL (~140 kluczy translacji każdy).
* **Offline Font Cache:** Space Grotesk + Inter cachowane jako base64 w localStorage — strona renderuje się z właściwymi fontami nawet offline.
* **Bezpieczeństwo:** Content-Security-Policy (CSP), SRI hashes na wszystkich CDN, walidacja localStorage przed użyciem w CSS, ochrona przed formula injection w Excelu.
* **Testy:** 76 testów automatycznych (bezpieczeństwo + audyt modelu) weryfikujących realny kod źródłowy, nie tylko kopię logiki.

### Wykorzystana Technologia
* **Frontend:** HTML5, Tailwind CSS + custom CSS (dark theme, CSS custom properties).
* **Logika:** Vanilla JavaScript (ES6+).
* **Model finansowy:** czysty JS bez frameworka — łatwy do audytu, testowania i weryfikacji.
* **Testy:** Node.js built-in test runner (`node:test`) — 76 testów (security + model audit).
* **Biblioteki:** Chart.js (wykresy), jsPDF + html2canvas (PDF), SheetJS/XLSX (Excel), Google Fonts Space Grotesk + Inter.
* **Źródła danych:** Damodaran (WACC 2025), Weinberg (1992), Mark et al. UC Irvine (2008), Parnin & DeLine IEEE (2010), NBP FX (kursy walut).
* **Hosting:** GitHub Pages (gotowe do deployu — brak backendu, wszystko w jednym pliku `index.html`).

---

## 🇺🇸 Project Overview (English)

### Purpose
In the world of IT Service Management, it's often difficult to convince the board to invest in automation using only technical arguments. This tool is designed to build a solid **Business Case** – it demonstrates exactly how much the lack of automation, poor CMDB data quality, or inefficient Change Management costs the organization.

### Key Features
* **Chaos Cost Calculation:** OPEX waste, Risk Exposure, Opportunity Loss, Net Debt, Payback Period — based on 10 diagnostic questions (Manual Effort, Lead Time, Documentation Standard, Downtime Cost, Human Errors, etc.).
* **Multi-Factor Financial Model:** NPV/IRR built on 14 configurable multipliers — context premium, erosion rate, discount rate, investment horizon, levers, scenario coefficients and Monte Carlo parameters.
* **WACC 9.3% (Damodaran 2025):** default discount rate for the Software industry (editable — 5–20% slider).
* **IRR with 6-Month Ramp-Up:** scenario cash flows build up gradually over the first 6 months — a realistic rollout assumption.
* **Tax Shield:** CAPEX depreciation value included in NPV (dependent on the CIT rate).
* **Region Presets (PL/EU/US):** predefined rates (salary, CAPEX, WACC) with automatic currency conversion using live NBP FX rates.
* **DORA Benchmark:** 3 metrics (Lead Time, Manual Effort, Human Error Rate) classified by DORA standards (Elite / High / Medium / Low) with color coding and descriptions.
* **Scenario Comparison:** 3 investment paths — "Do Nothing", "Targeted Investment" (your automation level + CAPEX), "Full Automation (80%)" (max automation, 1.5× CAPEX) — with auto-recommendation.
* **Top 3 Financial Levers:** Ranked recommendations (Process Automation, Risk Reduction, Innovation Runway, Management Efficiency, Retention & Burnout) with estimated annual recovery, effort level, and timeline.
* **90-Day Roadmap:** Auto-generated from top 3 levers — 3 phases (Month 1: Foundation, Month 2–3: Core, Month 4–6: Scale) with concrete tasks.
* **Sensitivity Analysis + Monte Carlo:** a worker simulates result distributions under random parameter perturbations according to the configured correlation strength.
* **Visualizations:** 3 interactive Chart.js charts — Waterfall Capacity Erosion, Strategic Debt Bridge, Risk Heatmap + an NPV sensitivity chart.
* **Excel Export:** 5 sheets (Inputs, Financial Results, Top Levers, Scenario Comparison, DORA Benchmark) with full calculation documentation.
* **PDF Export:** Multi-page A4 report — page 1 with diagnostic questions, pages 2+ with block screenshots (html2canvas + jsPDF).
* **Share Link:** Calculation state encoded in URL hash — copy the link and share with your team.
* **Bilingual:** Full EN/PL toggle (~140 translation keys each).
* **Offline Font Cache:** Space Grotesk + Inter cached as base64 in localStorage — renders with proper fonts even offline.
* **Security:** Content-Security-Policy (CSP), SRI hashes on all CDNs, localStorage validation before CSS injection, Excel formula injection guard.
* **Testing:** 76 automated tests (security + model audit) verifying the actual source code, not a replicated copy of the logic.

### Tech Stack
* **Frontend:** HTML5, Tailwind CSS + custom CSS (dark theme, CSS custom properties).
* **Logic:** Vanilla JavaScript (ES6+).
* **Financial model:** framework-free plain JS — easy to audit, test and verify.
* **Testing:** Node.js built-in test runner (`node:test`) — 76 tests (security + model audit).
* **Libraries:** Chart.js (charts), jsPDF + html2canvas (PDF), SheetJS/XLSX (Excel), Google Fonts Space Grotesk + Inter.
* **Data sources:** Damodaran (2025 WACC), Weinberg (1992), Mark et al. UC Irvine (2008), Parnin & DeLine IEEE (2010), NBP FX (currency rates).
* **Hosting:** GitHub Pages (ready to deploy — no backend, everything in a single `index.html`).

---

## 🚀 Jak uruchomić / How to run
1. Sklonuj repozytorium / Clone the repository.
2. Otwórz `index.html` w dowolnej przeglądarce / Open `index.html` in any web browser.
3. Projekt jest gotowy do hostowania na **GitHub Pages**.

## 🌐 Deployment na GitHub Pages / GitHub Pages deployment
* W ustawieniach repozytorium (Settings → Pages) wybierz branch `main` jako źródło deployu / In repository Settings → Pages select branch `main` as the deploy source.
* `.nojekyll` jest już dodany, więc pliki są serwowane bez przetwarzania Jekyll / `.nojekyll` is already present, so files are served without Jekyll processing.
* Po aktualizacji zawartości odśwież podgląd linku na LinkedIn (Post Inspector), aby wyczyścić cache obrazu OG / After content updates, refresh the LinkedIn link preview (Post Inspector) to clear the OG image cache.

## 👤 Autor / Author
**Marcin Bendkowski** — Senior Delivery Manager

* GitHub: [CiderBeny](https://github.com/CiderBeny)
