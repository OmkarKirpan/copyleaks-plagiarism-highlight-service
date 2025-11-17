const asyncHandler = require("../utils/asyncHandler");
const logger = require("../utils/logger");
const scanStore = require("../storage/scanStore");
const { plagiarismScanner } = require("../services/copyleaksService");

const STATUS_COMPLETED = "completed";
const STATUS_ERROR = "error";
const STATUS_CREDITS = "creditsChecked";

function extractText(payload) {
  if (!payload) {
    return null;
  }

  if (typeof payload === "string") {
    return payload;
  }

  if (payload.text) {
    if (typeof payload.text === "string") {
      return payload.text;
    }
    if (payload.text.value) {
      return payload.text.value;
    }
  }

  if (payload.value) {
    return payload.value;
  }

  if (payload.content) {
    return payload.content;
  }

  if (payload.document?.text) {
    return payload.document.text;
  }

  if (payload.html?.text) {
    return payload.html.text;
  }

  if (payload.result?.text) {
    return payload.result.text;
  }

  return null;
}

exports.handleStatus = asyncHandler(async (request, reply) => {
  const { status, scanId } = request.params;
  const payload = request.body || {};
  const record = scanStore.getScan(scanId);

  if (!record) {
    logger.warn("Received webhook for unknown scan", { scanId, status });
    return reply.code(202).send({ ignored: true });
  }

  if (status === STATUS_COMPLETED) {
    const totalWords = payload.scannedDocument?.totalWords || 0;

    scanStore.updateStatus(scanId, "completed", {
      summary: {
        totalResults: payload.results?.internet?.length || 0,
        score: payload.results?.score?.aggregatedScore || 0,
        totalWords: totalWords,
      },
    });

    const resultIds = (payload.results?.internet || []).map((result) => result.id);

    // Store metadata for each result
    for (const result of payload.results?.internet || []) {
      scanStore.storeResultMetadata(scanId, result.id, {
        url: result.url || "",
        title: result.title || "",
        // matchPercentage will be calculated when export result is received
        matchPercentage: 0,
      });
    }

    if (resultIds.length && !record.exportStarted) {
      try {
        scanStore.markExportStarted(scanId);
        await plagiarismScanner.exportResults(scanId, resultIds);
        logger.info("Export initiated from completion webhook", { scanId });
      } catch (error) {
        logger.error("Failed to initiate export", {
          scanId,
          error: error.message,
        });
      }
    }
  } else if (status === STATUS_ERROR) {
    scanStore.updateStatus(scanId, "error", {
      summary: { message: payload.error },
    });
  } else if (status === STATUS_CREDITS) {
    scanStore.updateStatus(scanId, record.status, {
      summary: record.summary,
      credits: payload.credits,
    });
  }

  reply.send({ received: true });
});

exports.handleNewResult = asyncHandler(async (request, reply) => {
  const { scanId } = request.params;
  const record = scanStore.getScan(scanId);

  if (!record) {
    logger.warn("New result for unknown scan", { scanId });
    return reply.code(202).send({ ignored: true });
  }

  scanStore.addResult(scanId, request.body);
  reply.send({ received: true });
});

exports.handleResultExport = asyncHandler(async (request, reply) => {
  const { scanId, resultId } = request.params;
  const record = scanStore.getScan(scanId);

  if (!record) {
    logger.warn("Result export for unknown scan", { scanId });
    return reply.code(202).send({ ignored: true });
  }

  const exportedData = request.body;

  // Store the exported result
  scanStore.storeExportedResult(scanId, resultId, exportedData);

  // Calculate matchPercentage from statistics
  const statistics = exportedData?.statistics || {};
  const identical = statistics.identical || 0;
  const minorChanges = statistics.minorChanges || 0;
  const relatedMeaning = statistics.relatedMeaning || 0;
  const totalMatchedWords = identical + minorChanges + relatedMeaning;

  // Get totalWords from scan summary (stored during completion webhook)
  const totalWords = record.summary?.totalWords || 0;

  // Calculate percentage (avoid division by zero)
  let matchPercentage = 0;
  if (totalWords > 0) {
    matchPercentage = Math.round((totalMatchedWords / totalWords) * 100);
  }

  logger.info("Calculated matchPercentage", {
    scanId,
    resultId,
    totalMatchedWords,
    totalWords,
    matchPercentage,
  });

  // Update metadata with calculated matchPercentage
  const existingMetadata = record.resultMetadata[resultId] || {};
  scanStore.storeResultMetadata(scanId, resultId, {
    ...existingMetadata,
    matchPercentage: matchPercentage,
  });

  reply.send({ received: true });
});

exports.handleCrawled = asyncHandler(async (request, reply) => {
  const { scanId } = request.params;
  const record = scanStore.getScan(scanId);

  if (!record) {
    logger.warn("Crawled webhook for unknown scan", { scanId });
    return reply.code(202).send({ ignored: true });
  }

  const extractedText = extractText(request.body);
  scanStore.storeCrawled(scanId, request.body, extractedText);

  if (!extractedText) {
    logger.warn("Unable to extract text from crawled payload", { scanId });
  }

  reply.send({ received: true, extractedText: Boolean(extractedText) });
});

exports.handlePdf = asyncHandler(async (request, reply) => {
  const { scanId } = request.params;
  const record = scanStore.getScan(scanId);

  if (!record) {
    logger.warn("PDF webhook for unknown scan", { scanId });
    return reply.code(202).send({ ignored: true });
  }

  scanStore.storePdf(scanId, request.body);
  reply.send({ received: true });
});

exports.handleExportCompletion = asyncHandler(async (request, reply) => {
  const { scanId } = request.params;
  const record = scanStore.getScan(scanId);

  if (!record) {
    logger.warn("Export completion for unknown scan", { scanId });
    return reply.code(202).send({ ignored: true });
  }

  scanStore.markExportCompleted(scanId);
  reply.send({ received: true });
});
