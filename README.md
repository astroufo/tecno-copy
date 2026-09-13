# TecnoIndicator

**Real-time 10-year forecasts for global oil, water & electricity prices.**

<img width="1672" height="941" alt="image" src="https://github.com/user-attachments/assets/2a4fb37c-0cb4-448a-b1f7-d4c19c833f0b" />

A modern, clean, professional single-page web application that delivers illustrative energy price forecasts with interactive data visualization, scenario analysis, and dynamic factor insights.

**Live demo:** [https://tecnoindicator.vercel.app/](https://tecnoindicator.vercel.app/)

---

## ✨ Features

- **Hero Dashboard** — Clean landing with project name, tagline, current date, and prominent “Start Forecast” CTA.
- **Interactive Prediction Tool**
  - Horizon slider (1–10 years)
  - Two commodity cards: **Brent Crude Oil (USD/barrel)**, **Global Water (USD/M^3)** and **Global Electricity (USD/MWh)**
  - Three scenarios per commodity: Average, Optimistic (Min), Pessimistic (Max)
  - Clean data table + interactive line chart (Chart.js)
- **Real-time Feel** — Live-updating timestamp + “Refresh Data” button that perturbs values within realistic ranges.
- **Key Factors & Drivers** — Dynamic grid of 8 major price influencers with:
  - Factor name + explanation
  - Impact direction & magnitude (↑/↓ High/Medium/Low)
  - Horizon-aware highlighting (longer forecasts emphasize structural drivers)
- **Export Options** — Download chart as PNG or table as CSV.
- **View all global continents** — One click, and you can have a glimpse on the data of all the continents on Earth - whether it's the Americans, Europe, Asia, and more!
- **Technical Transparency** — Collapsible “Show underlying assumptions” section.
- **Production Polish**
  - Dark-mode friendly design with teal/navy accents
  - Fully responsive (desktop + mobile)
  - Smooth animations & micro-interactions
  - Accessibility (ARIA labels, keyboard navigation, high contrast)
  - Clear disclaimers throughout

---

## 🚀 How to Use

### Quick Start (No installation required)

1. Download or clone this repository.
2. Open `index.html` in any modern browser (Chrome, Firefox, Edge, Safari).
3. Use the **horizon slider** to select 1–10 years.
4. View results in the cards, table, and interactive chart.
5. Click **Refresh Data** to simulate live market updates.
6. Scroll to the **Key Factors** section — relevance updates automatically with the horizon.
7. Use the **Export** buttons in the navbar to download data.

### Keyboard Shortcuts
- Press `/` (when focused on the page) to jump to the horizon slider.

All calculations run **client-side** — no backend or API keys needed.

---

## 🛠️ Code of Conduct

We welcome contributions from everyone, including **AI-generated and AI-assisted code**.

### Our Standards
- Be respectful and inclusive.
- Provide constructive feedback.
- Focus on improving the project.

### Contribution Guidelines
- All contributions are welcome (features, bug fixes, documentation, design improvements, etc.).
- **AI-generated / AI-assisted contributions are explicitly allowed**, but **you must rigorously test the codebase** before pushing to the main repository.
- Always run the site in multiple browsers and test responsiveness, chart rendering, data exports, and edge cases (horizon = 1 and horizon = 10).
- Open a Pull Request with a clear description of changes.
- Reference any related issues.

Violations of this Code of Conduct may result in temporary or permanent bans from the project.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 👤 Credits

**Author & Maintainer**  
[xfst14](https://github.com/xfst14)

Built as a demonstration project showcasing modern frontend development, data visualization, and client-side forecasting techniques.

Special thanks to the open-source community for Tailwind CSS and Chart.js.

---

## 📌 Disclaimer

These are **illustrative forecasts** based on historical trends and publicly known drivers.  
**Not financial advice.** Real energy markets are influenced by many unpredictable factors.
