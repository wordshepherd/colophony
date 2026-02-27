# @colophony/sdk

TypeScript SDK for the Colophony REST API. Generated from the OpenAPI 3.1 specification.

## Installation

```bash
# From npm (when published)
npm install @colophony/sdk

# From git
npm install github:your-org/colophony#main -- sdks/typescript
```

## Usage

```typescript
import { createColophonySDK } from "@colophony/sdk";

// Bearer token auth (interactive users)
const sdk = createColophonySDK({
  baseUrl: "https://api.example.com/v1",
  auth: { type: "bearer", token: () => getAccessToken() },
  orgId: "your-org-uuid",
});

// API key auth (programmatic access)
const sdk = createColophonySDK({
  baseUrl: "https://api.example.com/v1",
  auth: { type: "apiKey", key: "col_live_your_key_here" },
  orgId: "your-org-uuid",
});

// Make requests
const { data, error } = await sdk.GET("/submissions", {
  params: { query: { page: 1, limit: 10 } },
});

if (data) {
  console.log(data.items);
}
```

## API Reference

See the interactive API docs at `/v1/docs` on your Colophony instance.

## Regenerating

```bash
pnpm sdk:generate
```
