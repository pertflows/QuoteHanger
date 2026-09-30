# HANDOFF — Litline (working name)

Put this file at the root of the new repo along with `prototype.html`. It is
the starting brief for whoever builds next, whether that's a person or a
Claude session. No credentials, keys or customer data belong in this file or
in the repo.

---

## 1. What we're building

This is a lighting designer that sits on the **contractor's own website**.
The homeowner does four things:

1. Uploads a photo of their house.
2. Hangs lights on it by clicking along the roofline, bushes and trees, and
   places wreaths and uplights.
3. Sees it at night and gets a ballpark price based on real footage.
4. Leaves their contact details to receive the design.

The contractor gets a lead that already has the photo, the design, the
footage, a bill of materials and an estimate attached.

After that, an optional AI pass turns the hand-drawn layout into a
photo-real render. The layout is the input to the AI, so the render only puts
lights where the homeowner put them.

**One-line pitch:** a website widget for lighting contractors that turns a
visitor into a qualified, priced lead while the contractor is asleep.

## 2. Why hand placement first, AI second

- **Pricing needs numbers.** A drawn strand has a length, and length times
  rate gives a price. An AI image gives you neither.
- **Accuracy.** Unguided AI invents lights and puts them in the wrong places.
  A contractor can't quote from that, and could be held to a picture they
  never drew.
- **Cost.** Drawing costs nothing, while every AI render costs about $0.06.
  Run the AI only after the contact step, or only when the contractor
  triggers it.
- **3D is out of scope.** You can't get an accurate model from one phone
  photo, and no competitor offers it. Revisit only if a customer asks and
  will pay.

## 3. Competitive landscape (researched September 2026; verify before relying on it)

| Product | Who uses it | How it works | Notes |
|---|---|---|---|
| LightMaster (lightmaster.io) | Contractor | Photo-real AI mockups plus a full field-service suite | Free to $99.99/mo; AI renders sold as credit packs |
| Strandr (strandr.com), formerly LightingElf | Contractor | Drag strands onto a photo; gives footage and strand counts | About $197/yr |
| Grants Pro Estimator | Contractor | Drag-and-drop on a photo, with measurements and wattage | |
| Holiday Home Concepts | Contractor | Draw-on-photo configurator with instant pricing | |
| LightHawk | Contractor | Design on a photo, then estimate and track the job | |
| PRO Landscape+ | Contractor | Drop fixtures on a daytime photo, then switch to night | Landscape plus holiday |
| Jolly Lights (iOS) | Contractor | Quick mockups; basic tier is free | |
| Design My Lights (designmylights.com) | Homeowner | Free drag-your-own tool with a "find installers" link | Closest thing aimed at homeowners |
| Light Designer (lightdesigner.org) | Homeowner | Upload a photo, preview a design, get a quote | **Check this one first.** It may already be the website-lead product |

**Where the opening is:** almost everything above is sold to contractors and
used in the driveway. What nobody seems to be doing well is a widget,
branded as the contractor and embedded on their own website, where the
homeowner designs it themselves and it arrives as a priced lead.
**Validate this before building much.** Check whether LightMaster, Strandr
or Light Designer already ship an embeddable homeowner widget.

## 4. What already exists

- **`prototype.html`** is one self-contained file with no dependencies.
  Open it in a browser. The live version is at
  https://claude.ai/artifact/LPt7kVDsYUdbJrZxbBiEBi (private to the owner).
  It demonstrates:
  - A three-step flow: Photo → Hang lights → Get my quote
  - Photo upload, or a built-in sample house drawn on canvas
  - A two-click scale tool that sets pixels per foot, which makes footage
    and price real
  - Products: C9 warm, C9 multicolor, mini lights, icicles, a permanent RGB
    track (warm, candy cane, red and green, animated rainbow), a lit wreath
    and an uplight
  - Draw, select, drag points, move, delete, undo and clear
  - Day/night slider and hold-to-compare
  - A bill of materials with an estimate, a contact form, and a preview of
    the lead card
- **The existing site:** the AI visualizer in `pertflows/holiday-hangers-li`
  (Next.js 14.2, React 18, TypeScript strict, Tailwind, Vercel, Gemini
  `gemini-3.1-flash-image` at about $0.06 per render). Image generation sits
  behind a vendor-neutral `ImageGenerationProvider` interface. There's a
  drafted, never-applied Postgres schema with `organization_id` on every
  row. **Reuse the provider interface and the schema draft. Don't rewrite
  them.**

## 5. How the prototype works (carry these ideas over)

- **Coordinates:** everything is stored in image-pixel space, at the photo's
  natural size capped at 1600 px wide. The screen is only a scaled view, so
  a design renders the same way on any device.
