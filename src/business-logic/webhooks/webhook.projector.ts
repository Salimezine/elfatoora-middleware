import crypto from "crypto";
import { db, tbl } from "../../db/client.js";
import type {
  Document,
  DocumentArtifact,
  DocumentEvent,
  DocumentEventType,
  DocumentStatus,
} from "../../db/schema.js";
import {
  calculatePayloadHash,
  eventTypeMap,
  shouldDeliverEvent,
} from "./helpers.js";

/**
 * Webhook Projector using the Outbox Pattern
 *
 * This module handles the projection of document events into webhook deliveries.
 * It ensures:
 * - No webhook calls are made inside domain logic (domain never knows about webhooks)
 * - Event → Delivery mapping happens in the same transaction as event creation
 * - All failures are captured in the database for retry (none lost in-flight)
 * - Each delivery is idempotent based on payload hash
 *
 * Flow:
 * 1. Domain logic creates DocumentEvent
 * 2. In same transaction, webhook projector creates WebhookDelivery records
 * 3. Background worker picks up PENDING deliveries and sends them
 * 4. Worker updates status → DELIVERED or next_retry_at
 */

export interface CreateDocumentEventInput {
  document_id: string;
  event_type: DocumentEventType;
  from_status: DocumentStatus | null;
  to_status: DocumentStatus | null;
  metadata?: unknown;
}

/**
 * Emit document event and project webhooks (for use outside of transactions).
 * This will start a transaction internally, ensuring both operations complete
 * atomically.
 *
 * This function should be used when domain logic creates events that might
 * trigger webhooks but you're not already in a transaction.
 *
 * @param input Event creation input
 * @returns The created event
 */
export async function emitDocumentEventWithWebhooks(
  input: CreateDocumentEventInput,
  customer_id: string,
): Promise<DocumentEvent> {
  const trx = await db.startTransaction().execute();

  try {
    const event: DocumentEvent = {
      id: crypto.randomUUID(),
      document_id: input.document_id,
      event_type: input.event_type,
      from_status: input.from_status,
      to_status: input.to_status,
      metadata: input.metadata || null,
      created_at: new Date(),
    };

    // Insert event
    await trx.insertInto(tbl("documents_events")).values(event).execute();

    // Project webhooks in same transaction
    // Fetch the full document
    const document = await trx
      .selectFrom(tbl("documents"))
      .innerJoin(
        tbl("operations"),
        `${tbl("documents")}.operation_id`,
        `${tbl("operations")}.id`,
      )
      .where(`${tbl("documents")}.id`, "=", event.document_id)
      .select([
        `${tbl("documents")}.id`,
        `${tbl("documents")}.document_number`,
        `${tbl("documents")}.document_type as type`,
        `${tbl("documents")}.status`,
        `${tbl("documents")}.issue_date`,
        `${tbl("documents")}.currency`,
        `${tbl("documents")}.total_ttc`,
        `${tbl("documents")}.document_type`,
        `${tbl("operations")}.customer_id as customer_id`,
      ])
      .executeTakeFirst();

    if (!document) {
      throw new Error(`Document not found: ${event.document_id}`);
    }

    // Validate customer_id consistency
    if (document.customer_id !== customer_id) {
      throw new Error(
        `Customer ID mismatch: document belongs to ${document.customer_id}, but event creation attempted by ${customer_id}`,
      );
    }

    // Fetch artifact if it exists (for TTN info)
    const artifact = await trx
      .selectFrom(tbl("documents_artifacts"))
      .where("document_id", "=", event.document_id)
      .select(["ttn_reference", "qr_code_base64"])
      .executeTakeFirst();

    // Build the webhook payload
    const payload = buildWebhookPayload(
      event,
      document.customer_id,
      document,
      artifact || null,
    );
    const payloadHash = calculatePayloadHash(payload);

    // Find all active webhook endpoints for this customer that should receive this event
    const endpoints = await trx
      .selectFrom(tbl("webhook_endpoints"))
      .where("customer_id", "=", customer_id)
      .where("is_active", "=", true)
      .select(["id", "events"])
      .execute();

    // Create delivery records for matching endpoints
    const externalEventName = eventTypeMap[event.event_type];
    if (!externalEventName) {
      throw new Error(
        `No external event name mapping for event type: ${event.event_type}`,
      );
    }

    const deliveriesToInsert = endpoints
      .filter(({ events }) => shouldDeliverEvent(events, externalEventName))
      .map((endpoint) => ({
        id: crypto.randomUUID(),
        webhook_id: endpoint.id,
        document_event_id: event.id,
        payload,
        payload_hash: payloadHash,
        status: "PENDING" as const,
        attempts: 0,
        next_retry_at: new Date(),
        last_attempt_at: null,
        last_error: null,
        created_at: new Date(),
        updated_at: new Date(),
      }));

    // Insert all deliveries atomically
    if (deliveriesToInsert.length > 0) {
      await trx
        .insertInto(tbl("webhook_deliveries"))
        .values(deliveriesToInsert)
        .execute();
    }

    await trx.commit().execute();
    return event;
  } catch (error) {
    await trx.rollback().execute();
    throw error;
  }
}

interface WebhookPayload {
  id: string;
  type: string;
  created_at: string;
  customer_id: string;
  data: {
    document: {
      id: string;
      document_number: string;
      type: string;
      status: string;
      issue_date: string;
      currency: string;
      total_ttc: number;
    };
    event: {
      type: string;
      from_status: string | null;
      to_status: string | null;
      occurred_at: string;
    };
    ttn?: {
      reference: string;
      qr_code_base64: string;
    };
  };
}

/**
 * Builds complete webhook payload for external delivery.
 * Combines document, event, and optional TTN information into
 * a standardized structure that external systems subscribe to.
 *
 * @param event The document event
 * @param document The associated document
 * @param artifact Optional document artifact with TTN info
 * @returns Webhook payload
 */
export function buildWebhookPayload(
  event: Pick<
    DocumentEvent,
    "id" | "event_type" | "from_status" | "to_status" | "created_at"
  >,
  customer_id: string,
  document: Pick<
    Document,
    | "id"
    | "document_number"
    | "document_type"
    | "status"
    | "issue_date"
    | "currency"
    | "total_ttc"
  >,
  artifact: Pick<DocumentArtifact, "ttn_reference" | "qr_code_base64"> | null,
): WebhookPayload {
  const eventName = eventTypeMap[event.event_type];

  if (!eventName) {
    throw new Error(
      `No external event name mapping for event type: ${event.event_type}`,
    );
  }

  const payload: WebhookPayload = {
    id: event.id,
    type: eventName,
    created_at: event.created_at.toISOString(),
    customer_id: customer_id,
    data: {
      document: {
        id: document.id,
        document_number: document.document_number,
        type: document.document_type,
        status: document.status,
        issue_date: document.issue_date,
        currency: document.currency,
        total_ttc: Number(document.total_ttc),
      },
      event: {
        type: eventName,
        from_status: event.from_status ?? null,
        to_status: event.to_status ?? null,
        occurred_at: event.created_at.toISOString(),
      },
    },
  };

  // Add TTN information if available
  if (artifact?.ttn_reference) {
    payload.data.ttn = {
      reference: artifact.ttn_reference,
      qr_code_base64: artifact.qr_code_base64 || "",
    };
  }

  return payload;
}
