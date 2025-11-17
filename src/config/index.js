const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({
  path: process.env.PLAGIARISM_SERVICE_ENV || path.resolve(process.cwd(), ".env"),
});

function ensureEnv(value, key) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

const config = {
  env: process.env.NODE_ENV || "development",
  port: Number.parseInt(process.env.PLAGIARISM_SERVICE_PORT || process.env.PORT || "4000", 10),
  copyleaks: {
    email: ensureEnv(process.env.COPYLEAKS_EMAIL, "COPYLEAKS_EMAIL"),
    apiKey: ensureEnv(process.env.COPYLEAKS_API_KEY, "COPYLEAKS_API_KEY"),
    baseUrl: process.env.COPYLEAKS_BASE_URL || "https://api.copyleaks.com",
    productEndpoint: process.env.PRODUCT_ENDPOINT || "scans",
    sandboxMode: process.env.SANDBOX_MODE === "true",
  },
  webhookBaseUrl: ensureEnv(process.env.WEBHOOK_BASE_URL, "WEBHOOK_BASE_URL"),
};

module.exports = config;
