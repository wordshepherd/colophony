import { describe, it, expect } from "vitest";
import {
  extractBranchingConfig,
  isBranchActive,
  evaluateFieldVisibilityWithBranching,
} from "../conditional-rules";

// ---------------------------------------------------------------------------
// Helpers — build test field structures
// ---------------------------------------------------------------------------

function makeField(
  fieldKey: string,
  opts: {
    branchId?: string | null;
    branchingEnabled?: boolean;
    branches?: Array<{ id: string; name: string; optionValues: string[] }>;
  } = {},
) {
  const config: Record<string, unknown> = {};
  if (opts.branchingEnabled && opts.branches) {
    config.branching = {
      enabled: true,
      branches: opts.branches,
    };
  }
  return {
    fieldKey,
    branchId: opts.branchId ?? null,
    config,
  };
}

// ---------------------------------------------------------------------------
// extractBranchingConfig
// ---------------------------------------------------------------------------

describe("extractBranchingConfig", () => {
  it("returns null for null config", () => {
    expect(extractBranchingConfig(null)).toBeNull();
  });

  it("returns null when config has no branching key", () => {
    expect(extractBranchingConfig({ options: [] })).toBeNull();
  });

  it("returns null for invalid branching config", () => {
    expect(
      extractBranchingConfig({ branching: { enabled: "yes" } }),
    ).toBeNull();
  });

  it("parses valid branching config", () => {
    const result = extractBranchingConfig({
      branching: {
        enabled: true,
        branches: [
          {
            id: "550e8400-e29b-41d4-a716-446655440000",
            name: "Poetry",
            optionValues: ["poetry"],
          },
        ],
      },
    });
    expect(result).not.toBeNull();
    expect(result!.enabled).toBe(true);
    expect(result!.branches).toHaveLength(1);
    expect(result!.branches[0].name).toBe("Poetry");
  });
});

// ---------------------------------------------------------------------------
// isBranchActive
// ---------------------------------------------------------------------------

