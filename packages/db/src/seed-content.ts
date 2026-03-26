import type { ProseMirrorDoc } from "@colophony/types";

/**
 * Pre-built ProseMirror documents for seed data.
 * Each function returns a realistic literary document exercising
 * the full node/mark vocabulary for its genre.
 */

export function proseFictionDoc(): ProseMirrorDoc {
  return {
    type: "doc",
    attrs: {
      genre_hint: "prose",
      smart_typography_applied: true,
      submission_metadata: {
        original_filename: "the-weight-of-small-things.txt",
        original_format: "text/plain",
        converted_at: "2026-01-15T10:30:00Z",
        converter_version: "1.0.0",
      },
    },
    content: [
      {
        type: "paragraph",
        attrs: { indent: false },
        text: "The morning light fell through the kitchen window in long, amber rectangles, catching the dust motes that swirled above the table where Clara sat with her coffee growing cold.",
        marks: [
          {
            type: "smart_text",
            attrs: {
              original:
                "The morning light fell through the kitchen window in long, amber rectangles, catching the dust motes that swirled above the table where Clara sat with her coffee growing cold.",
            },
          },
        ],
      },
      {
        type: "paragraph",
        attrs: { indent: true },
        text: "\u201CYou\u2019re not eating,\u201D her mother said from the stove, not turning around. The eggs hissed in the pan. \u201CYou never eat anymore.\u201D",
        marks: [
          {
            type: "smart_text",
            attrs: {
              original:
                '"You\'re not eating," her mother said from the stove, not turning around. The eggs hissed in the pan. "You never eat anymore."',
            },
          },
        ],
      },
      {
        type: "paragraph",
        attrs: { indent: true },
        text: "Clara traced a circle on the tablecloth with her finger. The fabric was worn thin in places, almost translucent\u2014she could see the dark wood beneath, the way old things reveal themselves when the surface wears away.",
        marks: [
          {
            type: "smart_text",
            attrs: {
              original:
                "Clara traced a circle on the tablecloth with her finger. The fabric was worn thin in places, almost translucent---she could see the dark wood beneath, the way old things reveal themselves when the surface wears away.",
            },
          },
        ],
      },
      {
        type: "section_break",
      },
      {
        type: "paragraph",
        attrs: { indent: false },
        text: "Three weeks later, the house was empty.",
      },
      {
        type: "paragraph",
        attrs: { indent: true },
        content: [
          {
            type: "paragraph",
            text: "She stood in the doorway of what had been her mother\u2019s room. The bed was stripped, the drawers pulled open and gaping. On the nightstand, a single earring\u2014a small gold hoop that caught the afternoon light and threw a bright comma against the wall. ",
          },
        ],
        text: "She stood in the doorway of what had been her mother\u2019s room. The bed was stripped, the drawers pulled open and gaping. On the nightstand, a single earring\u2014a small gold hoop that caught the afternoon light and threw a bright comma against the wall.",
      },
      {
        type: "block_quote",
        content: [
          {
            type: "paragraph",
            attrs: { indent: false },
            text: "It is the small things that carry the weight of a life. Not the grand gestures, not the declarations\u2014but the worn tablecloth, the mismatched earring, the coffee cup left unwashed in the sink.",
            marks: [{ type: "emphasis" }],
          },
        ],
      },
      {
        type: "paragraph",
        attrs: { indent: true },
        text: "Clara picked up the earring and closed her fist around it. The metal was warm, as if someone had only just set it down. She slipped it into her pocket and walked out through the kitchen, past the table where the tablecloth still lay, past the window where the light still fell in long rectangles, and out into a world that looked exactly the same as it always had, which was somehow the hardest part of all.",
      },
    ],
  };
}

