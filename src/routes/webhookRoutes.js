const controller = require("../controllers/webhookController");

async function webhookRoutes(fastify) {
  fastify.post("/new-result/:scanId", controller.handleNewResult);
  fastify.post("/result/:scanId/:resultId", controller.handleResultExport);
  fastify.post("/crawled/:scanId", controller.handleCrawled);
  fastify.post("/pdf/:scanId", controller.handlePdf);
  fastify.post("/export-completed/:scanId", controller.handleExportCompletion);
  fastify.post("/:status/:scanId", controller.handleStatus);
}

module.exports = webhookRoutes;
