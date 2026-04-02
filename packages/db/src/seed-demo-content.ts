import type { ProseMirrorDoc } from "@colophony/types";

/**
 * Demo-specific ProseMirror documents for the video demo.
 *
 * The poetry document uses non-trivial formatting: mid-line indentation,
 * irregular stanza lengths, stepped lines, and caesura — critical for
 * demonstrating the platform's typographic rendering.
 */

export function demoPoetryDoc(): ProseMirrorDoc {
  return {
    type: "doc",
    attrs: {
      genre_hint: "poetry",
      smart_typography_applied: true,
      submission_metadata: {
        original_filename: "tidewater-elegies.txt",
        original_format: "text/plain",
        converted_at: "2026-03-10T11:20:00Z",
        converter_version: "1.0.0",
      },
    },
    content: [
      // === Poem I: "Low Country" ===
      {
        type: "poem_line",
        text: "I. Low Country",
        marks: [{ type: "small_caps" }],
      },
      { type: "stanza_break" },
      {
        type: "poem_line",
        text: "The marsh exhales at dusk\u2014a breath",
      },
      {
        type: "preserved_indent",
        attrs: { depth: 3 },
        text: "of salt and sediment,",
      },
      {
        type: "poem_line",
        text: "of cordgrass bending toward",
        marks: [{ type: "emphasis" }],
      },
      {
        type: "preserved_indent",
        attrs: { depth: 5 },
        text: "what it cannot name.",
      },
      { type: "stanza_break" },
      {
        type: "poem_line",
        text: "I have walked these flats in every season:",
      },
      {
        type: "poem_line",
        text: "the heron\u2019s patience,",
        marks: [
          {
            type: "smart_text",
            attrs: { original: "the heron's patience," },
          },
        ],
      },
      { type: "caesura", attrs: { width: 4 } },
      {
        type: "poem_line",
        text: "the oyster\u2019s slow cathedral.",
        marks: [
          {
            type: "smart_text",
            attrs: { original: "the oyster's slow cathedral." },
          },
        ],
      },
      { type: "stanza_break" },
      {
        type: "poem_line",
        text: "My grandmother said the tide keeps count",
      },
      {
        type: "poem_line",
        text: "of everything we owe.",
      },
      {
        type: "preserved_indent",
        attrs: { depth: 2 },
        text: "I believe her now\u2014",
        marks: [
          {
            type: "smart_text",
            attrs: { original: "I believe her now---" },
          },
        ],
      },
      {
        type: "preserved_indent",
        attrs: { depth: 4 },
        text: "standing ankle-deep",
      },
      {
        type: "preserved_indent",
        attrs: { depth: 6 },
        text: "in the debt of it.",
      },
      { type: "stanza_break" },

      // === Poem II: "Inventory" ===
      {
        type: "poem_line",
        text: "II. Inventory",
        marks: [{ type: "small_caps" }],
      },
      { type: "stanza_break" },
      {
        type: "poem_line",
        text: "Three blue jars on the windowsill.",
      },
      {
        type: "poem_line",
        text: "Two sparrows nesting under the eave.",
      },
      {
        type: "poem_line",
        text: "One letter, unfinished,",
      },
      {
        type: "preserved_indent",
        attrs: { depth: 3 },
        text: "folded into the shape",
      },
      {
        type: "preserved_indent",
        attrs: { depth: 5 },
        text: "of an apology.",
      },
      { type: "stanza_break" },
      {
        type: "poem_line",
        text: "The afternoon arranges itself",
      },
      {
        type: "poem_line",
        text: "around your absence:",
      },
      { type: "caesura", attrs: { width: 3 } },
      {
        type: "poem_line",
        text: "the clock\u2019s companionable tick,",
        marks: [
          {
            type: "smart_text",
            attrs: { original: "the clock's companionable tick," },
          },
        ],
      },
      {
        type: "poem_line",
        text: "the radiator\u2019s sigh.",
        marks: [
          {
            type: "smart_text",
            attrs: { original: "the radiator's sigh." },
          },
        ],
      },
      { type: "stanza_break" },
      {
        type: "poem_line",
        text: "I am learning to read",
      },
      {
        type: "preserved_indent",
        attrs: { depth: 2 },
        text: "the braille of empty rooms\u2014",
        marks: [
          {
            type: "smart_text",
            attrs: { original: "the braille of empty rooms---" },
          },
        ],
      },
      {
        type: "poem_line",
        text: "each surface a sentence",
      },
      {
        type: "poem_line",
        text: "about what it used to hold.",
        marks: [{ type: "emphasis" }],
      },
      { type: "stanza_break" },

      // === Poem III: "Tidewater" ===
      {
        type: "poem_line",
        text: "III. Tidewater",
        marks: [{ type: "small_caps" }],
      },
      { type: "stanza_break" },
      {
        type: "poem_line",
        text: "Where the river meets the sea",
      },
      {
        type: "poem_line",
        text: "neither wins.",
      },
      { type: "stanza_break" },
      {
        type: "poem_line",
        text: "The water turns brackish, half-decided,",
      },
      {
        type: "poem_line",
        text: "the way grief settles",
      },
      {
        type: "preserved_indent",
        attrs: { depth: 3 },
        text: "into something you can live beside",
      },
      {
        type: "preserved_indent",
        attrs: { depth: 5 },
        text: "if not inside.",
      },
      { type: "stanza_break" },
      {
        type: "poem_line",
        text: "I bring flowers to the mudflat",
      },
      {
        type: "poem_line",
        text: "and the mudflat swallows them",
      },
      {
        type: "preserved_indent",
        attrs: { depth: 2 },
        text: "without ceremony.",
      },
      { type: "stanza_break" },
      {
        type: "poem_line",
        text: "This is the only honest altar:",
      },
      { type: "caesura", attrs: { width: 5 } },
      {
        type: "poem_line",
        text: "the one that takes",
      },
      {
        type: "preserved_indent",
        attrs: { depth: 3 },
        text: "and gives back nothing",
      },
      {
        type: "preserved_indent",
        attrs: { depth: 5 },
        text: "but the smell of salt",
      },
      {
        type: "preserved_indent",
        attrs: { depth: 7 },
        text: "and the sound of going.",
        marks: [{ type: "emphasis" }],
      },
    ],
  };
}

