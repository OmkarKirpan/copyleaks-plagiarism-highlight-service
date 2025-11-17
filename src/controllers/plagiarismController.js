const asyncHandler = require("../utils/asyncHandler");
const logger = require("../utils/logger");
const config = require("../config");
const scanStore = require("../storage/scanStore");
const { plagiarismScanner } = require("../services/copyleaksService");
const { generateHighlightPayload } = require("../services/highlightService");
const { NotFoundError, ConflictError } = require("../errors/custom-errors");
const TextHighlighter = require("../utils/text-highlighter");

const buildScanOptions = (options = {}) => ({
  sandbox: config.copyleaks.sandboxMode,
  sensitivityLevel: options.sensitivityLevel ?? 3,
  includeHtml: options.includeHtml ?? true,
  expiration: options.expiration,
});

exports.submitScan = asyncHandler(async (request, reply) => {
  // Zod validation handled automatically by Fastify
  const { text, options } = request.body;

  const record = scanStore.createScanRecord(text, options);
  logger.info(`Submitting scan ${record.scanId}`);

  try {
    await plagiarismScanner.submitTextScan(record.scanId, text, buildScanOptions(options));
    scanStore.updateStatus(record.scanId, "pending");

    return reply.code(202).send({
      scanId: record.scanId,
      status: "pending",
      message: "Scan submitted successfully. Await webhook callbacks for completion.",
    });
  } catch (error) {
    logger.error("Scan submission failed", {
      scanId: record.scanId,
      error: error.message,
    });
    scanStore.updateStatus(record.scanId, "error", {
      summary: { message: error.message },
    });
    return reply.code(502).send({
      error: "Unable to submit scan",
      details: error.message,
    });
  }
});

exports.listScans = asyncHandler(async (_request, reply) => {
  const scans = scanStore.listScans();
  reply.send({
    count: scans.length,
    items: scans,
  });
});

exports.getScan = asyncHandler(async (request, reply) => {
  const { scanId } = request.params;
  const record = scanStore.getScan(scanId);

  if (!record) {
    throw new NotFoundError("Scan not found");
  }

  reply.send({
    ...scanStore.toPublicRecord(record),
    status: record.status,
    summary: record.summary,
    results: record.results,
    exported: {
      results: Object.keys(record.exported.results),
      crawled: Boolean(record.exported.crawled),
      pdfReport: Boolean(record.exported.pdfReport),
      completedAt: record.exported.completedAt,
    },
  });
});

exports.getHighlights = asyncHandler(async (request, reply) => {
  const { scanId } = request.params;
  const record = scanStore.getScan(scanId);

  if (!record) {
    throw new NotFoundError("Scan not found");
  }

  const exportedCount = Object.keys(record.exported.results).length;
  if (!exportedCount) {
    throw new ConflictError("Highlight data not ready yet");
  }

  try {
    const payload = generateHighlightPayload(record);
    reply.send(payload);
  } catch (error) {
    logger.error("Failed to generate highlights", {
      scanId,
      error: error.message,
    });
    throw error;
  }
});

exports.deleteScan = asyncHandler(async (request, reply) => {
  const { scanId } = request.params;
  const record = scanStore.getScan(scanId);

  if (!record) {
    throw new NotFoundError("Scan not found");
  }

  try {
    await plagiarismScanner.deleteScan(scanId);
  } catch (error) {
    logger.warn("Failed to delete scan in Copyleaks", {
      scanId,
      error: error.message,
    });
  }

  scanStore.deleteScan(scanId);
  reply.send({ success: true });
});

exports.getStylesheet = asyncHandler(async (_request, reply) => {
  const highlighter = new TextHighlighter();
  const css = highlighter.getStylesheet();

  reply
    .type("text/css")
    .send(css);
});
