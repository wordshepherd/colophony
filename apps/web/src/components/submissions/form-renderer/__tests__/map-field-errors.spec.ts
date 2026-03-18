import { vi } from "vitest";
import { extractFieldErrors, mapFieldErrorsToForm } from "../map-field-errors";

describe("extractFieldErrors", () => {
  it("extracts fieldErrors from TRPCClientError shape", () => {
    const error = {
      data: {
        fieldErrors: [{ fieldKey: "bio", message: "Too short" }],
      },
    };

    expect(extractFieldErrors(error)).toEqual([
      { fieldKey: "bio", message: "Too short" },
    ]);
  });

  it("returns null when no fieldErrors", () => {
    const error = { data: { code: "BAD_REQUEST" } };
    expect(extractFieldErrors(error)).toBeNull();
  });

  it("returns null for null/undefined error", () => {
    expect(extractFieldErrors(null)).toBeNull();
    expect(extractFieldErrors(undefined)).toBeNull();
  });
});

describe("mapFieldErrorsToForm", () => {
  it("maps fieldErrors to setError calls", () => {
    const setError = vi.fn();
    const error = {
      data: {
        fieldErrors: [{ fieldKey: "bio", message: "Too short" }],
      },
    };

    const result = mapFieldErrorsToForm(error, setError);

    expect(result).toBe(true);
    expect(setError).toHaveBeenCalledWith("formData.bio", {
      message: "Too short",
    });
  });

  it("returns false when no fieldErrors", () => {
    const setError = vi.fn();
    const error = { message: "Something went wrong" };

    const result = mapFieldErrorsToForm(error, setError);

    expect(result).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });

  it("handles multiple field errors", () => {
    const setError = vi.fn();
    const error = {
      data: {
        fieldErrors: [
          { fieldKey: "bio", message: "Too short" },
          { fieldKey: "email", message: "Invalid email" },
          { fieldKey: "age", message: "Must be positive" },
        ],
      },
    };

    const result = mapFieldErrorsToForm(error, setError);

    expect(result).toBe(true);
    expect(setError).toHaveBeenCalledTimes(3);
  });

  it("handles null/undefined error", () => {
    const setError = vi.fn();

    expect(mapFieldErrorsToForm(null, setError)).toBe(false);
    expect(mapFieldErrorsToForm(undefined, setError)).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });
});
