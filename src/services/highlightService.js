const TextHighlighter = require("../utils/text-highlighter");

const textHighlighter = new TextHighlighter();

function extractMatches(results = {}) {
  const matches = [];
  const matchTypes = ["identical", "minorChanges", "relatedMeaning"];

  for (const result of Object.values(results)) {
    const comparison = result?.text?.comparison;
    if (!comparison) {
      continue;
    }

    for (const type of matchTypes) {
      const data = comparison?.[type];
      const chars = data?.source?.chars;
      if (!chars?.starts || !chars?.lengths) {
        continue;
      }

      for (let index = 0; index < chars.starts.length; index += 1) {
        matches.push({
          start: chars.starts[index],
          length: chars.lengths[index],
          matchType: type,
          source: result?.url || result?.title || "Detected source",
          sourceUrl: result?.url,
          matchPercentage: result?.matchPercentage || 0,
        });
      }
    }
  }

  return matches;
}

function resolveBaseText(record) {
  if (record?.exported?.crawledText) {
    return record.exported.crawledText;
  }
  if (record?.text) {
    return record.text;
  }
  return "";
}

function generateHighlightPayload(record) {
  const text = resolveBaseText(record);
  if (!text) {
    throw new Error("No text available for highlighting. Wait for crawled payload.");
  }

  const matches = extractMatches(record?.exported?.results);
  const result = textHighlighter.combineHighlights(text, null, matches);
  return {
    scanId: record.scanId,
    statistics: result.statistics,
    highlights: result.highlights,
    highlightedHTML: result.highlightedHTML,
    lineReport: result.lineReport,
    textLength: result.textLength,
  };
}

module.exports = {
  extractMatches,
  generateHighlightPayload,
};
