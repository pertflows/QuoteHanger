# QuoteHanger

A lighting-design widget for holiday-lighting contractors' websites. A
homeowner uploads a photo of their house, hangs lights on it, sees it at
night, gets a ballpark price, and leaves their contact details. The
contractor receives a priced lead.

- **`HANDOFF.md`** is the product brief and the source of truth.
- **`prototype.html`** is the original single-file prototype. The Next.js
  app ports it.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # math tests (footage, bulb spacing, bill of materials)
npm run typecheck
npm run lint
npm run build
```

Deploys to Vercel as a standard Next.js 14 app. No environment variables
are needed yet. Secrets go in the host's environment settings, never in
the repo.

## Layout

| Path | What it is |
|---|---|
| `src/config/catalog.ts` | Product catalog, RGB patterns, rates and editor settings (the only place prices live) |
| `src/lib/geometry.ts` | Polyline length, footage, even bulb spacing across corners |
| `src/lib/estimate.ts` | Bill of materials and total, shared by browser and server |
| `src/lib/design.ts` | Design document type (`designs.layout`) and validation |
| `src/lib/lead.ts` | Lead validation; recomputes the estimate server-side |
| `src/components/editor/` | The editor: React component, plain-canvas renderer, sample house |
| `src/app/api/leads/route.ts` | `POST /api/leads`, which currently only writes the lead to the server log |
| `tests/` | Vitest unit tests |

All coordinates are in image-pixel space (the photo's natural size, capped
at 1600 px wide). The screen is only a scaled view.
