# AI Presentation Studio

A working web application for designers and art directors who build client presentations for many brands, industries and purposes.

**One presentation. Multiple visual directions. Zero unauthorized content changes.**

- Supply the content, pick the presentation type, select the clients/brands involved, configure *Presented By* and *Presented To* independently, and choose a visual direction.
- The engine lays out your text in any saved style. It never rewrites, translates, summarises or "fixes" wording. Every generated deck is verified word-for-word against the immutable source before export.
- Optional AI imagery through **Nano Banana Pro** (Google's Gemini image model), with review, regeneration and replacement. Text is never placed inside images.
- Real **PowerPoint (.pptx)** and **PDF** exports with editable text boxes, separate images/shapes, correct Arabic/RTL rendering and embedded fonts (PDF).

---

## Quick start

Requirements: Node 22+, PostgreSQL 14+, a Chromium/Chrome binary (used for PDF rendering and render validation).

```bash
cp .env.example .env          # edit DATABASE_URL, SESSION_SECRET, optionally GEMINI_API_KEY
npm install
npm run setup                 # prisma db push + seeds the 11 built-in visual styles
npm run build && npm start    # http://localhost:3000  (or: npm run dev)
```

The first visit opens the **workspace setup** page to create the owner account. Everything (clients, assets, styles, presentations, jobs, exports) is persisted in PostgreSQL and in `storage/`.

### Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Random string (cookie sessions) |
| `STORAGE_DIR` | Local file storage root (uploads, generated images, exports). Default `./storage`. Replace `src/lib/storage.ts` to use S3/GCS. |
| `GEMINI_API_KEY` | **Server-side only.** Enables Nano Banana Pro image generation and the optional AI structure planner. Without it, image requests fail with an explicit "setup required" message — nothing is simulated. |
| `NANO_BANANA_MODEL` | Default `gemini-3-pro-image-preview` (Nano Banana Pro). |
| `GEMINI_TEXT_MODEL` | Default `gemini-2.5-flash`; used only for structure-only planning (block grouping / image concepts). Output is validated so every block appears exactly once in order, otherwise the deterministic planner is used. |
| `CHROMIUM_PATH` | Optional path to Chromium/Chrome if auto-detection fails. |

### Tests

```bash
npm test                 # core pipeline (also: tests/amends.ts, tests/portrait.ts): EN / AR / mixed × 3 styles, multi-client, multi Presented By/To,
                         # long content (overflow → extra slides, fragments), per-slide regeneration, PPTX + PDF
npm run test:browser     # full UI flow in headless Chromium against a running server (setup → client → presentation →
                         # three-style comparison → editor → export downloads → images-ON path without key)
npm run preview "<presentation name>" 6   # screenshots of a stored deck to tests/out/
```

---

## Application structure

| Section | What it does |
| --- | --- |
| **Dashboard** | Recent presentations, create / rename / duplicate / delete, saved clients, saved styles, recent generation and export activity. |
| **Presentations** | Project list with search and status filter. Each project owns its content, configuration, brands, direction, generated images and exports. |
| **Create** | Three steps: paste or upload the content (PDF, Word, PowerPoint, text, CSV or an image — text is extracted, images and scanned PDFs via OCR), pick a concept (or ask for three), generate. Brands, Presented By / To, format, language, tone, AI images and cover details sit behind one collapsed "More details" panel with sensible defaults. |
| **Create / Setup (details)** | A. information (name, type incl. custom, language auto-detect + override, orientation horizontal 16:9 or vertical 9:16, content paste / upload `.txt .md .docx` / import from a previous project), B. clients & brands with roles and project-specific instructions, C. Presented By, D. Presented To (independent, multi-company, reorder, logos, contacts, custom names, can be disabled), E. optional metadata, visual direction (style picker with live previews, tone & voice, custom direction, brand-color behaviour, three-example toggle, AI images toggle). |
| **Generate** | Mode A: three meaningfully different directions on representative slides, side by side, select one → full deck. Mode B: direct generation with the selected style (asks to confirm a default if none is selected). |
| **Amends** | Chat-style revision requests, per slide (each slide has its own thread) or for the whole deck, from the editor side panel or the Amends tab. Requests are interpreted into design operations (size, color, alignment, position, background, images, layers, split, re-layout in another style, new image concept), applied, and can be undone. Wording is only changed when you dictate it in quotes, and the source block is updated as an authorized edit. Uses the Gemini text model when a key is set; a built-in English/Arabic rule interpreter otherwise. |
| **Editor** | Thumbnails, canvas with drag/resize, text/image/shape properties, layers, add/duplicate/delete/reorder slides, undo/redo, autosave, preview, regenerate one / several / all slides, change style for all or selected slides, replace images, integrity status. |
| **Images** | Review every Nano Banana Pro request: prompt, concept, status, regenerate (optionally with a new concept), replace with an upload, approve/reject. |
| **Export** | Integrity check, render validation, PPTX / PDF / both, warnings, separate downloads, export history. |
| **Brands** | Name, website, one optional "About this brand" note, colors, fonts, logos and rules. **Build automatically**: upload brand guidelines (PDF/Word/PowerPoint), logos or any images, or enter the website — logo, colors, fonts, description and rules are extracted and applied, then anything can be changed or removed. |
| **Clients & Brands (legacy name)** | Profiles (identity, positioning, colors, typography), assets (logos, variations, icons, product images, photos, references, guideline docs, fonts) with approval, brand rules by category, linked visual directions, usage. |
| **Concepts** (visual styles) | Reusable art directions with a structured spec (palette, color behaviour, composition, typography, image treatment, background, density, decorative elements, negative instructions) and live preview; duplicate built-ins; references & approved examples. |
| **Assets Library** | All uploads across clients. |
| **Generation History** | Generation jobs, exports, image generation with errors and attempts. |
| **Settings & Integrations** | Integration status (Nano Banana Pro, Chromium, DB, storage, fonts), font library (upload .ttf/.otf/.woff/.woff2 brand fonts; used in styles, client profiles and the editor; embedded in PDF), custom presentation types. |

---

## How content preservation works

1. The supplied text is stored verbatim as `Presentation.sourceContent` and parsed into ordered **ContentBlocks** (heading / subheading / paragraph / list item). Parsing only interprets line structure (blank lines, `#` headings, `-`/`•` bullets). Numbered items keep their numbers inside the text.
2. The layout engine (`src/lib/generation/engine.ts`) creates slide elements that **reference block IDs**. It may split a block across slides at sentence boundaries (fragments are indexed), move whole blocks to other slides, shrink text within a readability floor (22 px on the 1920 px canvas) and apply typography — nothing else.
3. `verifyIntegrity` (`src/lib/content/verify.ts`) re-assembles the rendered text per block (fragments in order), collapses whitespace only, and compares it to the source. Missing, modified, duplicated or reordered content are errors; user-added text is a warning. Running it is part of saving in the editor and of every export.
4. Export additionally validates rendering in Chromium (text overflow, broken images). Overflow is reported, never hidden.
5. Exports are flagged **Content verified** only when the check passes. The UI never claims preservation otherwise.
6. The optional AI planner only groups block IDs; its output is rejected unless it contains every block exactly once in source order.

Decorative text (slide numbers, section numerals, "Presented by" labels) and metadata are tagged by origin and excluded from the content comparison. In PowerPoint, uppercase heading styling is deliberately not applied so the stored wording stays exact (it is a visual CSS transform in PDF/preview).

## Brand identity vs. visual style

- A **Company** is any organisation (client brand, agency, partner, sponsor, recipient). Client brands carry colors, typography, assets and rules.
- A **VisualStyle** is independent of any client. The style's `colorBehavior` (plus a per-presentation override) decides how the primary client's colors are applied: as accent, as dominant surface, or not at all (style-dominant / monochrome). Logos are always the client's own. Brands in one presentation are never merged.
- Role-aware placement: primary client logo on content slides; partners/sponsors/collaborators in the cover footer; Presented By / Presented To rows on the cover and, when there are many, a dedicated participants slide.

## Orientation, tone and fonts

- **Orientation** is chosen per presentation: horizontal (1920×1080) or vertical (1080×1920). The layout engine adapts compositions (stacked covers, image bands, two-column cards) and exports use the matching page/slide size.
- **Tone & voice** live on a visual style (default) and can be overridden per presentation (serious, professional, fun, playful, bold, calm, luxurious, energetic, friendly, technical, inspirational, minimal + a free-text voice). Tone adjusts visual knobs (weights, rounding, spacing, uppercase) and image prompts. It never touches wording.
- **Fonts**: bundled Inter and Cairo, uploaded brand fonts (Settings → Fonts or “Upload a font…” inside any font selector) and common system fonts. Uploaded fonts render in the editor and are embedded in PDF; PPTX references the family name.

## Arabic / RTL

Text is kept as Unicode and rendered by engines that do real bidi and shaping: Chromium for preview, validation and PDF (fonts embedded as subsets, text stays selectable), and PowerPoint text runs with `rtl="1"` / `lang="ar-SA"` for PPTX. Each block has its own language/direction; slides in RTL presentations are mirrored. Bundled fonts: **Cairo** (Arabic + Latin) and **Inter**; add more `.ttf` files under `public/fonts` and register them in `src/lib/render/fonts.ts`.

## Export notes and known limitations

- **PPTX** (pptxgenjs): editable text boxes, separate images, shapes, logos. Gradient / image-with-overlay backgrounds are rasterised to a background picture (all other elements stay editable). Fonts are referenced, not embedded — install Inter/Cairo on the viewing machine for identical rendering. CSS image filters are not applied.
- **PDF** (Chromium): vector pages at 1920×1080 px, selectable text, embedded font subsets. Illustrator opens them; editability of Arabic text depends on the font being available on the designer's machine. Transparent overlays become separate objects.
- Pending/failed AI images export as empty areas and are listed in the export warnings.

## Architecture

- **Next.js 15 (App Router) + TypeScript**, Tailwind, Prisma, **PostgreSQL**; local disk storage (swap `src/lib/storage.ts` for object storage).
- Background jobs (`src/lib/jobs/runner.ts`): DB-persisted `GenerationJob`, `ExportJob` and `GeneratedImage` rows processed by an in-process queue that resumes after restarts (`src/instrumentation.ts`). For multi-instance deployments move the loop to a worker process.
- Image generation (`src/lib/images/nanobanana.ts`): official `@google/genai` SDK, server-side key only.
- Data model: Users, Companies (clients), BrandAssets, BrandGuidelines, VisualStyles, StyleReferences, CompanyVisualStyle links, Presentations, PresentationParticipants (clients + roles), PresentationCompanies (Presented By / To), ContentBlocks, Slides, SlideElements, GeneratedImages, StyleProposals, GenerationJobs, ExportJobs, ExportedFiles, ProjectHistory (see `prisma/schema.prisma`).
- Access control: every entity is scoped to the signed-in user; file routes check ownership; uploads are validated by type, size and image signature.
