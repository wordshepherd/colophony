import { describe, it, expect, vi, beforeEach } from "vitest";

import { HookEngine } from "../hooks/engine.js";
import { createNoopLogger } from "../testing/noop-logger.js";

describe("HookEngine", () => {
  let engine: HookEngine;

  beforeEach(() => {
    engine = new HookEngine(createNoopLogger());
  });

  it("executes action hook handlers in priority order", async () => {
    const order: number[] = [];

    engine.on(
      "submission.created",
      async () => {
        order.push(2);
      },
      { priority: 200 },
    );
    engine.on(
      "submission.created",
      async () => {
        order.push(1);
      },
      { priority: 50 },
    );

    await engine.executeAction("submission.created", {
      orgId: "org1",
      submissionId: "s1",
      submitterId: "u1",
      formId: "f1",
    });

    expect(order).toEqual([1, 2]);
  });

  it("action hook swallows handler errors", async () => {
    const handler1 = vi.fn().mockRejectedValue(new Error("boom"));
    const handler2 = vi.fn().mockResolvedValue(undefined);

    engine.on("submission.created", handler1);
    engine.on("submission.created", handler2);

    await engine.executeAction("submission.created", {
      orgId: "org1",
      submissionId: "s1",
      submitterId: "u1",
      formId: "f1",
    });

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
  });

  it("action hook with no handlers is a no-op", async () => {
    await expect(
      engine.executeAction("submission.created", {
        orgId: "org1",
        submissionId: "s1",
        submitterId: "u1",
        formId: "f1",
      }),
    ).resolves.toBeUndefined();
  });

  it("executes filter hook handlers in chain", async () => {
    engine.on("submission.validate", async (payload) => ({
      ...payload,
      errors: [...payload.errors, "err1"],
    }));
    engine.on("submission.validate", async (payload) => ({
      ...payload,
      errors: [...payload.errors, "err2"],
    }));

    const result = await engine.executeFilter("submission.validate", {
      orgId: "org1",
      submissionId: "s1",
      data: {},
      errors: [],
    });

    expect(result.errors).toEqual(["err1", "err2"]);
  });

  it("filter hook passes through on handler error", async () => {
    engine.on("submission.validate", () => {
      throw new Error("filter boom");
    });

    const payload = {
      orgId: "org1",
      submissionId: "s1",
      data: {},
      errors: ["existing"],
    };

    const result = await engine.executeFilter("submission.validate", payload);
    expect(result.errors).toEqual(["existing"]);
  });

  it("on() returns unsubscribe function", async () => {
    const handler = vi.fn();
    const unsub = engine.on("submission.created", handler);

    expect(engine.getListenerCount("submission.created")).toBe(1);
    unsub();
    expect(engine.getListenerCount("submission.created")).toBe(0);
  });

  it("getListenerCount returns correct count", () => {
    engine.on("submission.created", async () => {});
    engine.on("submission.created", async () => {});
    engine.on("submission.submitted", async () => {});

    expect(engine.getListenerCount("submission.created")).toBe(2);
    expect(engine.getListenerCount("submission.submitted")).toBe(1);
    expect(engine.getListenerCount("payment.completed")).toBe(0);
  });

  it("removeAll clears all handlers for a hook", () => {
    engine.on("submission.created", async () => {});
    engine.on("submission.created", async () => {});
    engine.on("submission.submitted", async () => {});

    engine.removeAll("submission.created");

    expect(engine.getListenerCount("submission.created")).toBe(0);
    expect(engine.getListenerCount("submission.submitted")).toBe(1);
  });

  it("removeAll with no args clears everything", () => {
    engine.on("submission.created", async () => {});
    engine.on("submission.submitted", async () => {});

    engine.removeAll();

    expect(engine.getListenerCount("submission.created")).toBe(0);
    expect(engine.getListenerCount("submission.submitted")).toBe(0);
  });

  it("default priority is 100", async () => {
    const order: string[] = [];

    engine.on("submission.created", async () => {
      order.push("default");
    });
    engine.on(
      "submission.created",
      async () => {
        order.push("low");
      },
      { priority: 50 },
    );
    engine.on(
      "submission.created",
      async () => {
        order.push("high");
      },
      { priority: 200 },
    );

    await engine.executeAction("submission.created", {
      orgId: "org1",
      submissionId: "s1",
      submitterId: "u1",
      formId: "f1",
    });

    expect(order).toEqual(["low", "default", "high"]);
  });
});
