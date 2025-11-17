const controller = require("../controllers/plagiarismController");
const { SubmitScanSchema, ScanIdParamSchema } = require("../schemas/plagiarism.schemas");

async function plagiarismRoutes(fastify) {
  // POST /plagiarism - Submit new scan with Zod validation
  fastify.post("/", {
    schema: {
      tags: ["plagiarism"],
      description: "Submit a new plagiarism scan",
      body: SubmitScanSchema,
    },
    handler: controller.submitScan,
  });

  // GET /plagiarism - List all scans
  fastify.get("/", {
    schema: {
      tags: ["plagiarism"],
      description: "List all plagiarism scans",
    },
    handler: controller.listScans,
  });

  // GET /plagiarism/css - Get CSS stylesheet for highlights
  fastify.get("/css", {
    schema: {
      tags: ["plagiarism"],
      description: "Get CSS stylesheet for plagiarism highlights",
    },
    handler: controller.getStylesheet,
  });

  // GET /plagiarism/:scanId - Get scan details
  fastify.get("/:scanId", {
    schema: {
      tags: ["plagiarism"],
      description: "Get details of a specific scan",
      params: ScanIdParamSchema,
    },
    handler: controller.getScan,
  });

  // GET /plagiarism/:scanId/highlight - Get highlights
  fastify.get("/:scanId/highlight", {
    schema: {
      tags: ["plagiarism"],
      description: "Get plagiarism highlights for a scan",
      params: ScanIdParamSchema,
    },
    handler: controller.getHighlights,
  });

  // DELETE /plagiarism/:scanId - Delete scan
  fastify.delete("/:scanId", {
    schema: {
      tags: ["plagiarism"],
      description: "Delete a scan",
      params: ScanIdParamSchema,
    },
    handler: controller.deleteScan,
  });
}

module.exports = plagiarismRoutes;
