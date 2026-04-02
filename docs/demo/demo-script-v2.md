# Colophony Demo Script — v2

**Format:** Story-led narration over screen recording
**Target runtime:** ~2:45–3:00
**Word count:** ~360
**Audience:** Writers and editors, non-technical
**Narration:** ElevenLabs — warm, unhurried, slightly literary. Speed ~0.94–0.98 with longer pauses at em dashes; let punctuation pace the delivery.
**Music:** Ambient instrumental, sparse piano, warm analog, no drums, ~70–80 BPM. Fade in at cold open; duck to -6 to -8 dB under VO; let it breathe again in outro. Integrated loudness target: -16 to -14 LUFS. Suno prompt: _"ambient instrumental, sparse piano, warm analog, focused, literary, no drums, 75 BPM, fade in/out"_

---

## SECTION 1 — COLD OPEN (~0:00–0:12)

_No narration. Music fades in. Hold on the writer's manuscript library._

> **SHOT:** Writer dashboard — a manuscript library, several pieces in different statuses. Unhurried. Hold for 3 seconds before the first word.

---

## SECTION 2 — THE WRITER'S SIDE (~0:12–0:58)

> Every piece of writing begins in private — drafted, revised, and finally: _ready._

> **SHOT:** Writer's manuscript library — poems and stories, each with its own entry.

> Colophony starts there — with the work itself. A poem, a story, an essay: each manuscript lives in a personal library, with its own version history. When a poet revises a sequence and wants to track which draft went where, that's all here.

> **SHOT:** A manuscript entry — multiple versions visible (v1, v2, v3). Lower third: **"Version history"**. Writer selects v2. Lower third: **"Choose version"**.

> When it's time to submit, writers pull from that library. The same manuscript can go out to multiple magazines at once — no re-uploading, no duplicate files, no losing track of which version went where.

> **SHOT:** The same poem attached to three separate submissions at three different magazines. Lower third: **"Submit once, reuse"**.

> Fill out the form, send it off, and everything joins the dashboard — every submission, every magazine, every status, all in one place.

> **SHOT:** Submission confirmed. Writer's dashboard shows the full picture: same piece, multiple destinations, each tracked independently.

---

## SECTION 3 — THE EDITORIAL SIDE (~0:58–1:48)

> On the other side of that submission, an editorial team is waiting.

> **SHOT:** Cut to editor view — submissions queue, new submission at the top. Compact, information-dense.

> Colophony gives editors everything they need to read, evaluate, and decide — without leaving the platform. There's no downloading files, no opening a separate document, no losing your place.

> **SHOT:** Editor opens a submission. The manuscript renders directly in the reading pane — prose in clean paragraph form, or poetry with line breaks and stanza spacing exactly as the writer intended. Reading-quality typography, generous margins. It looks like a book page, not a web form. Lower third: **"Print-quality rendering"**.

> Whether it's a short story or a sequence of poems, the work renders the way it was written. Line breaks are preserved. The platform even applies standard typographic conventions — curly quotes, proper dashes — with a toggle to see the original formatting whenever editors need it.

> **SHOT:** A poetry submission — stanza breaks and indentation clearly visible. Brief 0.5s flash of "bad" rendering (collapsed, plain text) before cutting to Colophony's final render, so the differentiator lands visually. Then: rapid A/B flicker on the "show as submitted" toggle. Lower third: **"Show as submitted"**.

> Submissions move through a configurable review pipeline — first reader impressions, scoring, editorial discussion, all the way to a final decision — with everything in one place.

> **SHOT:** Pipeline stages. A reader scores a piece; it advances. An editor leaves a note. Lower third: **"Review → Score → Discuss → Decide"**. Three quick micro-interactions (score, tag, comment) — keep avatars small, no clutter.

> When an editor steps away and comes back, the platform remembers exactly where they were in the manuscript.

> **SHOT:** Editor returns to a submission — reading position restored. A small toast appears: **"Resumed where you left off"**.

---

## SECTION 4 — THE ACCEPTANCE (~1:48–2:12)

> When a writer has the same piece out at several magazines — common practice — the question is what happens when one of them says yes.

> **SHOT:** Writer's dashboard — same piece showing as Pending at multiple magazines simultaneously.

> When one of those magazines makes a decision —

> **SHOT:** Editor marks the piece Accepted.

> — the writer hears about it immediately.

> **SHOT:** Writer's dashboard updates: **"Accepted"** badge animates in at one magazine. The other pending submissions for the same piece remain visible.

> And right from that same screen, they can withdraw from everywhere else — one action, no scrambling, no forgotten emails.

> **SHOT:** Writer clicks to withdraw. Confirm modal: _"Withdraw other submissions?"_ — a prefilled, courteous withdrawal note visible for 1 second. Statuses update in a clean cascade. Done.

---

## SECTION 5 — POST-ACCEPTANCE PIPELINE (~2:12–2:47)

> But the work doesn't end at yes.

> **SHOT:** Cut to publication pipeline — post-acceptance stages laid out. Lower third: **"Contract • Copyedit • Assemble • Publish"**.

