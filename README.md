# Second Reader (Snap-Grade)

First-pass marking for handwritten answer scripts. A teacher photographs each page; **NVIDIA Nemotron 3.5 Super VL** on Nebius Token Factory reads the handwriting question by question, **Nemotron 3 Ultra** proposes marks strictly against the teacher's rubric with a one-line reason, and **plain code** caps marks, adds totals and highlights anything blank, unclear or uncertain. Nothing is final until the teacher approves it; then the register downloads as CSV.

Built for the Nebius x NVIDIA Global AI Hackathon. Work in progress: the full README (model-by-job table, measured agreement with hand marking, limitations) comes before submission.

## Run locally

Key in `../.env` (outside this repo): `NEBIUS_API_KEY=...`

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1           # http://localhost:3001
powershell -ExecutionPolicy Bypass -File .\start.ps1 -Fixture  # layout-only sample reading, development only
npm test                                                      # auditor: caps, rounding, flags, CSV
npm run smoke:vl -- path\to\page.jpg                          # one Super VL call on a photo
```

## Licence

MIT
