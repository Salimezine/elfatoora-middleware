import assert from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import { db } from "../../../db/client.js";
import type { TkrCustomers } from "../../../db/schema.js";
import { verifyToken } from "../token.js";

// Mock the database
let selectFromMock: any;
let leftJoinMock: any;
let selectAllMock: any;
let whereMock: any;
let executeTakeFirstMock: any;

describe("Token Authentication", () => {
  beforeEach(() => {
    // Setup mocks
    executeTakeFirstMock = async () => null;

    whereMock = (condition: any) => ({
      where: whereMock,
      selectAll: selectAllMock,
      executeTakeFirst: executeTakeFirstMock,
    });

    selectAllMock = (table?: string) => ({
      where: whereMock,
      selectAll: selectAllMock,
      executeTakeFirst: executeTakeFirstMock,
    });

    leftJoinMock = (table: string, ...args: any[]) => ({
      selectAll: selectAllMock,
      where: whereMock,
      executeTakeFirst: executeTakeFirstMock,
    });

    selectFromMock = (table: string) => ({
      leftJoin: leftJoinMock,
      where: whereMock,
      selectAll: selectAllMock,
      executeTakeFirst: executeTakeFirstMock,
    });

    // Replace db.selectFrom with mock
    db.selectFrom = selectFromMock;
  });

  afterEach(() => {
    // Cleanup
  });

  describe("verifyToken", () => {
    it("should return MISSING error when token is not found", async () => {
      const result = await verifyToken("invalid-token");

      assert.strictEqual(result.error, "MISSING");
      assert.strictEqual(result.customer, null);
    });

    it("should return CUSTOMER_INACTIVE error when customer is inactive", async () => {
      const inactiveCustomer = {
        id: 1,
        is_active: false,
        name: "Inactive Customer",
      } as unknown as TkrCustomers;

      executeTakeFirstMock = async () => inactiveCustomer;

      const result = await verifyToken("valid-token");

      assert.strictEqual(result.error, "CUSTOMER_INACTIVE");
      assert.strictEqual(result.customer, null);
    });

    it("should return customer when token is valid and customer is active", async () => {
      const activeCustomer = {
        id: 1,
        is_active: true,
        name: "Active Customer",
      } as unknown as TkrCustomers;

      executeTakeFirstMock = async () => activeCustomer;

      const result = await verifyToken("valid-token");

      assert.strictEqual(result.error, null);
      assert.deepStrictEqual(result.customer, activeCustomer);
    });

    it("should handle database errors gracefully", async () => {
      const dbError = new Error("Database connection failed");
      executeTakeFirstMock = async () => {
        throw dbError;
      };

      const result = await verifyToken("token");

      assert.strictEqual(result.error, "MISSING");
      assert.strictEqual(result.customer, null);
    });

    it("should handle null/undefined token parameter", async () => {
      const result = await verifyToken("");

      assert.strictEqual(result.error, "MISSING");
      assert.strictEqual(result.customer, null);
    });

    it("should validate token expiration correctly", async () => {
      const customer = {
        id: 1,
        is_active: true,
        name: "Test Customer",
      } as unknown as TkrCustomers;

      executeTakeFirstMock = async () => customer;

      const result = await verifyToken("valid-token");

      assert.strictEqual(result.error, null);
      assert.deepStrictEqual(result.customer, customer);
    });

    it("should return customer with all properties intact", async () => {
      const customerWithAllProps = {
        id: 123,
        is_active: true,
        name: "Full Customer",
        email: "test@example.com",
        created_at: new Date(),
      } as unknown as TkrCustomers;

      executeTakeFirstMock = async () => customerWithAllProps;

      const result = await verifyToken("valid-token");

      assert.strictEqual(result.error, null);
      assert.strictEqual(result.customer?.id, 123);
      assert.strictEqual(result.customer?.is_active, true);
      assert.strictEqual(result.customer?.name, "Full Customer");
    });
  });
});
