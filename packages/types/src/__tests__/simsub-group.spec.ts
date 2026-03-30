import { describe, it, expect } from "vitest";
import {
  simsubGroupStatusSchema,
  createSimsubGroupSchema,
  updateSimsubGroupSchema,
  addSimsubGroupSubmissionSchema,
  removeSimsubGroupSubmissionSchema,
  listSimsubGroupsSchema,
} from "../simsub-group";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("simsubGroupStatusSchema", () => {
  it("accepts valid statuses", () => {
    expect(simsubGroupStatusSchema.parse("ACTIVE")).toBe("ACTIVE");
    expect(simsubGroupStatusSchema.parse("RESOLVED")).toBe("RESOLVED");
    expect(simsubGroupStatusSchema.parse("WITHDRAWN")).toBe("WITHDRAWN");
  });

  it("rejects invalid status", () => {
    expect(() => simsubGroupStatusSchema.parse("INVALID")).toThrow();
  });
});

describe("createSimsubGroupSchema", () => {
  it("parses valid input", () => {
    const result = createSimsubGroupSchema.parse({ name: "My Poem" });
    expect(result.name).toBe("My Poem");
  });

  it("trims whitespace", () => {
    const result = createSimsubGroupSchema.parse({ name: "  My Poem  " });
    expect(result.name).toBe("My Poem");
  });

  it("rejects empty name", () => {
    expect(() => createSimsubGroupSchema.parse({ name: "" })).toThrow();
  });
});

describe("updateSimsubGroupSchema", () => {
  it("accepts partial update with name", () => {
    const result = updateSimsubGroupSchema.parse({
      id: UUID,
      name: "New Name",
    });
    expect(result.name).toBe("New Name");
  });

  it("accepts partial update with status", () => {
    const result = updateSimsubGroupSchema.parse({
      id: UUID,
      status: "RESOLVED",
    });
    expect(result.status).toBe("RESOLVED");
  });

  it("rejects update with no fields", () => {
    expect(() => updateSimsubGroupSchema.parse({ id: UUID })).toThrow();
  });
});

describe("addSimsubGroupSubmissionSchema", () => {
  it("accepts native submission", () => {
    const result = addSimsubGroupSubmissionSchema.parse({
      groupId: UUID,
      submissionId: UUID,
    });
    expect(result.submissionId).toBe(UUID);
  });

  it("accepts external submission", () => {
    const result = addSimsubGroupSubmissionSchema.parse({
      groupId: UUID,
      externalSubmissionId: UUID,
    });
    expect(result.externalSubmissionId).toBe(UUID);
  });

  it("rejects both submission types", () => {
    expect(() =>
      addSimsubGroupSubmissionSchema.parse({
        groupId: UUID,
        submissionId: UUID,
        externalSubmissionId: UUID,
      }),
    ).toThrow();
  });

  it("rejects neither submission type", () => {
    expect(() =>
      addSimsubGroupSubmissionSchema.parse({ groupId: UUID }),
    ).toThrow();
  });
});

describe("removeSimsubGroupSubmissionSchema", () => {
  it("accepts native submission", () => {
    const result = removeSimsubGroupSubmissionSchema.parse({
      groupId: UUID,
      submissionId: UUID,
    });
    expect(result.submissionId).toBe(UUID);
  });

  it("rejects both submission types", () => {
    expect(() =>
      removeSimsubGroupSubmissionSchema.parse({
        groupId: UUID,
        submissionId: UUID,
        externalSubmissionId: UUID,
      }),
    ).toThrow();
  });

  it("rejects neither submission type", () => {
    expect(() =>
      removeSimsubGroupSubmissionSchema.parse({ groupId: UUID }),
    ).toThrow();
  });
});

describe("listSimsubGroupsSchema", () => {
  it("applies defaults", () => {
    const result = listSimsubGroupsSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it("accepts status filter", () => {
    const result = listSimsubGroupsSchema.parse({ status: "ACTIVE" });
    expect(result.status).toBe("ACTIVE");
  });
});
