const axios = require("axios");

/**
 * Unified Copyleaks API Client
 * Handles authentication for both Plagiarism and Grammar checking APIs
 */
class CopyleaksClient {
  constructor(email, apiKey) {
    this.email = email;
    this.apiKey = apiKey;
    this.authToken = null;
    this.tokenExpiry = null;

    // API endpoints
    this.endpoints = {
      login: "https://id.copyleaks.com/v3/account/login/api",
      grammarCheck: "https://api.copyleaks.com/v3/writer/check",
      writerDetector: "https://api.copyleaks.com/v3/writer-detector/check",
    };
  }

  /**
   * Login and get authentication token
   * Token is cached and reused until expiration
   */
  async login() {
    try {
      console.log("🔐 Authenticating with Copyleaks...");

      const response = await axios.post(
        this.endpoints.login,
        {
          email: this.email,
          key: this.apiKey,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      this.authToken = response.data.access_token;

      // Set token expiry (tokens typically expire after 1 hour)
      this.tokenExpiry = Date.now() + 55 * 60 * 1000; // 55 minutes

      console.log("✓ Successfully authenticated with Copyleaks");
      return this.authToken;
    } catch (error) {
      console.error("✗ Login failed:", error.response?.data || error.message);
      throw new Error(`Authentication failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get valid authentication token
   * Automatically refreshes if expired
   */
  async getAuthToken() {
    // Check if we have a valid token
    if (this.authToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.authToken;
    }

    // Token expired or doesn't exist, login again
    return await this.login();
  }

  /**
   * Make authenticated HTTP request
   * @param {string} url - API endpoint URL
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {object} data - Request body
   * @param {object} additionalHeaders - Additional headers
   */
  async makeRequest(url, method = "POST", data = null, additionalHeaders = {}) {
    const token = await this.getAuthToken();

    const config = {
      method,
      url,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...additionalHeaders,
      },
    };

    if (data) {
      config.data = data;
    }

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error(`✗ API request failed: ${url}`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Check if client is authenticated
   */
  isAuthenticated() {
    return this.authToken !== null && Date.now() < this.tokenExpiry;
  }

  /**
   * Get account information
   */
  async getAccountInfo() {
    try {
      const token = await this.getAuthToken();
      const response = await axios.get("https://api.copyleaks.com/v3/account", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data;
    } catch (error) {
      console.error("✗ Failed to get account info:", error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = CopyleaksClient;
