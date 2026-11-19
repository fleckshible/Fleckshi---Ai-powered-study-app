# Revision Ledger

A distraction-free study tracker and **Syllabus Brain Study Notebook** built with Vite, vanilla JavaScript, `animejs` v4, and `motion` (`motion.dev`), designed with a Deep Carbon-Blue & Arctic White studio aesthetic.

## Features

- **Subjects, Chapters & Three-Mark Mastery:** Track every syllabus topic across `Read`, `Revised`, and `Practiced`, with a unified Subject Header Card, single-row Add Topic + Bulk Import composer, chapter grouping, filters, per-topic `"⋯"` action menu (`Focus on This`, `Notes & Doubts`, `Delete Topic`), semantic status badges (`Mastered`, `Due`, `Overdue`), and drag reordering.
- **Exam Planner & Readiness:** Optional exam dates per subject with countdowns, daily pace (`topics left / day`), weighted readiness percentages, and weak-spot detection.
- **Spaced Revision (`Today` view):** Automated `1 -> 3 -> 7 -> 21` day recall queue with active recall reveal, colored status badges, and confidence rating (`Hard`, `Good`, `Easy`).
- **Chrono-Engine Pomodoro (`Focus` view):** Draggable outer bezel dial (`5–120m`), flip digits, Web Audio procedural ambient synthesizer (`Drone`, `Rain`, `Theta Waves`), topic attachment, and a compact floating dock that reserves clearance in Notebook and Ledger views.
- **Stats & Activity Heatmap (`Stats` view):** XP, streaks, daily activity calendar, level badge, and per-subject completion metrics.
- **Study Notebook (Lazy-Loaded Gemini BYOK AI, 6-Tab Architecture):**
  - **6 Top Tabs (Single Navigation System):**
    1. **Home** (`#3B82F6` / `#1D4ED8`): Syllabus Brain Overview & Coverage Grid (or full-screen Scan Hero when no syllabus exists yet), with buttons opening Edit Tree, Scan/Paste, Apply to Ledger, and Generate Everything modals.
    2. **Sources** (`#06B6D4` / `#0E7490`): Unified source library with a single **Add Source** split menu (`Upload File / PDF`, `Camera Capture`, `Paste Text`, `Import Ledger Topic Notes`).
    3. **Chat** (`#14B8A6` / `#0F766E`): Centered streaming chat with a right-side **Citations & Options** drawer.
    4. **Learn** (`#8B5CF6` / `#6D28D9`; Mind Map `#F59E0B` / `#B45309`): In-page view chips for `Notes` (with `AI | Mine` segmented toggle), `Summary`, `Study Guide`, `FAQ`, `Glossary`, `Timeline`, and `Mind Map`.
    5. **Practice** (`#D946EF` / `#A21CAF`): In-page view chips for `Flashcards` (wired to spaced revision) and `Quiz` (with internal `Play | Build | History` segments).
    6. **Plan** (`#10B981` / `#047857`): Personalized revision plan with integrated Exam Date & Today Queue sync.
  - **Unified AI & Model Settings Modal:** Single source of truth for API key vault, live `models.list` discovery, `Fast` / `Balanced` / `Deep` presets, 5 per-task model routers (enforcing vision capability for OCR), `thinkingLevel` vs `thinkingBudget`, automatic fallback queue, default Grounding mode, and Effects (`Full / Balanced / Minimal`).
  - **Icon System v2 & Accessibility:** Duotone `20px`/`24px` SVG icons in rounded gradient tiles, zero idle icon loops (one-time mount draw-in + hover/focus micro-motion), ARIA `tablist`/`tab`/`tabpanel` with arrow-key navigation, modal/drawer focus trapping with focus restoration, and `visibilitychange` animation pausing.

## Windows PowerShell Commands

```powershell
# Run from inside the project folder:

# Install dependencies
npm install

# Run unit tests
node --test tests/core.test.mjs

# Start dev server
npm run dev

# Build production bundle
npm run build

# Preview built production bundle locally
npm run preview
```

## Using Study Notebook & Gemini BYOK

1. Open the **Notebook** tab in the left sidebar (or press `Ctrl+K` and choose `Open Study Notebook`).
2. Click **Set API Key** (`Key & Models`), paste your key from **Google AI Studio** (`aistudio.google.com/apikey`), and click **Test Key & Refresh Models**.
   - **Security Note:** By default, your key stays remembered in browser `localStorage` (**an unlocked key is readable by any script on this origin**). Optional passphrase encryption (`PBKDF2` + `AES-GCM`) is available in the modal. **API keys are never logged or exported in JSON backups.**
3. On **Home**, drop or photograph your syllabus (or import from existing Ledger topics). Review the extracted `Chapters -> Topics -> Subtopics` tree, click **Looks good — Save Syllabus Brain**, and optionally click **Apply to Ledger**.
4. Switch between **Home**, **Sources**, **Chat**, **Learn** (`Notes` with `AI | Mine` toggle, `Summary`, `Study Guide`, `FAQ`, `Glossary`, `Timeline`, `Mind Map`), **Practice** (`Flashcards` & `Quiz` with `Play | Build | History`), and **Plan** using the top tab bar or `ArrowLeft` / `ArrowRight` keys.
5. Use **Backup (`Data` button)** to export or import Ledger state alongside optional IndexedDB Notebooks (API keys are never included).
