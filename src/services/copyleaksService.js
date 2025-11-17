const CopyleaksClient = require("./copyleaks-client");
const PlagiarismScanner = require("./plagiarism-scanner");
const config = require("../config");

const copyleaksClient = new CopyleaksClient(config.copyleaks.email, config.copyleaks.apiKey);

const plagiarismScanner = new PlagiarismScanner(
  copyleaksClient,
  config.webhookBaseUrl,
  config.copyleaks.productEndpoint,
  config.copyleaks.baseUrl
);

module.exports = {
  copyleaksClient,
  plagiarismScanner,
};
