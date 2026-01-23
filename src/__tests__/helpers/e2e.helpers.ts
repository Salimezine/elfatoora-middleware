import type { Selectable } from "kysely";
import { randomUUID } from "node:crypto";
import { db } from "../../db/client.js";
import type { TkrCustomers } from "../../db/schema.js";
import type { Document } from "../../schemas/document.schema.js";
import {
  TEST_CUSTOMER_ID,
  TEST_NGSIGN_EMAIL,
  TEST_NGSIGN_TOKEN,
  TEST_TAX_ID,
  TEST_TOKEN,
} from "../consts.js";

export type TestCustomer = Selectable<TkrCustomers> & { token: string };

/**
 * E2E Test Utilities and Helpers
 * Provides factories and utilities for E2E tests
 */

/**
 * Creates a valid invoice with all required fields for testing
 * @param overrides - Partial invoice data to override defaults
 * @returns A valid invoice object
 */
export function createValidInvoice(overrides?: Partial<Document>): Document {
  return {
    header: {
      documentNumber: `INV-${randomUUID().substring(0, 8)}`,
      issueDate: "2025-01-15",
      type: "INVOICE",
      ...overrides?.header,
    },
    seller: {
      identifierType: "FISCAL_ID",
      identifier: "1234567AAM000",
      name: "Test Seller",
      address: {
        street: "123 Main St",
        city: "Tunis",
        country: "TN",
        postalCode: "1000",
      },
      contact: {
        email: "seller@example.com",
        phone: "+216 71 123 456",
      },
      ...overrides?.seller,
    },
    buyer: {
      identifierType: "FISCAL_ID",
      identifier: "9876543XAP000",
      name: "Test Buyer",
      address: {
        street: "456 Oak Ave",
        city: "Sousse",
        country: "TN",
        postalCode: "4000",
      },
      ...overrides?.buyer,
    },
    lines: [
      {
        lineNumber: 1,
        description: "Test Product",
        quantity: 1,
        unitPrice: { amount: 100, currency: "TND" },
        taxRate: 19,
      },
    ],
    totals: {
      subtotalHT: { amount: 100, currency: "TND" },
      totalTax: { amount: 19, currency: "TND" },
      totalTTC: { amount: 119, currency: "TND" },
    },
    ...overrides,
  };
}

/**
 * Creates a valid test payload for document creation endpoint
 * @param overrides - Partial payload overrides
 * @returns Document creation payload
 */
export function createTestPayload(
  overrides?: Partial<{
    data: Array<{ invoice: Document; pdf: string }>;
    successUrl: string | null;
    failureUrl: string | null;
  }>,
) {
  return {
    data: [
      {
        invoice: createValidInvoice(),
        pdf: "JVBERi0xLjQKJeLjz9MNCjEgMCBvYmo=", // Base64 encoded minimal PDF
      },
    ],
    successUrl: null,
    failureUrl: null,
    ...overrides,
  };
}

/**
 * Mock customer context for testing
 */
export const mockCustomerContext = {
  customer: {
    id: "test-customer-001",
    tax_id: "1234567AAM000",
    default_success_url: "https://example.com/success",
    default_failure_url: "https://example.com/failure",
    ngsign_signer_email: "signer@example.com",
    ngsign_token: "test-token-123",
    mode: "production" as const,
  },
};

/**
 * Creates a mock request with context
 * Useful for unit testing controllers
 */
export function createMockRequest(overrides?: any) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {
      "x-request-id": randomUUID(),
    },
    context: mockCustomerContext,
    ...overrides,
  };
}

/**
 * Creates a mock response with jest/vitest-compatible methods
 */
export function createMockResponse() {
  const res: any = {
    status: function (code: number) {
      res.statusCode = code;
      return res;
    },
    json: function (data: any) {
      res.jsonData = data;
      return res;
    },
    redirect: function (url: string) {
      res.redirectUrl = url;
      return res;
    },
    setHeader: function (key: string, value: string) {
      if (!res.headers) res.headers = {};
      res.headers[key] = value;
      return res;
    },
    statusCode: 200,
    headers: {},
  };
  return res;
}

/**
 * Waits for a specified duration (useful for testing async operations)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generates a fake PDF in base64 format
 */
