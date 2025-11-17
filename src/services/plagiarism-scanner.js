const axios = require("axios");

/**
 * Plagiarism Scanner Module
 * Uses direct HTTP calls to Copyleaks API (matching Postman collection format)
 */
class PlagiarismScanner {
  constructor(
    copyleaksClient,
    webhookBaseUrl,
    productEndpoint = "scans",
    baseUrl = "https://api.copyleaks.com"
  ) {
    this.client = copyleaksClient;
    this.webhookBaseUrl = webhookBaseUrl;
    this.email = copyleaksClient.email;
    this.apiKey = copyleaksClient.apiKey;
    this.baseUrl = baseUrl; // Configurable base URL
    this.productEndpoint = productEndpoint; // Default to 'scans', can be 'education', 'businesses', etc.
  }

  /**
   * Retry a function with exponential backoff
   * @param {Function} fn - Function to retry
   * @param {number} maxRetries - Maximum number of retries
   * @param {number} initialDelay - Initial delay in milliseconds
   * @returns {Promise} Result of function
   */
  async retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Don't retry on client errors (4xx) except 429 (rate limit)
        if (
          error.response?.status >= 400 &&
          error.response?.status < 500 &&
          error.response?.status !== 429
        ) {
          throw error;
        }

        if (attempt < maxRetries) {
          const delay = initialDelay * 2 ** (attempt - 1);
          console.log(`⏳ Attempt ${attempt} failed, retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }

  /**
   * Submit text for plagiarism scanning
   * @param {string} scanId - Unique identifier for this scan
   * @param {string} text - Text content to scan
   * @param {object} options - Scan options
   * @returns {Promise<object>} Submission result
   */
  async submitTextScan(scanId, text, options = {}) {
    // Validate required parameters
    if (!scanId || typeof scanId !== "string") {
      throw new Error("scanId is required and must be a string");
    }

    if (!text || typeof text !== "string") {
      throw new Error("text is required and must be a string");
    }

    if (text.length === 0) {
      throw new Error("text cannot be empty");
    }

    const {
      sandbox = false,
      sensitivityLevel = 3, // 1-5 per API requirements
      includeHtml = false,
      expiration = 2880, // minutes
    } = options;

    // Validate sensitivityLevel is in valid range (1-5)
    const validSensitivity = Math.max(1, Math.min(5, sensitivityLevel));

    try {
      console.log(`🔍 Submitting plagiarism scan: ${scanId} (${text.length} characters)...`);

      // Get auth token
      const authToken = await this.client.getAuthToken();

      // Convert text to base64
      const base64Text = Buffer.from(text).toString("base64");

      // Create request body matching Postman collection format (line 110)
      const requestBody = {
        base64: base64Text,
        filename: "document.txt",
        properties: {
          action: 0,
          includeHtml: includeHtml,
          developerPayload: null,
          sandbox: sandbox,
          expiration: expiration,
          scanMethodAlgorithm: 0,
          customMetadata: [],
          author: {
            id: null,
          },
          course: {
            id: null,
          },
          assignment: {
            id: null,
          },
          institution: {
            id: null,
          },
          webhooks: {
            newResult: null,
            newResultHeaders: null,
            statusHeaders: null,
            status: `${this.webhookBaseUrl}/webhook/{STATUS}/${scanId}`,
          },
          filters: {
            identicalEnabled: true,
            minorChangesEnabled: true,
            relatedMeaningEnabled: true,
            minCopiedWords: null,
            safeSearch: false,
            domains: [],
            domainsMode: "1",
            allowSameDomain: false,
          },
          scanning: {
            internet: true,
            exclude: {
              idPattern: null,
            },
            include: {
              includeIdPattern: null,
            },
            repositories: [],
            copyleaksDb: null,
            crossLanguages: {
              languages: [],
            },
          },
          indexing: {
            repositories: [],
            copyleaksDb: false,
          },
          exclude: {
            quotes: false,
            citations: false,
            references: false,
            tableOfContents: false,
            titles: false,
            htmlTemplate: false,
            documentTemplateIds: [],
            code: {
              comments: false,
            },
          },
          pdf: {
            create: true,
            title: null,
            largeLogo: null,
            rtl: false,
            reportVersion: "latest",
          },
          displayLanguage: "en",
          sensitivityLevel: validSensitivity,
          cheatDetection: false,
          aiGeneratedText: {
            detect: false,
            sensitivity: 2,
            explain: {
              enable: false,
            },
          },
          sensitiveDataProtection: {
            credentials: false,
            url: false,
            creditCard: false,
            emailAddress: false,
            driversLicense: false,
            phoneNumber: false,
            network: false,
            passport: false,
          },
          writingFeedback: {
            enable: false,
            score: {
              wordChoiceScoreWeight: 1,
              sentenceStructureScoreWeight: 1,
              grammarScoreWeight: 1,
              mechanicsScoreWeight: 1,
            },
          },
          overview: {
            enable: false,
            ignoreAIDetection: false,
            ignorePlagiarismDetection: false,
            ignoreAuthorData: false,
            ignoreWritingFeedback: false,
          },
          aiSourceMatch: {
            enable: false,
          },
        },
      };

      // Submit via direct HTTP PUT request with retry logic
      const response = await this.retryWithBackoff(
        async () => {
          return await axios.put(
            `${this.baseUrl}/v3/${this.productEndpoint}/submit/file/${scanId}`,
            requestBody,
            {
              headers: {
                Authorization: `Bearer ${authToken}`,
                "Content-Type": "application/json",
              },
            }
          );
        },
        3,
        1000
      );

      console.log(`✓ Plagiarism scan submitted successfully: ${scanId}`);
      console.log(`  Response status: ${response.status}`);

      return {
        success: true,
        scanId: scanId,
        status: "pending",
        message: "Scan submitted. Waiting for webhooks...",
        submittedAt: new Date().toISOString(),
        responseStatus: response.status,
      };
    } catch (error) {
      // Enhanced error handling with detailed debugging
      const errorDetails = {
        scanId: scanId,
        textLength: text.length,
        statusCode: error.response?.status,
        statusText: error.response?.statusText,
        errorData: error.response?.data,
        errorMessage: error.message,
        endpoint: `${this.baseUrl}/v3/${this.productEndpoint}/submit/file/${scanId}`,
      };

      console.error("✗ Plagiarism scan submission failed:", errorDetails);

      // Provide specific error messages based on status codes
      if (error.response?.status === 401) {
        throw new Error("Authentication failed. Please check your Copyleaks API credentials.");
      } else if (error.response?.status === 403) {
        throw new Error(
          "Access forbidden. Your API key may not have permission for plagiarism scanning."
        );
      } else if (error.response?.status === 429) {
        throw new Error("Rate limit exceeded. Please wait before submitting another scan.");
      } else if (error.response?.status === 400) {
        throw new Error(
          `Bad request: ${error.response?.data?.message || "Invalid request parameters"}`
        );
      } else if (error.response?.status >= 500) {
        throw new Error("Copyleaks server error. Please try again later.");
      } else if (error.code === "ECONNREFUSED") {
        throw new Error(
          "Could not connect to Copyleaks API. Please check your internet connection."
        );
      } else {
        throw new Error(
          `Plagiarism scan failed: ${error.response?.data?.message || error.response?.data?.error || error.message}`
        );
      }
    }
  }

  /**
   * Export detailed plagiarism results
   * @param {string} scanId - The scan ID
   * @param {array} resultIds - Array of result IDs from completed webhook
   * @returns {Promise<object>} Export result
   */
  async exportResults(scanId, resultIds) {
    // Validate required parameters
    if (!scanId || typeof scanId !== "string") {
      throw new Error("scanId is required and must be a string");
    }

    if (!resultIds || !Array.isArray(resultIds) || resultIds.length === 0) {
      throw new Error("No result IDs provided for export");
    }

    try {
      console.log(`📤 Exporting plagiarism results for scan: ${scanId}`);

      const authToken = await this.client.getAuthToken();
      const exportId = `export-${Date.now()}`;

      // Create export config matching Postman format (line 350)
      const exportConfig = {
        completionWebhook: `${this.webhookBaseUrl}/webhook/export-completed/${scanId}`,
        completionWebhookHeaders: [],
        maxRetries: 3,
        developerPayload: "",
        results: resultIds.map((resultId) => ({
          id: resultId,
          verb: "POST",
          headers: [],
          endpoint: `${this.webhookBaseUrl}/webhook/result/${scanId}/${resultId}`,
        })),
        crawledVersion: {
          verb: "POST",
          headers: [],
          endpoint: `${this.webhookBaseUrl}/webhook/crawled/${scanId}`,
        },
        pdfReport: {
          verb: "POST",
          headers: [],
          endpoint: `${this.webhookBaseUrl}/webhook/pdf/${scanId}`,
        },
      };

      // Submit export request with retry logic
      const _response = await this.retryWithBackoff(
        async () => {
          return await axios.post(
            `${this.baseUrl}/v3/downloads/${scanId}/export/${exportId}`,
            exportConfig,
            {
              headers: {
                Authorization: `Bearer ${authToken}`,
                "Content-Type": "application/json",
              },
            }
          );
        },
        3,
        1000
      );

      console.log(`✓ Export initiated: ${exportId}`);

      return {
        success: true,
        exportId: exportId,
        scanId: scanId,
        message: "Export initiated. Waiting for export webhooks...",
      };
    } catch (error) {
      // Enhanced error handling with detailed debugging
      const errorDetails = {
        scanId: scanId,
        exportId: exportId,
        resultIds: resultIds,
        statusCode: error.response?.status,
        statusText: error.response?.statusText,
        errorData: error.response?.data,
        errorMessage: error.message,
        endpoint: `${this.baseUrl}/v3/downloads/${scanId}/export/${exportId}`,
      };

      console.error("✗ Export failed:", errorDetails);

      // Provide specific error messages based on status codes
      if (error.response?.status === 404) {
        throw new Error(`Scan ${scanId} not found. It may have expired or been deleted.`);
      } else if (error.response?.status === 401) {
        throw new Error("Authentication failed during export. Please re-authenticate.");
      } else if (error.response?.status === 400) {
        throw new Error(
          `Export failed: ${error.response?.data?.message || "Invalid export parameters"}`
        );
      } else {
        throw new Error(
          `Export failed: ${error.response?.data?.message || error.response?.data?.error || error.message}`
        );
      }
    }
  }

  /**
   * Delete a scan
   * @param {string} scanId - The scan ID to delete
   * @returns {Promise<object>} Delete result
   */
  async deleteScan(scanId) {
    try {
      const authToken = await this.client.getAuthToken();

      // Delete request matching Postman format (line 213)
      await axios.patch(
        `${this.baseUrl}/v3.1/${this.productEndpoint}/delete`,
        {
          scans: [{ id: scanId }],
          purge: true,
          completionWebhook: null,
          headers: [],
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log(`🗑️  Scan deleted: ${scanId}`);

      return {
        success: true,
        scanId: scanId,
        message: "Scan deleted successfully",
      };
    } catch (error) {
      console.error("✗ Delete failed:", error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Extract positions for highlighting from plagiarism result
   * @param {object} comparisonData - Comparison data from export
   * @returns {array} Array of {start, length, type}
   */
  extractHighlightPositions(comparisonData) {
    const positions = [];

    if (!comparisonData?.source?.chars) {
      return positions;
    }

    const { starts, lengths } = comparisonData.source.chars;

    if (!starts || !lengths) {
      return positions;
    }

    for (let i = 0; i < starts.length; i++) {
      positions.push({
        start: starts[i],
        length: lengths[i],
        type: "plagiarism",
      });
    }

    return positions;
  }

  /**
   * Calculate plagiarism statistics from result
   * @param {object} resultData - Result data from export
   * @returns {object} Statistics
   */
  calculateStatistics(resultData) {
    return {
      identicalWords: resultData.statistics?.identical || 0,
      minorChanges: resultData.statistics?.minorChanges || 0,
      relatedMeaning: resultData.statistics?.relatedMeaning || 0,
      totalMatchedWords:
        (resultData.statistics?.identical || 0) +
        (resultData.statistics?.minorChanges || 0) +
        (resultData.statistics?.relatedMeaning || 0),
      matchPercentage: resultData.matchPercentage || 0,
      sourceUrl: resultData.url || "",
      sourceTitle: resultData.title || "",
    };
  }
}

module.exports = PlagiarismScanner;
