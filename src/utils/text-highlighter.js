/**
 * Text Highlighter Module
 * Combines grammar and plagiarism highlights into a single view
 */
class TextHighlighter {
  constructor() {
    // CSS classes for different highlight types
    this.cssClasses = {
      grammar: "grammar-error",
      spelling: "spelling-error",
      punctuation: "punctuation-error",
      style: "style-issue",
      plagiarism: "plagiarism-match",
      plagiarismIdentical: "plagiarism-identical",
      plagiarismMinor: "plagiarism-minor",
      plagiarismParaphrased: "plagiarism-paraphrased",
    };
  }

  /**
   * Combine grammar and plagiarism highlights
   * @param {string} text - Original text
   * @param {object} grammarResult - Result from grammar checker
   * @param {array} plagiarismMatches - Array of plagiarism matches with positions
   * @returns {object} Combined highlight result
   */
  combineHighlights(text, grammarResult = null, plagiarismMatches = []) {
    // Validate text parameter
    if (!text || typeof text !== "string") {
      console.warn("⚠️ Text is empty or invalid, returning empty highlights");
      return {
        originalText: text || "",
        textLength: text?.length || 0,
        highlights: [],
        highlightedHTML: text || "",
        lineReport: [],
        statistics: {
          totalHighlights: 0,
          grammarErrors: 0,
          plagiarismMatches: 0,
        },
      };
    }

    const allHighlights = [];

    // Add grammar highlights (with validation)
    if (Array.isArray(grammarResult?.errors)) {
      grammarResult.errors.forEach((error) => {
        // Validate error object has required fields
        if (error?.position?.start !== undefined && error?.position?.length) {
          const start = Math.max(0, error.position.start);
          const length = Math.min(error.position.length, text.length - start);

          if (length > 0) {
            allHighlights.push({
              start: start,
              length: length,
              end: start + length,
              type: "grammar",
              subType: error.type || "unknown",
              severity: error.severity || "warning",
              message: error.message || "Grammar issue detected",
              suggestion: error.suggestion || "",
              replacements: error.replacements || [],
              affectedText: error.affectedText || text.substring(start, start + length),
            });
          }
        }
      });
    }

    // Add plagiarism highlights (with validation)
    if (Array.isArray(plagiarismMatches)) {
      plagiarismMatches.forEach((match) => {
        // Validate match object has required fields
        if (match?.start !== undefined && match?.length) {
          const start = Math.max(0, match.start);
          const length = Math.min(match.length, text.length - start);

          if (length > 0) {
            allHighlights.push({
              start: start,
              length: length,
              end: start + length,
              type: "plagiarism",
              subType: match.matchType || "identical",
              source: match.source || "Unknown source",
              sourceUrl: match.sourceUrl || "",
              matchPercentage: match.matchPercentage || 0,
              affectedText: text.substring(start, start + length),
            });
          }
        }
      });
    }

    // Sort by start position
    allHighlights.sort((a, b) => a.start - b.start);

    // Handle overlapping highlights
    const resolvedHighlights = this.resolveOverlaps(allHighlights);

    // Generate HTML
    const html = this.generateHTML(text, resolvedHighlights);

    // Generate line-by-line report
    const lineReport = this.generateLineReport(text, resolvedHighlights);

    // Count unique plagiarism and grammar highlights from nested structure
    const uniqueGrammarIds = new Set();
    const uniquePlagiarismIds = new Set();

    resolvedHighlights.forEach((segment) => {
      segment.highlights.forEach((h) => {
        const id = `${h.type}_${h.start}_${h.length}`;
        if (h.type === "grammar") {
          uniqueGrammarIds.add(id);
        } else if (h.type === "plagiarism") {
          uniquePlagiarismIds.add(id);
        }
      });
    });

    return {
      originalText: text,
      textLength: text.length,
      highlights: resolvedHighlights,
      highlightedHTML: html,
      lineReport: lineReport,
      statistics: {
        totalHighlights: resolvedHighlights.length,
        grammarErrors: uniqueGrammarIds.size,
        plagiarismMatches: uniquePlagiarismIds.size,
      },
    };
  }

