# E2E Tests Directory Structure

```
src/__tests__/
├── e2e/                          # End-to-end tests
│   ├── documents.e2e.test.ts     # Main document API E2E tests
│   └── examples.e2e.test.ts      # Example patterns for various scenarios
└── helpers/
    └── e2e.helpers.ts            # Shared test utilities and data factories
```

## Files Overview

### `documents.e2e.test.ts`

Main end-to-end test suite for the Documents API. Tests include:

- Health check endpoint
- Creating documents (POST /v1/documents)
- Getting document status (GET /v1/documents/status/:invoiceNumber)
- Retrieving document artifacts (GET /v1/documents/artifacts/:invoiceNumber)
- Processing callbacks (POST /v1/documents/callback/:status)
- Complete document processing workflow
- Error handling
- Request ID correlation

### `examples.e2e.test.ts`

Reference examples showing different testing patterns:

- Authentication & Authorization
- Data Validation
- Pagination & Filtering
- Error Handling & Edge Cases
- Concurrent Requests
- Content-Type Handling
- Response Headers
- File Upload/Download
- Rate Limiting

Use these as templates for writing tests for additional endpoints.

### `e2e.helpers.ts`

Shared utilities and data factories:

- `createValidInvoice()` - Create test invoices
- `createTestPayload()` - Create document creation payloads
- `generateInvoiceBatch()` - Create multiple invoices
- `createMockRequest()` / `createMockResponse()` - Mock Express objects
- `createCallbackPayload()` - Create webhook test data
- `mockCustomerContext` - Pre-configured test customer data

## Running Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run in watch mode
pnpm test:e2e:watch

# Run specific test file
tsx --test src/__tests__/e2e/documents.e2e.test.ts

# Run tests matching pattern
tsx --test src/__tests__/e2e/documents.e2e.test.ts -g "should create"
```

## Adding New E2E Tests

1. Create a new file: `src/__tests__/e2e/feature.e2e.test.ts`
2. Import test utilities:
   ```typescript
   import { describe, it, before, after } from "node:test";
   import request from "supertest";
   import {
     createValidInvoice,
     createTestPayload,
   } from "../helpers/e2e.helpers.js";
   ```
3. Use the example patterns from `examples.e2e.test.ts`
4. Run tests: `pnpm test:e2e`

For detailed guidance, see [E2E_TESTING.md](../../E2E_TESTING.md)
