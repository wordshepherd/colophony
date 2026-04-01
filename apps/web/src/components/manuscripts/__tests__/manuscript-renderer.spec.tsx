import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ManuscriptRenderer } from "../manuscript-renderer";
import type { ProseMirrorDoc } from "@/lib/manuscript";

// Mock the font to avoid next/font/google in test environment
vi.mock("@/lib/fonts", () => ({
  literata: { className: "literata-mock" },
}));

function makeDoc(overrides: Partial<ProseMirrorDoc> = {}): ProseMirrorDoc {
  return {
    type: "doc",
    content: [],
    ...overrides,
  };
}

describe("ManuscriptRenderer", () => {
  it("renders prose paragraphs with Literata font class", () => {
    const doc = makeDoc({
      attrs: { genre_hint: "prose" },
      content: [
        {
          type: "paragraph",
          attrs: { indent: false },
          text: "First paragraph.",
        },
        {
          type: "paragraph",
          attrs: { indent: true },
          text: "Second paragraph.",
        },
      ],
    });

    const { container } = render(<ManuscriptRenderer content={doc} />);

    expect(container.querySelector(".literata-mock")).toBeTruthy();
    expect(screen.getByText("First paragraph.")).toBeTruthy();
    expect(screen.getByText("Second paragraph.")).toBeTruthy();

    // Both should be <p> elements
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(2);
  });

  it("renders section breaks as structural whitespace", () => {
    const doc = makeDoc({
      content: [
        { type: "paragraph", text: "Before." },
        { type: "section_break" },
        { type: "paragraph", text: "After." },
      ],
    });

    const { container } = render(<ManuscriptRenderer content={doc} />);

    // Section break is a div with my-8 class
    const sectionBreak = container.querySelector('[aria-hidden="true"]');
    expect(sectionBreak).toBeTruthy();
    expect(sectionBreak?.className).toContain("my-8");
  });

  it("renders poetry lines without wrapping", () => {
    const doc = makeDoc({
      attrs: { genre_hint: "poetry" },
      content: [
        { type: "poem_line", text: "Shall I compare thee to a summer's day?" },
        { type: "poem_line", text: "Thou art more lovely and more temperate." },
      ],
    });

    const { container } = render(<ManuscriptRenderer content={doc} />);

    const lines = container.querySelectorAll(".whitespace-pre");
    expect(lines).toHaveLength(2);
    expect(lines[0].textContent).toBe(
      "Shall I compare thee to a summer's day?",
    );
  });

  it("renders stanza breaks in poetry", () => {
    const doc = makeDoc({
      attrs: { genre_hint: "poetry" },
      content: [
        { type: "poem_line", text: "Line one." },
        { type: "stanza_break" },
        { type: "poem_line", text: "Line two." },
      ],
    });

    const { container } = render(<ManuscriptRenderer content={doc} />);

    const stanzaBreak = container.querySelector('[aria-hidden="true"]');
    expect(stanzaBreak).toBeTruthy();
    expect(stanzaBreak?.className).toContain("my-6");
  });

  it("renders preserved_indent with depth-based padding", () => {
    const doc = makeDoc({
      attrs: { genre_hint: "poetry" },
      content: [
        {
          type: "preserved_indent",
          attrs: { depth: 3 },
          text: "Indented line",
        },
      ],
    });

    const { container } = render(<ManuscriptRenderer content={doc} />);

    const indented = container.querySelector(".whitespace-pre");
    expect(indented).toBeTruthy();
    expect((indented as HTMLElement).style.paddingLeft).toBe("6em");
  });

  it("uses smart_text mark original when showAsSubmitted is true", () => {
    const doc = makeDoc({
      content: [
        {
          type: "paragraph",
          text: "\u201CHello,\u201D she said.",
          marks: [
            {
              type: "smart_text",
              attrs: { original: '"Hello," she said.' },
            },
          ],
        },
      ],
    });

    // Default: shows normalized text
    const { rerender } = render(<ManuscriptRenderer content={doc} />);
    expect(screen.getByText("\u201CHello,\u201D she said.")).toBeTruthy();

    // showAsSubmitted: shows original
    rerender(<ManuscriptRenderer content={doc} showAsSubmitted />);
    expect(screen.getByText('"Hello," she said.')).toBeTruthy();
  });

  it("renders normalized text when no smart_text mark present", () => {
    const doc = makeDoc({
      content: [{ type: "paragraph", text: "Plain text without marks." }],
    });

    render(<ManuscriptRenderer content={doc} />);
    expect(screen.getByText("Plain text without marks.")).toBeTruthy();
  });

  it("switches to PoetryRenderer for poetry genre hint", () => {
    const doc = makeDoc({
      attrs: { genre_hint: "poetry" },
      content: [{ type: "poem_line", text: "A line of verse." }],
    });

    const { container } = render(<ManuscriptRenderer content={doc} />);

    // Poetry uses manuscript-poetry class, not manuscript-prose
    expect(container.querySelector(".manuscript-poetry")).toBeTruthy();
    expect(container.querySelector(".manuscript-prose")).toBeNull();
  });

  it("uses ProseRenderer for creative_nonfiction genre", () => {
    const doc = makeDoc({
      attrs: { genre_hint: "creative_nonfiction" },
      content: [{ type: "paragraph", text: "An essay paragraph." }],
    });

    const { container } = render(<ManuscriptRenderer content={doc} />);

    expect(container.querySelector(".manuscript-prose")).toBeTruthy();
  });

  it("defaults to prose when no genre hint", () => {
    const doc = makeDoc({
      content: [{ type: "paragraph", text: "Default prose." }],
    });

    const { container } = render(<ManuscriptRenderer content={doc} />);

    expect(container.querySelector(".manuscript-prose")).toBeTruthy();
  });

  it("renders emphasis marks", () => {
    const doc = makeDoc({
      content: [
        {
          type: "paragraph",
          text: "emphasized text",
          marks: [{ type: "emphasis" }],
        },
      ],
    });

    const { container } = render(<ManuscriptRenderer content={doc} />);

    const em = container.querySelector("em");
    expect(em).toBeTruthy();
    expect(em?.textContent).toBe("emphasized text");
  });

  it("renders strong marks", () => {
    const doc = makeDoc({
      content: [
        {
          type: "paragraph",
          text: "bold text",
          marks: [{ type: "strong" }],
        },
      ],
    });

    const { container } = render(<ManuscriptRenderer content={doc} />);

    const strong = container.querySelector("strong");
    expect(strong).toBeTruthy();
    expect(strong?.textContent).toBe("bold text");
  });

  it("renders block quotes", () => {
    const doc = makeDoc({
      content: [
        {
          type: "block_quote",
          content: [{ type: "paragraph", text: "Quoted text." }],
        },
      ],
    });

    const { container } = render(<ManuscriptRenderer content={doc} />);

    const blockquote = container.querySelector("blockquote");
    expect(blockquote).toBeTruthy();
    expect(blockquote?.textContent).toBe("Quoted text.");
  });

  // -------------------------------------------------------------------------
  // Reading anchor behavior
  // -------------------------------------------------------------------------

  describe("reading anchor", () => {
    const threeNodeDoc = makeDoc({
      content: [
        { type: "paragraph", text: "First." },
        { type: "paragraph", text: "Second." },
        { type: "paragraph", text: "Third." },
      ],
    });

    it("renders data-node-index attributes on each top-level node", () => {
      const { container } = render(
        <ManuscriptRenderer content={threeNodeDoc} />,
      );

      const indexed = container.querySelectorAll("[data-node-index]");
      expect(indexed).toHaveLength(3);
      expect((indexed[0] as HTMLElement).dataset.nodeIndex).toBe("0");
      expect((indexed[1] as HTMLElement).dataset.nodeIndex).toBe("1");
      expect((indexed[2] as HTMLElement).dataset.nodeIndex).toBe("2");
    });

    it("scrolls to initialAnchor node on mount", async () => {
      const originalScrollIntoView = Element.prototype.scrollIntoView;
      const scrollMock = vi.fn();
      Element.prototype.scrollIntoView = scrollMock;

      const rafSpy = vi
        .spyOn(window, "requestAnimationFrame")
        .mockImplementation((cb) => {
          cb(0);
          return 0;
        });

      render(
        <ManuscriptRenderer
          content={threeNodeDoc}
          initialAnchor={{ nodeIndex: 1 }}
        />,
      );

      expect(scrollMock).toHaveBeenCalledWith({ block: "start" });

      rafSpy.mockRestore();
      Element.prototype.scrollIntoView = originalScrollIntoView;
    });

    it("fires onAnchorChange with topmost visible index after debounce", () => {
      vi.useFakeTimers();
      let observerCallback: IntersectionObserverCallback | undefined;
      const mockDisconnect = vi.fn();

      const MockObserver = vi.fn().mockImplementation(function (
        this: IntersectionObserver,
        cb: IntersectionObserverCallback,
      ) {
        observerCallback = cb;
        this.disconnect = mockDisconnect;
        this.observe = vi.fn();
        this.unobserve = vi.fn();
        this.takeRecords = vi.fn().mockReturnValue([]);
        Object.defineProperty(this, "root", { value: null });
        Object.defineProperty(this, "rootMargin", { value: "" });
        Object.defineProperty(this, "thresholds", { value: [0] });
      });
      vi.stubGlobal("IntersectionObserver", MockObserver);

      const onChange = vi.fn();
      render(
        <ManuscriptRenderer content={threeNodeDoc} onAnchorChange={onChange} />,
      );

      expect(MockObserver).toHaveBeenCalled();

      // Simulate nodes 1 and 2 becoming visible
      observerCallback!(
        [
          {
            isIntersecting: true,
            target: { dataset: { nodeIndex: "2" } },
          },
          {
            isIntersecting: true,
            target: { dataset: { nodeIndex: "1" } },
          },
        ] as unknown as IntersectionObserverEntry[],
        {} as IntersectionObserver,
      );

      // Not called yet (2s debounce)
      expect(onChange).not.toHaveBeenCalled();

      vi.advanceTimersByTime(2000);

      expect(onChange).toHaveBeenCalledWith({ nodeIndex: 1 });

      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it("does not create IntersectionObserver when onAnchorChange is omitted", () => {
      const MockObserver = vi.fn();
      vi.stubGlobal("IntersectionObserver", MockObserver);

      render(<ManuscriptRenderer content={threeNodeDoc} />);

      expect(MockObserver).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });
});
