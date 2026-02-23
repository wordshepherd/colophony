import {
  fetchEmbedForm,
  submitEmbedForm,
  prepareEmbedUpload,
  fetchUploadStatus,
  type EmbedApiError,
} from "../embed-api";

const API_URL = "http://localhost:4000";
const TOKEN = "col_emb_testtoken123";

describe("embed-api", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetch(
    status: number,
    body: unknown,
    headers?: Record<string, string>,
  ) {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? "OK" : "Error",
      headers: {
        get: (name: string) => headers?.[name] ?? null,
      },
      json: () => Promise.resolve(body),
    });
  }

  // fetchEmbedForm
  describe("fetchEmbedForm", () => {
    it("returns parsed form data on success", async () => {
      const formData = {
        period: {
          id: "p1",
          name: "Spring",
          opensAt: "2026-01-01",
          closesAt: "2026-06-01",
        },
        form: null,
        theme: null,
        organizationId: "org-1",
      };
      mockFetch(200, formData);

      const result = await fetchEmbedForm(API_URL, TOKEN);
      expect(result).toEqual(formData);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${API_URL}/embed/${TOKEN}`,
        expect.objectContaining({ headers: { Accept: "application/json" } }),
      );
    });

    it("throws EmbedApiError on 404", async () => {
      mockFetch(404, { error: "Not Found", message: "Invalid embed token" });

      try {
        await fetchEmbedForm(API_URL, TOKEN);
        fail("Should have thrown");
      } catch (err) {
        const apiErr = err as EmbedApiError;
        expect(apiErr.status).toBe(404);
        expect(apiErr.message).toBe("Invalid embed token");
      }
    });

    it("throws EmbedApiError on 410", async () => {
      mockFetch(410, { error: "Gone", message: "Submission period closed" });

      try {
        await fetchEmbedForm(API_URL, TOKEN);
        fail("Should have thrown");
      } catch (err) {
        const apiErr = err as EmbedApiError;
        expect(apiErr.status).toBe(410);
        expect(apiErr.message).toBe("Submission period closed");
      }
    });

    it("handles network error gracefully", async () => {
      globalThis.fetch = jest
        .fn()
        .mockRejectedValue(new Error("Network error"));

      await expect(fetchEmbedForm(API_URL, TOKEN)).rejects.toThrow(
        "Network error",
      );
    });
  });

  // submitEmbedForm
  describe("submitEmbedForm", () => {
    it("returns submission result on success", async () => {
      const result = {
        success: true,
        submissionId: "sub-1",
        message: "Submitted",
      };
      mockFetch(200, result);

      const response = await submitEmbedForm(API_URL, TOKEN, {
        email: "test@example.com",
        title: "My Poem",
      });
      expect(response).toEqual(result);
    });

    it("throws with details on 400 validation error", async () => {
      mockFetch(400, {
        error: "Bad Request",
        message: "Validation failed",
        details: [{ path: "email", message: "Required" }],
      });

      try {
        await submitEmbedForm(API_URL, TOKEN, { email: "", title: "" });
        fail("Should have thrown");
      } catch (err) {
        const apiErr = err as EmbedApiError;
        expect(apiErr.status).toBe(400);
        expect(apiErr.details).toHaveLength(1);
        expect(apiErr.details![0].path).toBe("email");
      }
    });

    it("includes retryAfter on 429", async () => {
      mockFetch(
        429,
        { error: "Too Many Requests", message: "Rate limited" },
        { "Retry-After": "30" },
      );

      try {
        await submitEmbedForm(API_URL, TOKEN, { email: "x@y.com", title: "T" });
        fail("Should have thrown");
      } catch (err) {
        const apiErr = err as EmbedApiError;
        expect(apiErr.status).toBe(429);
        expect(apiErr.retryAfter).toBe(30);
      }
    });

    it("throws on 410 gone", async () => {
      mockFetch(410, { error: "Gone", message: "Period closed" });

      try {
        await submitEmbedForm(API_URL, TOKEN, { email: "x@y.com", title: "T" });
        fail("Should have thrown");
      } catch (err) {
        expect((err as EmbedApiError).status).toBe(410);
      }
    });
  });

  // prepareEmbedUpload
  describe("prepareEmbedUpload", () => {
    it("returns upload context on success", async () => {
      const ctx = {
        manuscriptVersionId: "mv-1",
        guestUserId: "gu-1",
        tusEndpoint: "http://localhost:1080/files/",
        maxFileSize: 52428800,
        maxFiles: 10,
        allowedMimeTypes: ["application/pdf"],
      };
      mockFetch(200, ctx);

      const result = await prepareEmbedUpload(API_URL, TOKEN, {
        email: "x@y.com",
      });
      expect(result).toEqual(ctx);
    });
  });

  // fetchUploadStatus
  describe("fetchUploadStatus", () => {
    it("returns file status list", async () => {
      const status = {
        files: [
          {
            id: "f1",
            filename: "a.pdf",
            size: 100,
            mimeType: "application/pdf",
            scanStatus: "CLEAN",
          },
        ],
        allClean: true,
      };
      mockFetch(200, status);

      const result = await fetchUploadStatus(API_URL, TOKEN, "mv-1", "x@y.com");
      expect(result.allClean).toBe(true);
      expect(result.files).toHaveLength(1);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("email=x%40y.com"),
        expect.anything(),
      );
    });
  });
});
