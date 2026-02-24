import { MergeField } from "@/lib/tiptap-merge-field-extension";

describe("MergeField extension", () => {
  it("has correct name", () => {
    expect(MergeField.name).toBe("mergeField");
  });

  it("is inline and atom", () => {
    const ext = MergeField.configure();
    const config = ext.config;
    expect(config.inline).toBe(true);
    expect(config.atom).toBe(true);
  });
});