export function demoFictionDoc(): ProseMirrorDoc {
  return {
    type: "doc",
    attrs: {
      genre_hint: "prose",
      smart_typography_applied: true,
      submission_metadata: {
        original_filename: "the-cartographers-daughter.docx",
        original_format:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        converted_at: "2026-02-20T09:00:00Z",
        converter_version: "1.0.0",
      },
    },
    content: [
      {
        type: "paragraph",
        attrs: { indent: false },
        text: "My father drew maps of places that no longer existed.",
        marks: [
          {
            type: "smart_text",
            attrs: {
              original: "My father drew maps of places that no longer existed.",
            },
          },
        ],
      },
      {
        type: "paragraph",
        attrs: { indent: true },
        text: "Not imaginary places\u2014real ones. Towns swallowed by reservoirs, neighborhoods razed for highways, islands that had quietly slipped beneath the rising tide. He worked from old surveys, census records, the recollections of people who had lived in these vanished geographies and carried them now only in memory.",
        marks: [
          {
            type: "smart_text",
            attrs: {
              original:
                "Not imaginary places---real ones. Towns swallowed by reservoirs, neighborhoods razed for highways, islands that had quietly slipped beneath the rising tide. He worked from old surveys, census records, the recollections of people who had lived in these vanished geographies and carried them now only in memory.",
            },
          },
        ],
      },
      {
        type: "paragraph",
        attrs: { indent: true },
        text: "\u201CEvery place deserves to be remembered,\u201D he told me once, bent over his drafting table at two in the morning, his reading lamp throwing a circle of yellow light across a half-finished rendering of a mill town in West Virginia that had been underwater since 1966. \u201CThe land doesn\u2019t forget. The water doesn\u2019t forget. Only we forget.\u201D",
        marks: [
          {
            type: "smart_text",
            attrs: {
              original:
                '"Every place deserves to be remembered," he told me once, bent over his drafting table at two in the morning, his reading lamp throwing a circle of yellow light across a half-finished rendering of a mill town in West Virginia that had been underwater since 1966. "The land doesn\'t forget. The water doesn\'t forget. Only we forget."',
            },
          },
        ],
      },
      { type: "section_break" },
      {
        type: "paragraph",
        attrs: { indent: false },
        text: "I was twelve when I understood that my father\u2019s maps were a form of grief.",
      },
      {
        type: "paragraph",
        attrs: { indent: true },
        text: "We had driven to the Quabbin Reservoir in Massachusetts\u2014a vast, glittering body of water that supplies Boston, built in the 1930s by flooding four entire towns. Dana, Enfield, Greenwich, Prescott. My father parked the car at the overlook and unrolled one of his maps across the hood.",
      },
      {
        type: "paragraph",
        attrs: { indent: true },
        text: "\u201CThere,\u201D he said, pointing to a spot near the center of the water. \u201CThat\u2019s where the Enfield town common was. There was a bandstand. A general store called Aldrich\u2019s. A church with a bell that you could hear from three hills away.\u201D",
        marks: [
          {
            type: "smart_text",
            attrs: {
              original:
                '"There," he said, pointing to a spot near the center of the water. "That\'s where the Enfield town common was. There was a bandstand. A general store called Aldrich\'s. A church with a bell that you could hear from three hills away."',
            },
          },
        ],
      },
      {
        type: "paragraph",
        attrs: { indent: true },
        text: "I looked where he was pointing. There was only water, flat and green-gray under an overcast sky. A loon called from somewhere near the far shore, its voice carrying across the silence like a question that expected no answer.",
      },
      {
        type: "block_quote",
        content: [
          {
            type: "paragraph",
            attrs: { indent: false },
            text: "To make a map of a drowned place is an act of faith\u2014the belief that naming what is gone is better than letting it slip unnamed into the dark.",
            marks: [{ type: "emphasis" }],
          },
        ],
      },
      {
        type: "paragraph",
        attrs: { indent: true },
        text: "He died in the spring, during the kind of soft gray rain he always said was good for thinking. I found seventy-three unfinished maps in his studio, each one a window into a world that existed now only in ink and memory and the steady, patient hand of a man who believed that disappearance was not the same as absence.",
      },
    ],
  };
}
