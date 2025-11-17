# Plagiarism Highlight Microservice

A minimal, authentication-free REST microservice focused solely on Copyleaks plagiarism scanning with highlight-ready output. It reuses the production-tested client, scanner, and highlighter from the main application while exposing a clean `/plagiarism` API surface and webhook receivers. The service is implemented with Fastify + Pino and linted with Biome.

## Features

- Submit plain text for Copyleaks plagiarism scanning without additional auth layers
- Automatic webhook handling for status, results, crawled content, and exports
- Auto-triggers export flows when scans complete to fetch comparison data
- Converts Copyleaks comparison payloads into character-level highlights and HTML snippets
- Fastify HTTP stack with Pino logging and Biome formatting/linting
- Health checks, structured logging, input validation, and centralized error handling

## Architecture & Shared Modules

This service maintains true microservice independence by keeping local copies of three production-tested modules:

- **`copyleaks-client.js`** – Handles Copyleaks API authentication with automatic token refresh and caching (55-minute expiry)
- **`plagiarism-scanner.js`** – Orchestrates scan submission, export requests, and result retrieval with exponential backoff retry logic
- **`text-highlighter.js`** – Generates character-level plagiarism highlights with overlap resolution and HTML output

These modules were originally developed in the main application and copied into this service to eliminate external dependencies. This architecture allows the service to be:
- **Deployed independently** without coupling to the parent codebase
- **Scaled separately** based on plagiarism checking demand
- **Versioned independently** with its own release cycle

### Maintaining Module Consistency

When updating these shared modules:
1. Make changes in this service first to validate functionality
2. Consider syncing changes back to the main application if the improvements are broadly applicable
3. Run the full test suite (`npm test`) to verify plagiarism detection still works correctly
4. Update tests in both locations if behavior changes

## Directory Layout

```
service/plagiarism-service/
├── .env.example
├── README.md
├── biome.json
├── package.json
└── src
    ├── app.js                  # Fastify instance factory
    ├── config/index.js         # Environment + validation
    ├── controllers             # HTTP and webhook controllers
    ├── middlewares             # Not-found + error middleware
    ├── routes                  # Plagiarism + webhook routers
    ├── services                # Copyleaks + highlight helpers
    ├── storage/scanStore.js    # In-memory persistence
    ├── utils                   # Logger + async wrapper
    └── server.js               # Entry point
```

## Getting Started

1. **Install service dependencies**:
   ```bash
   cd service/plagiarism-service
   npm install
   ```

2. **Copy environment config** at repo root (shared with the primary app) and fill in Copyleaks credentials plus a public webhook URL:
   ```bash
   cp service/plagiarism-service/.env.example .env
   ```

   Required environment variables:
   - `COPYLEAKS_EMAIL` – Your Copyleaks API account email
   - `COPYLEAKS_API_KEY` – Your Copyleaks API key
   - `WEBHOOK_BASE_URL` – Public HTTPS URL where Copyleaks can send webhooks (use ngrok for local dev)
   - `PLAGIARISM_SERVICE_PORT` – Port for the service (default: 4000)
   - `NODE_ENV` – Environment mode (`development` or `production`)
   - `COPYLEAKS_PRODUCT_ENDPOINT` – Copyleaks product endpoint (default: `scans`)
   - `COPYLEAKS_BASE_URL` – Copyleaks API base URL (default: `https://api.copyleaks.com`)

   > Ensure `WEBHOOK_BASE_URL` is reachable by Copyleaks (use ngrok during local dev). The same `.env` can be shared with the main app.

3. **Run the microservice**:
   ```bash
   cd service/plagiarism-service
   npm start
   ```

   The service listens on `PLAGIARISM_SERVICE_PORT` (default `4000`).

## API

### `POST /plagiarism`
Submit text for checking.

```json
{
  "text": "Example paragraph...",
  "options": {
    "sensitivityLevel": 3,
    "includeHtml": true
  }
}
```

**Response** `202 Accepted`
```json
{
  "scanId": "scan-<uuid>",
  "status": "pending",
  "message": "Scan submitted successfully. Await webhook callbacks for completion."
}
```

### `GET /plagiarism`
Returns a pageless list of scans with summary metadata.

### `GET /plagiarism/:scanId`
Detailed status for a single scan (credits, summary, export progress).

### `GET /plagiarism/:scanId/highlight`
Delivers highlight metadata, HTML, and line-level report once export data is ready. Returns `409` if Copyleaks has not delivered the comparison payload yet.

### `DELETE /plagiarism/:scanId`
Deletes a stored scan and requests deletion from Copyleaks (best-effort).

### `GET /health`
Basic liveness check.

## Webhooks

The scanner automatically registers these endpoints via `WEBHOOK_BASE_URL`:

- `POST /webhook/{STATUS}/:scanId` – status, completion, and error events
- `POST /webhook/new-result/:scanId` – incremental matches
- `POST /webhook/result/:scanId/:resultId` – exported comparison payloads
- `POST /webhook/crawled/:scanId` – crawled/original text body
- `POST /webhook/pdf/:scanId` – PDF payload (stored for completeness)
- `POST /webhook/export-completed/:scanId` – export lifecycle hook

On completion, the service kicks off an export automatically so highlights are generated without additional API calls.

## Development

### Running Tests

```bash
npm test              # Run all tests
npm run test:ui      # Interactive test UI with Vitest
npm run test:coverage # Generate coverage reports
```

All tests use Vitest with 10-second timeouts for API calls. Coverage reports are generated in HTML, JSON, and text formats.

### Linting & Formatting

```bash
npm run lint         # Check for linting/formatting issues (Biome)
npx biome check --write .  # Auto-fix all fixable issues
```

The project uses [Biome](https://biomejs.dev/) for fast linting and formatting with:
- 100-character line width
- 2-space indentation
- Double quotes
- Trailing commas
- Semicolons required

Run `npm run lint` before committing to ensure code quality.

### Testing with Webhooks Locally

For local development with webhook testing:

1. **Start ngrok** to expose your local service:
   ```bash
   ngrok http 4000
   ```

2. **Copy the HTTPS URL** from ngrok output (e.g., `https://abc123.ngrok.io`)

3. **Update your `.env` file**:
   ```bash
   WEBHOOK_BASE_URL=https://abc123.ngrok.io
   ```

4. **Start the service**:
   ```bash
   npm start
   ```

5. **Use the Postman collection** (`Plagiarism Service.postman_collection.json`) to submit scans and monitor webhook responses in real-time

The ngrok web interface at `http://localhost:4040` lets you inspect all webhook payloads from Copyleaks.

## Notes & Best Practices

- **Copied Modules**: This service maintains local copies of `copyleaks-client.js`, `plagiarism-scanner.js`, and `text-highlighter.js` for microservice independence. When updating these modules, consider syncing improvements back to the main application to maintain consistency.
- **In-Memory Storage**: This service intentionally stores scan data in memory. For production usage, back the `scanStore` with Redis or a database.
- **HTTPS Required**: Run the service behind HTTPS and supply an HTTPS `WEBHOOK_BASE_URL` to meet Copyleaks requirements.
- **No Authentication**: No API authentication is enforced—restrict network access at the ingress layer if the service is exposed publicly.
- **Observability**: Logging hooks rely on Pino, which integrates cleanly with most log drains and monitoring systems.
- **Linting**: Run `npm run lint` (Biome) before committing changes to ensure code quality and consistent formatting.
