# AWS Security Maturity Model Assessment Tool

A web-based security self-assessment tool for evaluating your AWS cloud security posture across 4 maturity phases and 10 capability areas.

## Project Structure

```
maturity-model/
├── index.html              # Main application shell
├── vercel.json             # Vercel deployment config
├── css/
│   └── styles.css          # All styles
├── js/
│   └── app.js              # Application logic (async data loading)
└── data/
    ├── manifest.json        # Index of all data files
    ├── phase_1/             # Phase 1: Quick Wins (16 items)
    ├── phase_2/             # Phase 2: Foundational (20 items)
    ├── phase_3/             # Phase 3: Efficient (20 items)
    └── phase_4/             # Phase 4: Optimized (18 items)
```

Each JSON file in `data/phase_*/` follows this schema:

```json
{
  "id": "1.7.1",
  "phase": "Phase 1: Quick Wins",
  "capability": "Data protection",
  "recommendation": "Block Public Access",
  "aws_service": "S3 / EC2",
  "guidance": "Assessment guidance text...",
  "how_to_check": "How to verify..."
}
```

## Deploy to Vercel

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy
vercel

# 3. For production
vercel --prod
```

## Run Locally

```bash
# Option 1: npx serve
npx serve .

# Option 2: Python
python3 -m http.server 3000

# Option 3: VS Code Live Server extension
```

> ⚠️ You must use a local server — opening `index.html` directly via `file://` will block the JSON fetches due to CORS restrictions.

## Adding / Editing Assessment Items

Edit any JSON file under `data/phase_*/` or add a new one. Make sure to add the new file path to `data/manifest.json`:

```json
{
  "items": [
    "data/phase_1/your_new_item.json",
    ...
  ],
  "total": 75
}
```

## Features

- 📊 Live scoring with 8-point alignment scale
- 💾 Session persistence via localStorage
- 🖨️ Print preview with Color / B&W output options
- 📤 Export to CSV
- 🔍 Filter by phase, capability, or unassessed items
- 🎯 Radar chart and per-capability scoring