> Colophony carries the piece all the way through: contributor agreement, copyediting, and issue assembly.

> **SHOT:** Contract generated and signed. Copyediting stage. Issue assembly — piece placed and ordered.

> And when it's ready, one click sends it to connected publishing platforms like WordPress or Ghost — no copy-pasting, no reformatting, no exporting files. The piece goes up exactly as it was finalized.

> **SHOT:** Editor clicks publish. The piece appears live on the magazine's website. Hold a beat. Briefly show a mapped style token ("Body — Serif") to imply consistent theming without getting technical.

> When it comes time to pay contributors, that's here too. Writers can submit their payment details directly through the platform, editors deposit funds, and year-end tax forms are supported where applicable. Lower third: **"Payouts • Tax forms"**.

> **SHOT:** Contributor payment view — payment details collected, payout sent, tax information on file. Use obviously fictional contributor names and data; blur any visible email addresses.

---

## SECTION 6 — OUTRO (~2:47–3:00)

_No narration. Music resolves quietly._

> **SHOT:** Colophony logotype fades up on deep navy (`#191c2b`). Tagline — _Submissions, managed._ — appears below in warm cream (`#f0e8d5`), with _managed._ in copper italic (`#c87941`). Hold 8 seconds. Fade to black.

---

## Production Notes

### Runtime and pacing

The section timings above total ~3:00. The cold open and outro have been trimmed from v1. If the edit still runs long, the first place to trim is the Section 3 reading-position restoration beat (2 lines of narration + 1 shot) — it's valuable but non-essential.

### Recording order

Record **editor-side flows first** — they require more account state and seeded submission data. Record writer-side flows in a fresh session with a clean account.

### Screens to record (hardest first)

1. Publication pipeline — contract, copyediting, issue assembly, CMS publish, live site (with style token visible)
2. Contributor payment view — fictional names and data; blur emails
3. Editorial pipeline — submissions queue, manuscript reading pane (prose), manuscript reading pane (poetry with bad/good rendering), scoring, pipeline stages, reading position restoration toast
4. Editor marking a piece Accepted
5. Writer's manuscript library — version history, attaching v2 to a submission
6. Writer's dashboard — same piece at multiple magazines, withdrawal confirm modal, cascade status update
7. Writer dashboard — Accepted badge animating in
8. Logotype / outro card (static; use `docs/branding/colophony-logotype-dark.svg` — open in browser for correct Playfair Display rendering)

### Poetry shot — critical detail

Choose a poem with **non-trivial formatting**: mid-line indentation, irregular stanza lengths, at least one dropped or stepped line. A sonnet or metrically uniform poem won't demonstrate the differentiator. The 0.5s "bad rendering" flash (collapsed plain text) before cutting to Colophony's render is the moment that makes the feature land — don't skip it.

### Prose rendering shot

Show generous margins, hyphenation off, widows and orphans handled cleanly. The goal is immediate legibility — it should read like a well-typeset page.

### On-screen lower thirds

Minimal, 2–3 words, consistent placement (lower-left), Lato Medium, warm cream on translucent navy. Never appear during narration pauses — time them to land just after the relevant shot cuts in.

| Moment                    | Lower third                              |
| ------------------------- | ---------------------------------------- |
| Manuscript library        | Version history                          |
| Attaching v2              | Choose version                           |
| Multi-submit view         | Submit once, reuse                       |
| Editor reading pane       | Print-quality rendering                  |
| Toggle A/B flicker        | Show as submitted                        |
| Pipeline stages           | Review → Score → Discuss → Decide        |
| Reading position restored | Toast: "Resumed where you left off"      |
| Acceptance                | "Accepted" badge animates in             |
| Post-acceptance stages    | Contract • Copyedit • Assemble • Publish |
| Payments                  | Payouts • Tax forms                      |

### Audio

- VO ducking: -6 to -8 dB under narration
- Integrated loudness: -16 to -14 LUFS
- Music breathes at full level during cold open and outro only
- Italicized words in the narration are emphasis cues — slightly slower, not louder
- Em dashes are natural breath pauses; honor them
- "no spreadsheets, no chasing people down over email" should carry a slight wry quality

### Compliance and privacy

- CMS: frame as "connected publishing platforms" — do not imply push to arbitrary destinations
- Tax: "year-end tax forms are supported where applicable" — do not imply global compliance or regulated custody
- Use obviously fictional magazine names (e.g., _The Meridian Review_, _Saltwater Quarterly_) and contributor names throughout
- Blur any visible email addresses in screen recordings
- Ensure captions are generated and reviewed before publishing
- Keyboard focus rings should be briefly visible during at least one interaction shot (accessibility signal)
- Color contrast: `#f0e8d5` on `#191c2b` exceeds WCAG AA — no adjustments needed

### Brand reference

- Logotype SVG: `docs/branding/colophony-logotype-dark.svg`
- Background: `#191c2b` (Deep Navy)
- Wordmark: `#f0e8d5` (Warm Cream)
- Accent / italic: `#c87941` (Copper)
- Body / UI: Lato
- Headings / logotype: Playfair Display Bold