export function generateFakePdfBase64(): string {
  // Minimal valid PDF structure in base64
  return "JVBERi0xLjQKJeLjz9MNCjEgMCBvYmoKPDwgL1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDIgMCBSID4+CmVuZG9iagoyIDAgb2JqCjw8IC9UeXBlIC9QYWdlcyAvS2lkcyBbMyAwIFJdIC9Db3VudCAxID4+CmVuZG9iagozIDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgMiAwIFIgL1Jlc291cmNlcyA8PCA+PiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNDAgMCBSID4+CmVuZG9iagpzdGFydHhmcmVmCjQzCiUlRU9G";
}

/**
 * Generates test invoice with specific document type
 */
export function createInvoiceByType(
  type: "INVOICE" | "CREDIT_NOTE" | "DEBIT_NOTE",
) {
  return createValidInvoice({
    header: {
      documentNumber: `INV-${randomUUID().substring(0, 8)}`,
      issueDate: "2025-01-15",
      type,
    },
  });
}

/**
 * Generates multiple invoices for batch testing
 */
export function generateInvoiceBatch(count: number): Document[] {
  return Array.from({ length: count }, (_, i) => ({
    ...createValidInvoice(),
    header: {
      ...createValidInvoice().header,
      documentNumber: `INV-BATCH-${String(i + 1).padStart(3, "0")}`,
    },
  }));
}

/**
 * Helper to validate invoice structure
 */
export function isValidInvoiceStructure(invoice: any): boolean {
  return (
    invoice?.header?.documentNumber &&
    invoice?.header?.issueDate &&
    invoice?.header?.type &&
    invoice?.seller?.identifier &&
    invoice?.buyer?.identifier &&
    Array.isArray(invoice?.items) &&
    invoice?.totals?.totalAmount !== undefined
  );
}

/**
 * Creates a callback payload for webhook testing
 */
export function createCallbackPayload(status: string, overrides?: any) {
  return {
    operationId: randomUUID(),
    documentNumber: `INV-${randomUUID().substring(0, 8)}`,
    status,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Setup: Create test customer and token
 */
export async function setupTestCustomer() {
  try {
    // Create customer
    const customer = await db
      .insertInto("tbl_tkr_customers")
      .values({
        id: TEST_CUSTOMER_ID,
        name: "Test Customer",
        tax_id: TEST_TAX_ID,
        mode: "TEST",
        ngsign_token: TEST_NGSIGN_TOKEN,
        ngsign_signer_email: TEST_NGSIGN_EMAIL,
        ttn_login: null, // No TTN login for tests
        ttn_password: null, // No TTN password for tests
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirst();

    if (!customer) {
      throw new Error("Failed to create test customer");
    }

    // Create token
    await db
      .insertInto("tbl_tkr_customer_tokens")
      .values({
        id: randomUUID(),
        customer_id: TEST_CUSTOMER_ID,
        token: TEST_TOKEN,
        name: "Test Token",
        is_active: true,
        updated_at: new Date(),
        created_at: new Date(),
      })
      .execute();

    return { ...customer, token: TEST_TOKEN };
  } catch (error) {
    console.error("Error setting up test customer:", error);
    throw error;
  }
}

/**
 * Cleanup: Delete test data
 */
export async function cleanupTestData() {
  try {
    // Delete tokens
    await db
      .deleteFrom("tbl_tkr_customer_tokens")
      .where("customer_id", "=", TEST_CUSTOMER_ID)
      .execute();

    // Delete customer
    await db
      .deleteFrom("tbl_tkr_customers")
      .where("id", "=", TEST_CUSTOMER_ID)
      .execute();

    // Delete test operations
    await db
      .deleteFrom("tbl_operations")
      .where("customer_id", "=", TEST_CUSTOMER_ID)
      .execute();
  } catch (error) {
    console.error("Error cleaning up test data:", error);
    // Don't throw - cleanup errors shouldn't fail tests
  }
}

/**
 * Import and initialize the real app
 */
export async function initializeApp() {
  try {
    // Import the Express app setup
    const { app } = await import("../../index.js");
    return app;
  } catch (error) {
    console.error("Error initializing app:", error);
    throw error;
  }
}
