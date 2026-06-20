import assert from "assert";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import type { DocumentStatus } from "../../../db/schema.js";
import type { Document } from "../../../schemas/document.schema.js";
import {
  createIncomingDocumentsTransaction,
  savedDocAfterSign,
  saveIncomingDocumentArtifact,
  saveIncomingDocuments,
  setNGSignUUID,
  updateDocumentStatus,
  type SaveIncomingDocumentArtifactItem,
} from "../incoming-documents.js";

describe("incoming-documents", () => {
  describe("createIncomingDocumentsTransaction", () => {
    it("should create an operation with PENDING status", async () => {
      const mockDb = {
        insertInto: () => ({
          values: () => ({
            returning: () => ({
              executeTakeFirstOrThrow: async () => ({
                id: "op-123",
              }),
            }),
          }),
        }),
      };

      const operationId = await createIncomingDocumentsTransaction(
        mockDb as any,
        "customer-001",
        "https://example.com/success",
        "https://example.com/failure",
      );

      assert.strictEqual(operationId, "op-123");
    });

    it("should generate unique operation IDs on multiple calls", async () => {
      let callCount = 0;
      const mockDb = {
        insertInto: () => ({
          values: (values: any) => {
            callCount++;
            assert.strictEqual(values.status, "PENDING");
            assert.ok(values.id);
            assert.ok(values.created_at);
            assert.ok(values.updated_at);
            return {
              returning: () => ({
                executeTakeFirstOrThrow: async () => ({
                  id: `op-${callCount}`,
                }),
              }),
            };
          },
        }),
      };

      const id1 = await createIncomingDocumentsTransaction(
        mockDb as any,
        "customer-001",
        "https://example.com/success",
        "https://example.com/failure",
      );

      const id2 = await createIncomingDocumentsTransaction(
        mockDb as any,
        "customer-002",
        "https://example.com/success",
        "https://example.com/failure",
      );

      assert.notStrictEqual(id1, id2);
    });

    it("should store callback URLs correctly", async () => {
      let capturedValues: any;
      const mockDb = {
        insertInto: () => ({
          values: (values: any) => {
            capturedValues = values;
            return {
              returning: () => ({
                executeTakeFirstOrThrow: async () => ({
                  id: "op-123",
                }),
              }),
            };
          },
        }),
      };

      await createIncomingDocumentsTransaction(
        mockDb as any,
        "customer-001",
        "https://success.example.com",
        "https://failure.example.com",
      );

      assert.strictEqual(
        capturedValues.success_callback_url,
        "https://success.example.com",
      );
      assert.strictEqual(
        capturedValues.failure_callback_url,
        "https://failure.example.com",
      );
      assert.strictEqual(capturedValues.customer_id, "customer-001");
    });
  });

  describe("saveIncomingDocuments", () => {
    it("should save documents and return document IDs", async () => {
      const mockDocuments = [
        {
          id: "doc-1",
          documentNumber: "INV-001",
        },
      ];

      let commitCalled = false;
      let callCount = 0;
      const mockTrx = {
        insertInto: () => ({
          values: () => {
            callCount++;
            if (callCount === 1) {
              // First call for documents
              return {
                returning: () => ({
                  execute: async () => mockDocuments,
                }),
                execute: async () => undefined, // Fallback
              };
            } else {
              // Second call for events
              return {
                execute: async () => undefined,
              };
            }
          },
        }),
        commit: () => ({
          execute: async () => {
            commitCalled = true;
          },
        }),
        rollback: () => ({
          execute: async () => undefined,
        }),
      };

      const mockDb = {
        startTransaction: () => ({
          execute: async () => mockTrx,
        }),
      };

      const input: Document[] = [
        {
          header: {
            documentNumber: "INV-001",
            type: "INVOICE",
            issueDate: "2024-01-20",
          },
          seller: { identifier: "SELLER123" },
          buyer: { identifier: "BUYER456" },
          totals: {
            subtotalHT: { amount: 100, currency: "USD" },
            totalTax: { amount: 20, currency: "USD" },
            totalTTC: { amount: 120, currency: "USD" },
          },
        } as any,
      ];

      const result = await saveIncomingDocuments(
        mockDb as any,
        input,
        "op-123",
        "system-001",
      );

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].id, "doc-1");
      assert.ok(commitCalled);
    });

    it("should hash document payload", async () => {
      let capturedDocuments: any[] = [];
      let callCount = 0;
      const mockTrx = {
        insertInto: () => ({
          values: (values: any) => {
            callCount++;
            if (callCount === 1) {
              capturedDocuments = values;
            }
            return {
              returning: () => ({
                execute: async () => [
                  { id: "doc-1", documentNumber: "INV-001" },
                ],
              }),
              execute: async () => undefined,
            };
          },
        }),
        commit: () => ({ execute: async () => {} }),
        rollback: () => ({ execute: async () => {} }),
      };

      const mockDb = {
        startTransaction: () => ({
          execute: async () => mockTrx,
        }),
      };

      const input: Document[] = [
        {
          header: {
            documentNumber: "INV-001",
            type: "INVOICE",
            issueDate: "2024-01-20",
          },
          seller: { identifier: "SELLER123" },
          buyer: { identifier: "BUYER456" },
          totals: {
            subtotalHT: { amount: 100, currency: "USD" },
            totalTax: { amount: 20, currency: "USD" },
            totalTTC: { amount: 120, currency: "USD" },
          },
        } as any,
      ];

      await saveIncomingDocuments(mockDb as any, input, "op-123", "system-001");

      const doc = capturedDocuments[0];
      assert.ok(doc.payload_hash);
      assert.strictEqual(doc.payload_hash.length, 64); // SHA256 hex is 64 chars
    });

    it("should rollback on error", async () => {
      let rollbackCalled = false;
      const mockTrx = {
        insertInto: () => {
          throw new Error("Database error");
        },
        commit: () => ({ execute: async () => {} }),
        rollback: () => ({
          execute: async () => {
            rollbackCalled = true;
          },
        }),
      };

      const mockDb = {
        startTransaction: () => ({
          execute: async () => mockTrx,
        }),
      };

      const input: Document[] = [
        {
          header: {
            documentNumber: "INV-001",
            type: "INVOICE",
            issueDate: "2024-01-20",
          },
          seller: { identifier: "SELLER123" },
          buyer: { identifier: "BUYER456" },
          totals: {
            subtotalHT: { amount: 100, currency: "USD" },
            totalTax: { amount: 20, currency: "USD" },
            totalTTC: { amount: 120, currency: "USD" },
          },
        } as any,
      ];

      try {
        await saveIncomingDocuments(mockDb as any, input, "op-123");
      } catch (error) {
        // Expected to throw
      }

      assert.ok(rollbackCalled);
    });
  });

  describe("saveIncomingDocumentArtifact", () => {
    it("should save artifacts for documents", async () => {
      let savedArtifacts: any[] = [];
      const mockTrx = {
        insertInto: () => ({
          values: (values: any) => {
            savedArtifacts = values;
            return {
              returning: () => ({
                execute: async () => [{ documentId: "doc-1" }],
              }),
            };
          },
        }),
        updateTable: () => ({
          set: () => ({
            where: () => ({
              where: () => ({
                execute: async () => undefined,
              }),
            }),
          }),
        }),
        commit: () => ({ execute: async () => {} }),
        rollback: () => ({ execute: async () => {} }),
      };

      const mockDb = {
        startTransaction: () => ({
          execute: async () => mockTrx,
        }),
      };

      const items: SaveIncomingDocumentArtifactItem[] = [
        {
          operationId: "op-123",
          documentId: "doc-1",
          teifXmlContent: "<xml>test</xml>",
        },
      ];

      await saveIncomingDocumentArtifact(mockDb as any, items);

      assert.strictEqual(savedArtifacts.length, 1);
      assert.strictEqual(savedArtifacts[0].teif_xml, "<xml>test</xml>");
    });

    it("should compute XML hash", async () => {
      let savedArtifacts: any[] = [];
      const mockTrx = {
        insertInto: () => ({
          values: (values: any) => {
            savedArtifacts = values;
            return {
              returning: () => ({
                execute: async () => [{ documentId: "doc-1" }],
              }),
            };
          },
        }),
        updateTable: () => ({
          set: () => ({
            where: () => ({
              where: () => ({
                execute: async () => undefined,
              }),
            }),
          }),
        }),
        commit: () => ({ execute: async () => {} }),
        rollback: () => ({ execute: async () => {} }),
      };

      const mockDb = {
        startTransaction: () => ({
          execute: async () => mockTrx,
        }),
      };

      const xmlContent = "<xml>test</xml>";
      const expectedHash = crypto
        .createHash("sha256")
        .update(xmlContent)
        .digest("hex");

      const items: SaveIncomingDocumentArtifactItem[] = [
        {
          operationId: "op-123",
          documentId: "doc-1",
          teifXmlContent: xmlContent,
        },
      ];

      await saveIncomingDocumentArtifact(mockDb as any, items);

      assert.strictEqual(savedArtifacts[0].xml_hash, expectedHash);
    });

    it("should update document status to SIGNING_PENDING", async () => {
      let updateStatus: string | undefined;
      const mockTrx = {
        insertInto: () => ({
          values: () => ({
            returning: () => ({
              execute: async () => [{ documentId: "doc-1" }],
            }),
          }),
        }),
        updateTable: () => ({
          set: (data: any) => {
            updateStatus = data.status;
            return {
              where: () => ({
                where: () => ({
                  execute: async () => undefined,
                }),
              }),
            };
          },
        }),
        commit: () => ({ execute: async () => {} }),
        rollback: () => ({ execute: async () => {} }),
      };

      const mockDb = {
        startTransaction: () => ({
          execute: async () => mockTrx,
        }),
      };

      const items: SaveIncomingDocumentArtifactItem[] = [
        {
          operationId: "op-123",
          documentId: "doc-1",
          teifXmlContent: "<xml>test</xml>",
        },
      ];

      await saveIncomingDocumentArtifact(mockDb as any, items);

      assert.strictEqual(updateStatus, "SIGNING_PENDING");
    });

    it("should not save artifacts if items array is empty", async () => {
      let commitCalled = false;
      const mockTrx = {
        insertInto: () => {
          throw new Error("Should not be called");
        },
        commit: () => ({
          execute: async () => {
            commitCalled = true;
          },
        }),
      };

      const mockDb = {
        startTransaction: () => ({
          execute: async () => mockTrx,
        }),
      };

      await saveIncomingDocumentArtifact(mockDb as any, []);

      assert.ok(!commitCalled);
    });
  });

  describe("setNGSignUUID", () => {
    it("should update operation with ngsign UUID", async () => {
      let capturedValues: any;
      const mockDb = {
        updateTable: () => ({
          set: (values: any) => {
            capturedValues = values;
            return {
              where: () => ({
                execute: async () => undefined,
              }),
            };
          },
        }),
      };

      await setNGSignUUID(mockDb as any, "op-123", "uuid-abc-123");

      assert.strictEqual(capturedValues.ngsign_uuid, "uuid-abc-123");
      assert.ok(capturedValues.updated_at);
    });
  });

  describe("updateDocumentStatus", () => {
    it("should update document status", async () => {
      let capturedStatus: string | undefined;
      const mockDb = {
        updateTable: () => ({
          set: (data: any) => {
            capturedStatus = data.status;
            return {
              where: () => ({
                execute: async () => undefined,
              }),
            };
          },
        }),
      };

      await updateDocumentStatus(
        mockDb as any,
        "doc-123",
        "SIGNED" as DocumentStatus,
      );

      assert.strictEqual(capturedStatus, "SIGNED");
    });

    it("should work with ControlledTransaction", async () => {
      let capturedStatus: string | undefined;
      const mockTrx = {
        updateTable: () => ({
          set: (data: any) => {
            capturedStatus = data.status;
            return {
              where: () => ({
                execute: async () => undefined,
              }),
            };
          },
        }),
      };

      await updateDocumentStatus(
        mockTrx as any,
        "doc-123",
        "TTN_PENDING" as DocumentStatus,
      );

      assert.strictEqual(capturedStatus, "TTN_PENDING");
    });
  });

  describe("savedDocAfterSign", () => {
    it("should throw error if xmlBase64 is missing", async () => {
      const mockTrx = {} as any;

      try {
        await savedDocAfterSign(mockTrx, "op-123", "INV-001", "");
        assert.fail("Should have thrown error");
      } catch (error: any) {
        assert.ok(error.message.includes("Missing xmlBase64"));
      }
    });

    it("should throw error if document not found", async () => {
      const mockTrx = {
        selectFrom: () => ({
          select: () => ({
            where: () => ({
              where: () => ({
                executeTakeFirst: async () => null,
              }),
            }),
          }),
        }),
      } as any;

      try {
        await savedDocAfterSign(mockTrx, "op-123", "INV-001", "base64xml");
        assert.fail("Should have thrown error");
      } catch (error: any) {
        assert.ok(error.message.includes("Document not found"));
      }
    });

    it("should update artifact with signed XML", async () => {
      let updatedData: any;
      let callCount = 0;
      const mockTrx = {
        selectFrom: () => ({
          select: () => ({
            where: () => ({
              where: () => ({
                executeTakeFirst: async () => ({
                  id: "doc-123",
                  document_number: "INV-001",
                }),
              }),
            }),
          }),
        }),
        updateTable: () => ({
          set: (data: any) => {
            if (callCount === 0) updatedData = data;
            callCount++;
            return {
              where: () => ({
                execute: async () => undefined,
              }),
            };
          },
        }),
        insertInto: () => ({
          values: () => ({
            execute: async () => undefined,
          }),
        }),
      } as any;

      const xmlBase64 = "base64encodedxml";
      await savedDocAfterSign(mockTrx, "op-123", "INV-001", xmlBase64);

      assert.strictEqual(updatedData.teif_xml, xmlBase64);
      assert.ok(updatedData.xml_hash);
      assert.strictEqual(updatedData.certificate_issuer, "NGSign");
    });

    it("should create SIGNED event with status transition", async () => {
      let insertedEvent: any;
      const mockTrx = {
        selectFrom: () => ({
          select: () => ({
            where: () => ({
              where: () => ({
                executeTakeFirst: async () => ({
                  id: "doc-123",
                  document_number: "INV-001",
                }),
              }),
            }),
          }),
        }),
        updateTable: () => ({
          set: () => ({
            where: () => ({
              execute: async () => undefined,
            }),
          }),
        }),
        insertInto: () => ({
          values: (data: any) => {
            insertedEvent = data;
            return {
              execute: async () => undefined,
            };
          },
        }),
      } as any;

      await savedDocAfterSign(mockTrx, "op-123", "INV-001", "base64xml");

      assert.strictEqual(insertedEvent.event_type, "SIGNED");
      assert.strictEqual(insertedEvent.from_status, "SIGNING_PENDING");
      assert.strictEqual(insertedEvent.to_status, "TTN_PENDING");
    });

    it("should compute correct XML hash", async () => {
      let updatedData: any;
      let callCount = 0;
      const mockTrx = {
        selectFrom: () => ({
          select: () => ({
            where: () => ({
              where: () => ({
                executeTakeFirst: async () => ({
                  id: "doc-123",
                  document_number: "INV-001",
                }),
              }),
            }),
          }),
        }),
        updateTable: () => ({
          set: (data: any) => {
            if (callCount === 0) updatedData = data;
            callCount++;
            return {
              where: () => ({
                execute: async () => undefined,
              }),
            };
          },
        }),
        insertInto: () => ({
          values: () => ({
            execute: async () => undefined,
          }),
        }),
      } as any;

      const xmlBase64 = "base64encodedxml";
      const expectedHash = crypto
        .createHash("sha256")
        .update(Buffer.from(xmlBase64, "base64"))
        .digest("hex");

      await savedDocAfterSign(mockTrx, "op-123", "INV-001", xmlBase64);

      assert.strictEqual(updatedData.xml_hash, expectedHash);
    });
  });
});