  /**
   * Resolve overlapping highlights
   * Strategy: Split overlapping regions into nested spans
   * @param {array} highlights - Array of highlight objects
   * @returns {array} Resolved highlights
   */
  resolveOverlaps(highlights) {
    if (highlights.length === 0) return [];

    const resolved = [];
    const _stack = [];

    // Create events for each highlight (start and end)
    const events = [];
    highlights.forEach((highlight, index) => {
      events.push({ position: highlight.start, type: "start", highlight, index });
      events.push({ position: highlight.end, type: "end", highlight, index });
    });

    // Sort events by position
    events.sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      // If same position, process 'end' events before 'start' events
      return a.type === "end" ? -1 : 1;
    });

    // Process events to create non-overlapping segments
    let lastPos = 0;
    const activeHighlights = new Map();

    events.forEach((event) => {
      if (event.position > lastPos && activeHighlights.size > 0) {
        // Create a segment for the active highlights
        const segmentHighlights = Array.from(activeHighlights.values());
        resolved.push({
          start: lastPos,
          end: event.position,
          length: event.position - lastPos,
          highlights: segmentHighlights,
        });
      }

      if (event.type === "start") {
        activeHighlights.set(event.index, event.highlight);
      } else {
        activeHighlights.delete(event.index);
      }

      lastPos = event.position;
    });

    return resolved;
  }

  /**
   * Generate HTML with highlights
   * @param {string} text - Original text
   * @param {array} resolvedHighlights - Resolved highlights from resolveOverlaps
   * @returns {string} HTML with highlighted text
   */
  generateHTML(text, resolvedHighlights) {
    if (resolvedHighlights.length === 0) {
      return this.escapeHtml(text);
    }

    let html = "";
    let lastIndex = 0;

    resolvedHighlights.forEach((segment) => {
      // Add normal text before this segment
      if (segment.start > lastIndex) {
        html += this.escapeHtml(text.substring(lastIndex, segment.start));
      }

      // Build nested spans for overlapping highlights
      const segmentText = text.substring(segment.start, segment.end);
      const wrappedText = this.wrapInHighlights(segmentText, segment.highlights);

      html += wrappedText;
      lastIndex = segment.end;
    });

    // Add remaining text after last highlight
    if (lastIndex < text.length) {
      html += this.escapeHtml(text.substring(lastIndex));
    }

    return html;
  }

  /**
   * Wrap text in highlight spans
   * @param {string} text - Text to wrap
   * @param {array} highlights - Array of highlights for this segment
   * @returns {string} Wrapped HTML
   */
  wrapInHighlights(text, highlights) {
    let wrapped = this.escapeHtml(text);

    // Wrap in reverse order (innermost to outermost)
    highlights.reverse().forEach((highlight) => {
      const cssClass = this.getCssClass(highlight);
      const dataAttributes = this.getDataAttributes(highlight);

      wrapped = `<span class="${cssClass}" ${dataAttributes}>${wrapped}</span>`;
    });

    return wrapped;
  }

  /**
   * Get CSS class for highlight
   * @param {object} highlight - Highlight object
   * @returns {string} CSS class name
   */
  getCssClass(highlight) {
    if (highlight.type === "grammar") {
      return this.cssClasses[highlight.subType] || this.cssClasses.grammar;
    } else if (highlight.type === "plagiarism") {
      switch (highlight.subType) {
        case "identical":
          return this.cssClasses.plagiarismIdentical;
        case "minorChanges":
          return this.cssClasses.plagiarismMinor;
        case "paraphrased":
          return this.cssClasses.plagiarismParaphrased;
        default:
          return this.cssClasses.plagiarism;
      }
    }
    return "highlight";
  }

  /**
   * Get data attributes for highlight
   * @param {object} highlight - Highlight object
   * @returns {string} Data attributes string
   */
  getDataAttributes(highlight) {
    const attrs = [`data-type="${highlight.type}"`];

    if (highlight.type === "grammar") {
      attrs.push(`data-message="${this.escapeHtml(highlight.message)}"`);
      if (highlight.suggestion) {
        attrs.push(`data-suggestion="${this.escapeHtml(highlight.suggestion)}"`);
      }
      attrs.push(`data-severity="${highlight.severity}"`);
    } else if (highlight.type === "plagiarism") {
      if (highlight.source) {
        attrs.push(`data-source="${this.escapeHtml(highlight.source)}"`);
      }
      if (highlight.sourceUrl) {
        attrs.push(`data-source-url="${this.escapeHtml(highlight.sourceUrl)}"`);
      }
      if (highlight.matchPercentage) {
        attrs.push(`data-match="${highlight.matchPercentage}%"`);
      }
    }

    return attrs.join(" ");
  }

  /**
   * Generate line-by-line report
   * @param {string} text - Original text
   * @param {array} resolvedHighlights - Resolved highlights
   * @returns {array} Line-by-line report
   */
  generateLineReport(text, resolvedHighlights) {
    const lines = text.split("\n");
    const report = [];

    let currentPos = 0;

    lines.forEach((line, lineIndex) => {
      const lineStart = currentPos;
      const lineEnd = currentPos + line.length;

      const lineHighlights = [];

      // Find highlights that intersect with this line
      resolvedHighlights.forEach((segment) => {
        if (segment.start < lineEnd && segment.end > lineStart) {
          // This highlight intersects with the current line
          lineHighlights.push({
            start: Math.max(0, segment.start - lineStart),
            end: Math.min(line.length, segment.end - lineStart),
            highlights: segment.highlights,
          });
        }
      });

      if (lineHighlights.length > 0) {
        report.push({
          lineNumber: lineIndex + 1,
          lineText: line,
          hasIssues: true,
          highlights: lineHighlights,
        });
      }

      currentPos = lineEnd + 1; // +1 for newline character
    });

    return report;
  }

  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    // Handle null/undefined/non-string values
    if (text === null || text === undefined) {
      return "";
    }

    // Convert to string if not already
    const textStr = typeof text === "string" ? text : String(text);

    const htmlEscapes = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return textStr.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
  }

  /**
   * Get CSS stylesheet for highlights
   * @returns {string} CSS stylesheet
   */
  getStylesheet() {
    return `
      /* Grammar and Spelling Highlights */
      .grammar-error {
        background-color: rgba(59, 130, 246, 0.2);
        border-bottom: 2px wavy #3b82f6;
        cursor: help;
      }

      .spelling-error {
        background-color: rgba(239, 68, 68, 0.2);
        border-bottom: 2px wavy #ef4444;
        cursor: help;
      }

      .punctuation-error {
        background-color: rgba(245, 158, 11, 0.2);
        border-bottom: 2px wavy #f59e0b;
        cursor: help;
      }

      .style-issue {
        background-color: rgba(139, 92, 246, 0.2);
        border-bottom: 2px wavy #8b5cf6;
        cursor: help;
      }

      /* Plagiarism Highlights */
      .plagiarism-match {
        background-color: rgba(239, 68, 68, 0.3);
        border-left: 3px solid #ef4444;
        padding-left: 2px;
        cursor: pointer;
      }

      .plagiarism-identical {
        background-color: rgba(220, 38, 38, 0.3);
        border-left: 3px solid #dc2626;
        padding-left: 2px;
        cursor: pointer;
      }

      .plagiarism-minor {
        background-color: rgba(249, 115, 22, 0.3);
        border-left: 3px solid #f97316;
        padding-left: 2px;
        cursor: pointer;
      }

      .plagiarism-paraphrased {
        background-color: rgba(251, 191, 36, 0.3);
        border-left: 3px solid #fbbf24;
        padding-left: 2px;
        cursor: pointer;
      }

      /* Tooltip styles */
      [data-message]:hover::after {
        content: attr(data-message);
        position: absolute;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 14px;
        white-space: nowrap;
        z-index: 1000;
        margin-top: 25px;
      }
    `;
  }
}

module.exports = TextHighlighter;
