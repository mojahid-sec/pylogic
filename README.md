# PYLOGIC — Think Better. Code Smarter. Build Stronger.

**PYLOGIC** is a completely free, static, bilingual (**English / বাংলা**) Python logic-building and real-world software & cybersecurity engineering learning platform ready for direct deployment on **GitHub Pages** with zero backend servers, zero databases, and zero login requirements.

---

## 1. Platform Highlights

- **20 Structured Curriculum Parts · 400 Bilingual Python Problems** (`src/data/parts/part01.json` – `part20.json`):
  - Foundations, Core Logic, Data Structures & Algorithms, Networking, Cybersecurity Programming, and AI-Era Interview Challenges.
  - Each problem includes bilingual problem statements, I/O specs, examples, required concepts, collapsible hints, algorithm breakdown, Python 3 solution, complexity analysis, test cases, attempt counter, personal notes, and bookmarking.
- **20 Real-World Story-Based Engineering Projects (4 Levels)** (`src/data/projects/level01.json` – `level04.json`, `src/data/stories/storyLevel01.json` – `storyLevel04.json`, `src/data/guides/guideLevel01.json` – `guideLevel04.json`):
  - Connected bilingual student engineering stories, Python Technologies & Tools guides, 10-step build roadmaps, 14-item completion trackers, and a 14-field personal engineering workspace (`myUnderstanding`, `myRequirements`, `myPythonConcepts`, `myLogic`, `myAlgorithm`, `projectPlan`, `architectureNotes`, `folderStructureNotes`, `implementationNotes`, `implementationDecisions`, `problemsFaced`, `howISolvedThem`, `testingResults`, `futureImprovements`, and validated `githubRepoUrl`) with zero pre-written code spoilers.
- **Private Per-Visitor Browser Storage (`localStorage`)**:
  - Every visitor's browser independently stores their own solved problems, attempt counts, notes, bookmarks, project workspaces, theme, language, and sidebar state. No accounts or logins are required, and personal progress is never uploaded to GitHub.
- **JSON Backup Export & Import (Settings → Backup & Privacy)**:
  - Export all personal progress into a single `pylogic-backup-YYYY-MM-DD.json` file.
  - Restore a backup file with strict schema validation and an explicit confirmation prompt before replacing existing browser data.
- **Editorial UI & Accessibility**:
  - Collapsible sidebar navigation, Light / Dark / System theme switcher, English / বাংলা language switch, comfortable/compact reading density, and full static GitHub Pages routing support (`#dashboard`, `#logic-building`, `#projects`, `#my-progress`, `#about-developer`, `#settings`).

---

## 2. Local Development

### Prerequisites
- Node.js `>= 20` and `npm`

### Commands
```bash
npm install
npm run dev      # Local dev server at http://localhost:3000
npm run lint     # TypeScript typecheck
npm test         # Run platform & content verification suite
npm run build    # Production build into ./dist/
```

---

## 3. Deploying Free to GitHub Pages

This repository includes:
- Relative asset base (`base: process.env.VITE_BASE_PATH || './'`) in `vite.config.ts` so scripts, stylesheets, and images load cleanly under both `https://<username>.github.io/<repo>/` and custom domains.
- `public/.nojekyll` so GitHub Pages serves static assets without Jekyll processing.
- `public/404.html` SPA redirect fallback if someone visits a subpath directly.
- `.github/workflows/deploy-pages.yml` automated GitHub Actions build-and-deploy workflow.

### Step-by-Step Upload & Publish Instructions

1. **Create a new public repository on GitHub** (for example, `pylogic`).
2. **Push this project to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "feat: PYLOGIC static GitHub Pages learning platform"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
3. **Enable GitHub Pages via GitHub Actions**:
   - Open your repository on GitHub → **Settings** → **Pages**.
   - Under **Build and deployment → Source**, select **GitHub Actions**.
4. **Trigger / Wait for Deployment**:
   - The `.github/workflows/deploy-pages.yml` workflow runs automatically on every push to `main` (and can also be triggered manually via **Actions → Deploy PYLOGIC to GitHub Pages → Run workflow**).
   - Once the workflow finishes, your public link will be:
     `https://<your-username>.github.io/<your-repo>/`

---

## 4. Creator

**MD. MOJAHIDUR RAHMAN SAJID** — Computer Science & Technology, Bogura Polytechnic Institute (`https://github.com/mojahid-sec`).