describe("isBranchActive", () => {
  const BRANCH_POETRY_ID = "550e8400-e29b-41d4-a716-446655440001";
  const BRANCH_FICTION_ID = "550e8400-e29b-41d4-a716-446655440002";
  const BRANCH_SUB_ID = "550e8400-e29b-41d4-a716-446655440003";

  const genreField = makeField("genre", {
    branchingEnabled: true,
    branches: [
      { id: BRANCH_POETRY_ID, name: "Poetry", optionValues: ["poetry"] },
      { id: BRANCH_FICTION_ID, name: "Fiction", optionValues: ["fiction"] },
    ],
  });

  it("returns true when source field value matches branch optionValues", () => {
    const result = isBranchActive(BRANCH_POETRY_ID, [genreField], {
      genre: "poetry",
    });
    expect(result).toBe(true);
  });

  it("returns false when value does not match", () => {
    const result = isBranchActive(BRANCH_POETRY_ID, [genreField], {
      genre: "fiction",
    });
    expect(result).toBe(false);
  });

  it("returns false when source field is empty/undefined", () => {
    expect(isBranchActive(BRANCH_POETRY_ID, [genreField], {})).toBe(false);
    expect(
      isBranchActive(BRANCH_POETRY_ID, [genreField], { genre: null }),
    ).toBe(false);
    expect(
      isBranchActive(BRANCH_POETRY_ID, [genreField], { genre: undefined }),
    ).toBe(false);
  });

  it("handles multi-option branches (optionValues: ['poetry', 'drama'])", () => {
    const multiField = makeField("genre", {
      branchingEnabled: true,
      branches: [
        {
          id: BRANCH_POETRY_ID,
          name: "Verse",
          optionValues: ["poetry", "drama"],
        },
      ],
    });
    expect(
      isBranchActive(BRANCH_POETRY_ID, [multiField], { genre: "poetry" }),
    ).toBe(true);
    expect(
      isBranchActive(BRANCH_POETRY_ID, [multiField], { genre: "drama" }),
    ).toBe(true);
    expect(
      isBranchActive(BRANCH_POETRY_ID, [multiField], { genre: "fiction" }),
    ).toBe(false);
  });

  it("handles array values (multi-select/checkbox_group)", () => {
    expect(
      isBranchActive(BRANCH_POETRY_ID, [genreField], {
        genre: ["poetry", "nonfiction"],
      }),
    ).toBe(true);
    expect(
      isBranchActive(BRANCH_POETRY_ID, [genreField], {
        genre: ["fiction", "nonfiction"],
      }),
    ).toBe(false);
  });

  it("returns false when source field itself is in an inactive branch (sub-branching)", () => {
    // sub_genre is a branching field that lives in the poetry branch
    const subGenreField = makeField("sub_genre", {
      branchId: BRANCH_POETRY_ID,
      branchingEnabled: true,
      branches: [{ id: BRANCH_SUB_ID, name: "Haiku", optionValues: ["haiku"] }],
    });

    const fields = [genreField, subGenreField];

    // genre = fiction → poetry branch inactive → sub-branch inactive
    expect(
      isBranchActive(BRANCH_SUB_ID, fields, {
        genre: "fiction",
        sub_genre: "haiku",
      }),
    ).toBe(false);

    // genre = poetry, sub_genre = haiku → sub-branch active
    expect(
      isBranchActive(BRANCH_SUB_ID, fields, {
        genre: "poetry",
        sub_genre: "haiku",
      }),
    ).toBe(true);
  });

  it("handles circular branch references without infinite loop (returns false)", () => {
    // Field A branches on B's branch, Field B branches on A's branch — circular
    const branchA = "550e8400-e29b-41d4-a716-446655440010";
    const branchB = "550e8400-e29b-41d4-a716-446655440011";

    const fieldA = makeField("field_a", {
      branchId: branchB,
      branchingEnabled: true,
      branches: [{ id: branchA, name: "A", optionValues: ["a"] }],
    });
    const fieldB = makeField("field_b", {
      branchId: branchA,
      branchingEnabled: true,
      branches: [{ id: branchB, name: "B", optionValues: ["b"] }],
    });

    const result = isBranchActive(branchA, [fieldA, fieldB], {
      field_a: "a",
      field_b: "b",
    });
    expect(result).toBe(false);
  });

  it("returns false for unknown branch ID", () => {
    expect(
      isBranchActive("550e8400-e29b-41d4-a716-446655440099", [genreField], {
        genre: "poetry",
      }),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateFieldVisibilityWithBranching
// ---------------------------------------------------------------------------

describe("evaluateFieldVisibilityWithBranching", () => {
  const BRANCH_POETRY_ID = "550e8400-e29b-41d4-a716-446655440001";

  const genreField = makeField("genre", {
    branchingEnabled: true,
    branches: [
      { id: BRANCH_POETRY_ID, name: "Poetry", optionValues: ["poetry"] },
    ],
  });

  it("branch inactive → hidden, ignores conditional rules", () => {
    const result = evaluateFieldVisibilityWithBranching(
      {
        branchId: BRANCH_POETRY_ID,
        conditionalRules: [
          {
            effect: "SHOW" as const,
            condition: {
              operator: "AND" as const,
              rules: [
                { field: "other", comparator: "eq" as const, value: "yes" },
              ],
            },
          },
        ],
      },
      [genreField],
      { genre: "fiction", other: "yes" },
    );
    expect(result).toEqual({ visible: false, required: false });
  });

  it("branch active + HIDE condition met → hidden", () => {
    const result = evaluateFieldVisibilityWithBranching(
      {
        branchId: BRANCH_POETRY_ID,
        conditionalRules: [
          {
            effect: "HIDE" as const,
            condition: {
              operator: "AND" as const,
              rules: [
                {
                  field: "hide_field",
                  comparator: "eq" as const,
                  value: "yes",
                },
              ],
            },
          },
        ],
      },
      [genreField],
      { genre: "poetry", hide_field: "yes" },
    );
    expect(result).toEqual({ visible: false, required: false });
  });

  it("branch active + REQUIRE condition met → required", () => {
    const result = evaluateFieldVisibilityWithBranching(
      {
        branchId: BRANCH_POETRY_ID,
        conditionalRules: [
          {
            effect: "REQUIRE" as const,
            condition: {
              operator: "AND" as const,
              rules: [
                {
                  field: "make_required",
                  comparator: "eq" as const,
                  value: "yes",
                },
              ],
            },
          },
        ],
      },
      [genreField],
      { genre: "poetry", make_required: "yes" },
    );
    expect(result).toEqual({ visible: true, required: true });
  });

  it("no branchId → delegates to evaluateFieldVisibility", () => {
    const result = evaluateFieldVisibilityWithBranching(
      {
        branchId: null,
        conditionalRules: [
          {
            effect: "SHOW" as const,
            condition: {
              operator: "AND" as const,
              rules: [
                { field: "toggle", comparator: "eq" as const, value: "on" },
              ],
            },
          },
        ],
      },
      [genreField],
      { toggle: "on" },
    );
    expect(result).toEqual({ visible: true, required: false });
  });

  it("no branchId + no rules → visible and not required", () => {
    const result = evaluateFieldVisibilityWithBranching(
      { branchId: null, conditionalRules: null },
      [genreField],
      {},
    );
    expect(result).toEqual({ visible: true, required: false });
  });
});