- **Design document** (becomes a JSON column):
  ```json
  {
    "photo": {"w": 1600, "h": 1000},
    "pxPerFt": 15.5,
    "scaleSource": "user",
    "strands": [{"id": 1, "product": "c9warm", "pts": [[510,421],[620,281]], "pattern": null}],
    "items":   [{"id": 9, "product": "wreath", "x": 850, "y": 660}]
  }
  ```
  `scaleSource` is `"user"` when the homeowner set the scale and
  `"estimated"` when it's a guess (the prototype assumes the photo is 50 ft
  wide). Quotes built on an estimated scale must say so.
- **Footage:** the sum of each strand's segment lengths divided by
  `pxPerFt`.
- **Bulbs:** placed along each strand at `spacingFt × pxPerFt`, with the
  leftover distance carried across corners so spacing stays even.
- **Night look:** the photo is multiplied by a dark blue, then a dark layer
  goes on top. Physical objects (wreath greenery, fixtures) are drawn before
  the night pass so they darken with the scene. Lights are drawn after, in
  additive (`lighter`) mode.
- **Glow:** pre-rendered radial-gradient sprites, cached by color and
  radius. Each bulb gets a glow, a colored core and a white hot spot. C9s
  and the RGB track also get a faint wash on the wall below.
- **Products** are data, not code. Each has a kind, spacing, bulb radius,
  colors, a rate and a per-foot or per-each unit. In the real product,
  **each contractor sets their own catalog and rates.**

## 6. Proposed stack (matches the existing site)

- Next.js 14 App Router, TypeScript strict, Tailwind. Node runtime for API
  routes.
- Port the canvas editor to a React component. Keep the render loop plain
  canvas: no three.js, no Fabric.js unless something forces it.
- **Embed:** a `<script>` tag that mounts an iframe pointing at
  `/{org}/design`. An iframe isolates the widget's CSS and security from
  the contractor's site. Pass the contractor's brand colors and logo as
  settings.
- Postgres (Supabase or Neon), using the drafted schema. Add
  `designs.layout jsonb`.
- Object storage (Supabase Storage, Vercel Blob or S3) for photos, rendered
  PNGs and AI renders.
- Shared rate limiting and idempotency storage (Upstash Redis or Vercel KV)
  before any public traffic.
- AI goes through the existing `ImageGenerationProvider`. The input is the
  photo plus a guide image (the drawn layout on a black background) plus a
  prompt telling the model to add only the marked lights.

## 7. Milestones

**M0: validate (1–2 weeks, before most of the code).**
- [ ] Answer: does any competitor already ship an embeddable homeowner
      widget? (See section 3.)
- [ ] Show `prototype.html` to 5–10 lighting contractors. Would they put it
      on their site, and what would they pay?
- [ ] Put the prototype on the current client's site behind a link and
      count completed designs and leads.

**M1: single-tenant widget (the first paying customer runs on this).**
- [ ] Port the editor into Next.js, with parity to the prototype
- [ ] Touch support: tap to add points and a visible Finish button, which
      the prototype has; test on a real phone
- [ ] Photo upload to storage, validated by magic bytes, 12 MB cap
- [ ] Contact step saves a lead (photo, layout, bill of materials,
      estimate) to the database, sends the contractor an email or text, and
      posts to their webhook
- [ ] Contractor catalog and rates stored as config
- [ ] "Concept, not a quote" disclosure on every render and email
- [ ] Shared rate limiting and idempotency storage

**M2: multi-tenant.**
- [ ] Organizations and accounts, with contractor login
- [ ] A lead inbox: list, detail (design picture, bill of materials,
      contact), status
- [ ] Settings for the catalog and rates, brand colors and logo, and the
      embed snippet
- [ ] Apply the schema and turn on row-level security per organization

**M3: AI finish and billing.**
- [ ] Layout-guided AI render, triggered after the contact step or by the
      contractor
- [ ] Stripe with metering. The meter is on AI renders or leads, never on
      drawing, because drawing is free to us.
- [ ] Jobber integration (the current client uses it) to push leads in

**Deferred / not doing:** 3D models; "type your address" satellite or Street
View imagery (Google Maps terms prohibit derivative works, so the input must
be the customer's own photo); route planning, crews and inventory (don't try
to match LightMaster feature for feature).

## 8. Open questions

1. Does anyone already do the homeowner widget? (This decides the whole
   idea.)
2. Pricing: a flat monthly fee per contractor, or per lead? Price it against
   LightMaster ($24.99–$99.99/mo) and Strandr (about $197/yr).
3. Should the homeowner see a price at all, or only "your design is on its
   way"? Some contractors won't want a number shown.
4. Scale when the homeowner skips the step: default to the 16 ft garage
   door rule, or have the contractor correct it afterwards?
5. What goes in the name, and is it available? (See the note below.)

## 9. Working agreements

- `main` is always deployable. Work on feature branches and merge through
  PRs.
- No vendor names outside the provider adapters.
- Never persist raw images without a reason. Hash them for accounting.
- No secrets in the repo. Use the host's environment settings.
