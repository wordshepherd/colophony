# Colophony Brand Assets

> Canonical specifications and asset inventory for the Colophony visual identity.
> All SVGs require Playfair Display (loaded via Google Fonts import in the file).
> Open SVGs in a browser for correct rendering — most image viewers won't load the web font.

---

## Established Mark Specifications

| Element                  | Value                                                        |
| ------------------------ | ------------------------------------------------------------ |
| Wordmark typeface        | Playfair Display Bold                                        |
| Background (dark field)  | `#191c2b`                                                    |
| Wordmark color (dark)    | `#f0e8d5`                                                    |
| Wordmark color (light)   | `#191c2b`                                                    |
| Star mark / accent       | `#c87941`                                                    |
| Tagline secondary        | `#d8cfc2`                                                    |
| Light field background   | `#f0ebe0`                                                    |
| Star position (wordmark) | `translate(510, 186)` in 1000×400 viewBox                    |
| Tagline                  | "Submissions, managed." — roman + italic ochre on _managed._ |

## Star Geometry

Calligraphic four-pointed star with cubic bezier curves. Thick center, concave-tapered points.

- Outer radius: 18
- Waist (indent points): ±4.5
- Path:
  ```
  M 0,-18 C 1,-13 3,-6 4.5,-4.5 C 6,-3 13,-1 18,0
  C 13,1 6,3 4.5,4.5 C 3,6 1,13 0,18
  C -1,13 -3,6 -4.5,4.5 C -6,3 -13,1 -18,0
  C -13,-1 -6,-3 -4.5,-4.5 C -3,-6 -1,-13 0,-18 Z
  ```

## Color Palette

### Light Theme

| Role       | Name       | Hex       |
| ---------- | ---------- | --------- |
| Primary    | Navy       | `#191c2b` |
| Secondary  | Cream      | `#f0ebe0` |
| Accent     | Copper     | `#c87941` |
| Background | Warm White | `#f0e8d5` |
| Foreground | Near Black | `#121212` |

### Dark Theme

| Role              | Name        | Hex       |
| ----------------- | ----------- | --------- |
| Primary           | Deep Navy   | `#191c2b` |
| Secondary         | Slate       | `#3E4A59` |
| Accent            | Copper      | `#c87941` |
| Background        | Navy        | `#191c2b` |
| Foreground        | Warm Cream  | `#f0e8d5` |
| Tagline Secondary | Muted Cream | `#d8cfc2` |

### Color Guidelines

**Do:**

- Use deep midnight navy (`#191c2b`) as the foundational background for major interface elements
- Employ warm cream (`#f0e8d5`) generously as the primary workspace background
- Reserve copper (`#c87941`) exclusively for critical, high-stakes actions or meaningful state changes
- Maintain extremely high contrast for all text during long reading sessions

**Don't:**

- Never use copper as a decorative element in the interface
- Do not introduce cool or neutral grays — all neutrals maintain warmth
- Avoid pure white (`#ffffff`) or pure black (`#000000`) backgrounds
- Never use dark navy for body copy contexts; reserve for headers, cards, structural elements

## Typography

| Role               | Font             | Weight             | Size Range          |
| ------------------ | ---------------- | ------------------ | ------------------- |
| Headings           | Playfair Display | Bold               | 24–48px             |
| Subheadings        | Playfair Display | Regular/Italic     | 18–24px             |
| Body / UI          | Lato             | Regular            | 14–16px             |
| Labels / UI        | Lato             | Medium / Semi-Bold | 12–14px             |
| Critical Actions   | Playfair Display | Italic             | Contextual          |
| Manuscript reading | Literata         | Variable           | Per user preference |

**Productive friction:** Playfair Display Italic is used on critical decision labels (Accept, Decline, Hold) to introduce a moment of weight. Not on navigation, form labels, or standard buttons.

**Manuscript rendering:** Literata is used exclusively inside the ManuscriptRenderer. It never appears in interface chrome. Lato and Playfair never appear inside the ManuscriptRenderer.

## Asset Inventory

| File                           | Purpose                                                    |
| ------------------------------ | ---------------------------------------------------------- |
| `colophony-reference.svg`      | Canonical reference — navy background baked in             |
| `colophony-logotype-dark.svg`  | Cream wordmark, transparent background (for dark surfaces) |
| `colophony-logotype-light.svg` | Navy wordmark, transparent background (for light surfaces) |
| `colophony-logomark-dark.svg`  | C+star mark on navy (favicon, avatar, small format)        |
| `colophony-logomark-light.svg` | C+star mark on parchment (favicon, avatar, small format)   |

## Logomark Notes

The logomark is a capital C (Playfair Display Bold) with the calligraphic star cradled in the opening of the C. The star is always ochre (`#c87941`) in both dark and light variants — it's the one element that doesn't invert.

For favicon use, the logomark should be rendered at 32×32, 192×192, and 512×512. At very small sizes (16×16), consider the star alone without the C.

## Sub-Brand System

Four named subsystems referencing physical print production:

| Sub-brand    | Reference                          | Covers                                     |
| ------------ | ---------------------------------- | ------------------------------------------ |
| **Hopper**   | Feed mechanism on a printing press | Submission intake + editorial review       |
| **Slate**    | Writing surface / composing stone  | Publication pipeline + business operations |
| **Relay**    | Communication mechanism            | Notifications, correspondence, webhooks    |
| **Register** | Alignment mechanism on a press     | Identity, org config, federation           |

Sub-brand icons should be simple, geometric, and tactile — not illustrative. Consistent with parent palette.
