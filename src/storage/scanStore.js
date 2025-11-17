const { randomUUID } = require("node:crypto");

const scans = new Map();

function createScanRecord(text, options = {}) {
  const scanId = options.scanId || randomUUID().replace(/-/g, "");
  const record = {
    scanId,
    text,
    textLength: text.length,
    createdAt: new Date().toISOString(),
    status: "queued",
    options,
    summary: null,
    credits: null,
    results: [],
    exported: {
      results: {},
      crawled: null,
      crawledText: null,
      pdfReport: null,
      completedAt: null,
    },
    exportStarted: false,
    lastUpdated: new Date().toISOString(),
  };

  scans.set(scanId, record);
  return record;
}

function getScan(scanId) {
  return scans.get(scanId);
}

function listScans() {
  return Array.from(scans.values()).map(toPublicRecord);
}

function updateStatus(scanId, status, payload = {}) {
  const record = getScan(scanId);
  if (!record) {
    return null;
  }

  record.status = status;
  record.lastUpdated = new Date().toISOString();

  if (payload.summary) {
    record.summary = payload.summary;
  }

  if (payload.credits !== undefined) {
    record.credits = payload.credits;
  }

  scans.set(scanId, record);
  return record;
}

function addResult(scanId, result) {
  const record = getScan(scanId);
  if (!record) {
    return null;
  }

  record.results.push(result);
  record.lastUpdated = new Date().toISOString();
  scans.set(scanId, record);
  return record;
}

function storeExportedResult(scanId, resultId, data) {
  const record = getScan(scanId);
  if (!record) {
    return null;
  }

  record.exported.results[resultId] = data;
  record.lastUpdated = new Date().toISOString();
  scans.set(scanId, record);
  return record;
}

function storeCrawled(scanId, crawledPayload, extractedText) {
  const record = getScan(scanId);
  if (!record) {
    return null;
  }

  record.exported.crawled = crawledPayload;
  record.exported.crawledText = extractedText;
  record.lastUpdated = new Date().toISOString();
  scans.set(scanId, record);
  return record;
}

function storePdf(scanId, pdfPayload) {
  const record = getScan(scanId);
  if (!record) {
    return null;
  }

  record.exported.pdfReport = pdfPayload;
  record.lastUpdated = new Date().toISOString();
  scans.set(scanId, record);
  return record;
}

function markExportStarted(scanId) {
  const record = getScan(scanId);
  if (!record) {
    return null;
  }

  record.exportStarted = true;
  record.lastUpdated = new Date().toISOString();
  scans.set(scanId, record);
  return record;
}

function markExportCompleted(scanId) {
  const record = getScan(scanId);
  if (!record) {
    return null;
  }

  record.exported.completedAt = new Date().toISOString();
  record.lastUpdated = new Date().toISOString();
  scans.set(scanId, record);
  return record;
}

function deleteScan(scanId) {
  return scans.delete(scanId);
}

function toPublicRecord(record) {
  if (!record) return null;
  return {
    scanId: record.scanId,
    status: record.status,
    createdAt: record.createdAt,
    lastUpdated: record.lastUpdated,
    summary: record.summary,
    credits: record.credits,
    exportStarted: record.exportStarted,
    exportedResults: Object.keys(record.exported.results).length,
    exportedCompletedAt: record.exported.completedAt,
    originalTextLength: record.textLength,
    options: record.options,
  };
}

module.exports = {
  createScanRecord,
  getScan,
  listScans,
  updateStatus,
  addResult,
  storeExportedResult,
  storeCrawled,
  storePdf,
  markExportStarted,
  markExportCompleted,
  deleteScan,
  toPublicRecord,
};
