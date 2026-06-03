# ALS Connectome Dashboard

Interactive visualization of the ALS-inspired C. elegans connectome degeneration study.

**Live:** https://als-connectome-dashboard.vercel.app

## Tech Stack
- Next.js 16 (App Router)
- TypeScript
- Recharts
- Tailwind CSS 4

## Structure
- `src/app/page.tsx` — main dashboard, tab navigation
- `src/components/phases/` — one component per phase
- `src/lib/simulation.ts` — live TypeScript simulation engine
- `src/lib/connectome.ts` — C. elegans connectome data

## Tabs (28 total)
Organized in 5 sections:
- Overview
- Origin (Phase 0A, 0B, 0C)
- Explorations (Phase Transition, Multi-seed, Topology SA)
- Early Phases (Phase 1A, 1B, 1C, 2, 3, 4)
- Core Findings (Phase 5, 6, 7, 8, 9, 10, 11/12, 13/14)
- Round 2 (R2.1, R2.2, R2.3, R2.4, R2.5, R2.7, R2.8)

## Development

```bash
npm install
npm run dev
```

## Disclaimer

Computational modelling study.
Not peer-reviewed. Not a clinical model.
All results hypothesis-generating only.
