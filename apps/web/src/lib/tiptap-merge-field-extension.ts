import { Node, mergeAttributes } from "@tiptap/core";

export interface MergeFieldAttributes {
  key: string;
  label: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mergeField: {
      insertMergeField: (attrs: MergeFieldAttributes) => ReturnType;
    };
  }
}

export const MergeField = Node.create({
  name: "mergeField",

  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      key: { default: "" },
      label: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-merge-field]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-merge-field": node.attrs.key,
        class:
          "inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium",
      }),
      node.attrs.label || node.attrs.key,
    ];
  },

  addCommands() {
    return {
      insertMergeField:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});
