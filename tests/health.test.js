import { describe, it, expect, beforeAll, afterAll } from "vitest";
import buildServer from "../src/app.js";

describe("Health Endpoint", () => {
  let app;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should return health status", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      service: "plagiarism-highlight-service",
    });
  });
});