export function poetryDoc(): ProseMirrorDoc {
  return {
    type: "doc",
    attrs: {
      genre_hint: "poetry",
      smart_typography_applied: true,
      submission_metadata: {
        original_filename: "cartography-of-absence.txt",
        original_format: "text/plain",
        converted_at: "2026-01-20T14:15:00Z",
        converter_version: "1.0.0",
      },
    },
    content: [
      // Stanza 1
      {
        type: "poem_line",
        text: "I have been mapping the places you are not:",
      },
      {
        type: "poem_line",
        text: "the chair at the kitchen table,",
        marks: [{ type: "emphasis" }],
      },
      {
        type: "poem_line",
        text: "the crease in the pillow",
      },
      {
        type: "preserved_indent",
        attrs: { depth: 2 },
        text: "that keeps your shape",
      },
      {
        type: "poem_line",
        text: "the way a river keeps the memory of stone.",
      },
      { type: "stanza_break" },
      // Stanza 2
      {
        type: "poem_line",
        text: "Each morning I trace the borders",
      },
      {
        type: "poem_line",
        text: "of this new country\u2014",
        marks: [
          {
            type: "smart_text",
            attrs: { original: "of this new country---" },
          },
        ],
      },
      {
        type: "preserved_indent",
        attrs: { depth: 3 },
        text: "its capital: the empty doorway,",
      },
      {
        type: "poem_line",
        text: "its anthem:",
      },
      {
        type: "caesura",
        attrs: { width: 3 },
      },
      {
        type: "poem_line",
        text: "the refrigerator\u2019s hum.",
      },
      { type: "stanza_break" },
      // Stanza 3
      {
        type: "poem_line",
        text: "They say cartographers once filled",
      },
      {
        type: "poem_line",
        text: "the unknown spaces with dragons.",
      },
      {
        type: "poem_line",
        text: "I fill mine with the sound",
      },
      {
        type: "preserved_indent",
        attrs: { depth: 2 },
        text: "of your name,",
      },
      {
        type: "poem_line",
        text: "which is another kind of monster entirely.",
        marks: [{ type: "emphasis" }],
      },
    ],
  };
}

export function creativeNonfictionDoc(): ProseMirrorDoc {
  return {
    type: "doc",
    attrs: {
      genre_hint: "creative_nonfiction",
      smart_typography_applied: true,
      submission_metadata: {
        original_filename: "field-notes-on-disappearing.docx",
        original_format:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        converted_at: "2026-02-01T09:45:00Z",
        converter_version: "1.0.0",
      },
    },
    content: [
      {
        type: "block_quote",
        content: [
          {
            type: "paragraph",
            attrs: { indent: false },
            text: "To pay attention, this is our endless and proper work.",
            marks: [{ type: "emphasis" }],
          },
          {
            type: "paragraph",
            attrs: { indent: false },
            text: "\u2014Mary Oliver",
            marks: [{ type: "small_caps" }],
          },
        ],
      },
      {
        type: "paragraph",
        attrs: { indent: false },
        text: "The last time anyone saw a Bachman\u2019s warbler was in 1988, in a cypress swamp near the Louisiana coast. The birder who spotted it\u2014a retired postal worker named ",
        marks: [
          {
            type: "smart_text",
            attrs: {
              original:
                "The last time anyone saw a Bachman's warbler was in 1988, in a cypress swamp near the Louisiana coast. The birder who spotted it---a retired postal worker named ",
            },
          },
        ],
      },
      {
        type: "paragraph",
        attrs: { indent: false },
        text: "Gerald Toussaint\u2014said it perched on a low branch for eleven seconds before vanishing into the understory. Eleven seconds. That\u2019s all we got.",
        marks: [
          {
            type: "smart_text",
            attrs: {
              original:
                "Gerald Toussaint---said it perched on a low branch for eleven seconds before vanishing into the understory. Eleven seconds. That's all we got.",
            },
          },
        ],
      },
      {
        type: "paragraph",
        attrs: { indent: true },
        text: "I think about those eleven seconds often. Not the bird itself\u2014I\u2019ve never been much of a birder\u2014but the arithmetic of attention. How many seconds do we spend looking at the things that are about to disappear? How many do we waste looking at things that have already gone?",
      },
      {
        type: "section_break",
      },
      {
        type: "paragraph",
        attrs: { indent: false },
        text: "My grandmother kept a list. Not of birds\u2014of words. Words she noticed falling out of common usage, words she heard less and less in the mouths of her neighbors and on the television news. ",
      },
      {
        type: "paragraph",
        attrs: { indent: true },
        content: [
          {
            type: "paragraph",
            text: "Scuppernong",
            marks: [{ type: "small_caps" }],
          },
        ],
        text: "Scuppernong. Persnickety. Lollygag. Cattywampus.",
        marks: [{ type: "small_caps" }],
      },
      {
        type: "paragraph",
        attrs: { indent: true },
        text: "She wrote them in a leather-bound journal with a fountain pen, one word per line, as if she were compiling an obituary column for the English language. When I asked her why, she said: \u201CBecause someone has to remember what we used to sound like.\u201D",
        marks: [
          {
            type: "smart_text",
            attrs: {
              original:
                'She wrote them in a leather-bound journal with a fountain pen, one word per line, as if she were compiling an obituary column for the English language. When I asked her why, she said: "Because someone has to remember what we used to sound like."',
            },
          },
        ],
      },
      {
        type: "paragraph",
        attrs: { indent: true },
        text: "The journal is in my desk drawer now. I add to it sometimes\u2014not words, but sounds. The click of a rotary phone. The particular static between radio stations. The whir of a film projector threading celluloid through its gate. These are my field notes on disappearing, my own small cartography of loss.",
      },
    ],
  };
}
