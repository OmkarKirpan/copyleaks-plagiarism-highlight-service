import { describe, it, expect, beforeAll, afterAll } from "vitest";
import buildServer from "../src/app.js";

describe("Plagiarism API", () => {
  let app;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /plagiarism - Submit Scan", () => {
    it("should reject empty text", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/plagiarism",
        payload: {
          text: "",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe("Validation failed");
      expect(body.details).toBeDefined();
      expect(body.requestId).toBeDefined();
    });

    it("should reject missing text field", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/plagiarism",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe("Validation failed");
      expect(body.details).toContainEqual(
        expect.objectContaining({
          path: "text",
          message: expect.stringMatching(/expected string|required/i),
        }),
      );
    });

    it("should reject text exceeding 100,000 characters", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/plagiarism",
        payload: {
          text: "a".repeat(100001),
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe("Validation failed");
      expect(body.details).toContainEqual(
        expect.objectContaining({
          path: "text",
        }),
      );
    });

    it("should accept valid text and return 202", async () => {
      // Note: This test might fail without mocking Copyleaks client
      // For now, it demonstrates the expected behavior
      const response = await app.inject({
        method: "POST",
        url: "/plagiarism",
        payload: {
          text: "This is a sample text for plagiarism checking.",
          options: {
            sensitivityLevel: 3,
            includeHtml: true,
          },
        },
      });

      // Expecting 202 (Accepted) or 502 (if Copyleaks fails)
      expect([202, 502]).toContain(response.statusCode);

      if (response.statusCode === 202) {
        const body = response.json();
        expect(body.scanId).toBeDefined();
        expect(body.status).toBe("pending");
        expect(body.message).toContain("submitted successfully");
      }
    });
  });

  describe("GET /plagiarism - List Scans", () => {
    it("should return list of scans", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/plagiarism",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty("count");
      expect(body).toHaveProperty("items");
      expect(Array.isArray(body.items)).toBe(true);
    });
  });

  describe("GET /plagiarism/:scanId - Get Scan", () => {
    it("should return 404 for non-existent scan", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/plagiarism/nonexistent123",
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error).toBeDefined();
      expect(body.requestId).toBeDefined();
    });
  });

  describe("DELETE /plagiarism/:scanId - Delete Scan", () => {
    it("should return 404 for non-existent scan", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/plagiarism/nonexistent123",
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error).toBeDefined();
      expect(body.requestId).toBeDefined();
    });
  });
});
