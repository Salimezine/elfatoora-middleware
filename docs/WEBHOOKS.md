# Webhook System Documentation

## Overview

The webhook system enables real-time notifications of document events to external invoicing systems. It implements the **outbox pattern** to ensure:

- **Reliability**: No webhook events are lost
- **Idempotence**: External systems can safely handle duplicate deliveries
- **Decoupling**: Core business logic never depends on webhook delivery success
- **Observability**: Complete audit trail of all delivery attempts

## Architecture

### Design Principles

1. **Event-Driven**: Webhooks are derived from document events, not created separately
2. **Asynchronous**: All webhook deliveries happen outside the document processing flow
3. **Retryable**: Failed deliveries are retried with exponential backoff
4. **Idempotent**: Each delivery can be safely retried or deduplicated
5. **Transactional**: Events and deliveries are created atomically (outbox pattern)

### Key Components

#### 1. **Webhook Endpoints** (`webhook_endpoints` table)

Stores customer webhook subscriptions:

```typescript
interface WebhookEndpoint {
  id: string; // UUID
  customer_id: string; // Customer reference
  url: string; // HTTP(S) URL for POST requests
  secret: string; // HMAC-SHA256 secret for request signing
  events: string[]; // Array of event types (empty = all events)
  is_active: boolean; // Soft delete via this flag
  created_at: Date;
  updated_at: Date;
}
```

**Features:**

- Multiple endpoints per customer supported
- Subscribe to specific event types or all events (empty array = all)
- Easy disable without deletion (`is_active` flag)

#### 2. **Webhook Deliveries** (`webhook_deliveries` table - Outbox)

Event queue for reliable delivery. This is the **outbox pattern** implementation:

```typescript
interface WebhookDelivery {
  id: string; // UUID
  webhook_id: string; // Reference to endpoint
  document_event_id: string; // Reference to event (immutable)
  payload: unknown; // Full webhook payload (JSONB)
  payload_hash: string; // SHA256 hash for idempotency
  status: "PENDING" | "DELIVERED" | "FAILED";
  attempts: number; // Delivery attempt count
  last_attempt_at: Date | null; // Timestamp of last attempt
  next_retry_at: Date | null; // When to retry next (NULL = never)
  last_error: string | null; // Most recent error message
  created_at: Date;
  updated_at: Date;
}
```

**Workflow:**

1. Document event is created → webhook delivery records are inserted (same transaction)
2. Background worker polls `PENDING` deliveries where `next_retry_at <= now()`
3. On success (2xx): `status = DELIVERED`
4. On failure: `next_retry_at` updated for exponential backoff, `status = PENDING`
5. After max retries: `status = FAILED`, `next_retry_at = NULL`

#### 3. **Webhook Payload Structure**

```json
{
  "id": "evt-123",
  "type": "document.signed",
  "created_at": "2025-01-20T10:00:00.000Z",
  "customer_id": "cust-456",
  "data": {
    "document": {
      "id": "doc-789",
      "document_number": "INV-2025-001",
      "type": "INVOICE",
      "status": "TTN_PENDING",
      "issue_date": "2025-01-20",
      "currency": "TND",
      "total_ttc": 1200.0
    },
    "event": {
      "type": "document.signed",
      "from_status": "SIGNING_PENDING",
      "to_status": "TTN_PENDING",
      "occurred_at": "2025-01-20T10:00:00.000Z"
    },
    "ttn": {
      "reference": "TTN-2025-001-ABC",
      "qr_code_base64": "iVBORw0KGgoAAAANSUhEUg..."
    }
  }
}
```

### Event Type Mapping

Internal event types are mapped to external event names:

| Internal                   | External                            |
| -------------------------- | ----------------------------------- |
| `RECEIVED`                 | `document.received`                 |
| `SIGNING_REQUESTED`        | `document.signing_requested`        |
| `SIGNED`                   | `document.signed`                   |
| `SIGNING_FAILED`           | `document.signing_failed`           |
| `TTN_SUBMISSION_REQUESTED` | `document.ttn.submission_requested` |
| `TTN_SUBMITTED`            | `document.ttn.submitted`            |
| `TTN_ACCEPTED`             | `document.ttn.accepted`             |
| `TTN_REJECTED`             | `document.ttn.rejected`             |
| `COMPLETED`                | `document.completed`                |
| `FAILED`                   | `document.failed`                   |
| `CANCELLED`                | `document.cancelled`                |
| `RETRIED`                  | `document.retried`                  |
| `STATUS_CHANGED`           | `document.status_changed`           |

## Security

### HMAC-SHA256 Request Signing

All webhook requests are signed to prevent tampering and verify authenticity:

- **Header:** `X-Tekru-Signature`
- **Format:** `t=<timestamp>,v1=<signature>`
- **Signature Base:** `${timestamp}.${rawBody}`

**Example:**

```
X-Tekru-Signature: t=1705747200,v1=abcd1234...
```

### Verification Algorithm (Client-Side)

```typescript
const secret = "webhook_secret_from_dashboard";
const signature = req.headers["x-tekru-signature"];
const body = req.rawBody; // Raw request body bytes
const toleranceSeconds = 300; // 5 minutes

// Parse header
const [t, v1] = signature.split(",").map((s) => s.split("=")[1]);

// Check timestamp
const now = Math.floor(Date.now() / 1000);
if (Math.abs(now - parseInt(t)) > toleranceSeconds) {
  throw new Error("Signature too old (replay attack)");
}

// Verify signature
const expectedSignature = HMAC - SHA256(`${t}.${body}`, secret);
if (expectedSignature !== v1) {
  throw new Error("Invalid signature (tampering detected)");
}
```

## Retry Policy

Deliveries follow exponential backoff with a maximum of 5 retry attempts:

| Attempt       | Delay         | Total Time |
| ------------- | ------------- | ---------- |
| 0 (immediate) | 0 seconds     | Immediate  |
| 1             | +1 minute     | ~1 min     |
| 2             | +5 minutes    | ~6 min     |
| 3             | +30 minutes   | ~36 min    |
| 4             | +2 hours      | ~2h 36m    |
| 5+            | None (FAILED) | Permanent  |

**Retry Trigger:** If `status = PENDING` and `next_retry_at <= now()`

**Success Criteria:** HTTP status 200-299 (2xx)

**Failure Handling:**

- 4xx errors (client): Scheduled for retry but logged for investigation
- 5xx errors (server): Scheduled for retry
- Network/timeout errors: Scheduled for retry
- After max retries: Status becomes `FAILED`, no more attempts

## Outbox Pattern Implementation

The outbox pattern ensures no events are lost:

### Atomicity

```
transaction:
  1. Insert DocumentEvent
  2. Query matching WebhookEndpoint records
  3. Insert WebhookDelivery records for each endpoint
  4. commit (all-or-nothing)
```

If the transaction fails, no event is created and no deliveries are queued.

### Separation of Concerns

Domain logic (business-logic/) knows nothing about webhooks:

```typescript
// ✅ Good: Event creation doesn't reference webhooks
export async function savedDocAfterSign(
  trx: ControlledTransaction<DB, []>,
  operationId: string,
  invoiceNumber: string,
  xmlBase64: string,
) {
  // Save signature event
  await trx.insertInto(tbl("documents_events")).values({...}).execute();
  // Webhook projection happens AFTER event creation
}

// ❌ Bad: Never do this
await fetch(`${webhook.url}`, { body: JSON.stringify(payload) });
// ^ This is NOT in our codebase - webhooks are always async
```

### Worker Pattern

Background worker processes deliveries asynchronously:

```
Worker Loop:
  1. Poll: SELECT * FROM webhook_deliveries WHERE status = 'PENDING' AND next_retry_at <= now()
  2. For each delivery:
     a. POST to webhook URL with signature
     b. If success: mark DELIVERED
     c. If failure: update next_retry_at and keep status PENDING
     d. If max retries: mark FAILED
  3. Sleep and repeat
```

## Usage

### Creating Webhook Endpoints

```typescript
// Via admin API or customer portal
// This would typically be exposed via a REST endpoint
const endpoint = await db
  .insertInto(tbl("webhook_endpoints"))
  .values({
    id: crypto.randomUUID(),
    customer_id: customerId,
    url: "https://external-system.com/webhooks/elfatoora",
    secret: crypto.randomBytes(32).toString("hex"),
    events: ["document.signed", "document.completed"], // Empty = all events
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  })
  .returning("*")
  .executeTakeFirstOrThrow();
```

### Starting the Delivery Worker

```typescript
import { processWebhookDeliveries } from "./webhooks/webhook.worker.ts";

// In your cron/scheduler
async function webhookWorker() {
  const result = await processWebhookDeliveries({
    batchSize: 100,
    requestTimeoutMs: 10_000,
    concurrency: 5,
  });

  console.log(
    `Webhook delivery: ${result.successful} delivered, ${result.retriedForLater} queued for retry, ${result.failed} failed`,
  );
}

// Schedule to run every 30 seconds or via cron
setInterval(webhookWorker, 30_000);
```

### Handling Webhook Requests (Client-Side Example)

```typescript
// In your external system

/**
 * Verifies webhook signature with configurable timestamp tolerance.
 * Protects against replay attacks and tampering.
 *
 * @param signature X-Tekru-Signature header value
 * @param secret The webhook secret
 * @param body Raw request body (JSON string)
 * @param toleranceSeconds Maximum age of signature (default: 5 minutes)
 * @returns true if signature is valid and within tolerance
 */
export function verifyWebhookSignature(
  signature: string,
  secret: string,
  body: string,
  toleranceSeconds: number = 300,
): boolean {
  try {
    const parts = signature.split(",");
    let timestamp: string | null = null;
    let providedSignature: string | null = null;

    for (const part of parts) {
      const [key, value] = part.split("=");
      if (key === "t") timestamp = value || null;
      if (key === "v1") providedSignature = value || null;
    }

    if (!timestamp || !providedSignature) {
      return false;
    }

    // Check timestamp is within tolerance
    const signedTime = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - signedTime) > toleranceSeconds) {
      return false;
    }

    // Verify signature
    const signatureBase = `${timestamp}.${body}`;
    const expectedSignature = createHmac("sha256", secret)
      .update(signatureBase)
      .digest("hex");

    return expectedSignature === providedSignature;
  } catch {
    return false;
  }
}

app.post("/webhooks/elfatoora", (req, res) => {
  try {
    // Verify signature
    const signature = req.headers["x-tekru-signature"];
    const body = req.rawBody;
    const secret = process.env.WEBHOOK_SECRET;

    if (!verifyWebhookSignature(signature, secret, body, 300)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    // Parse payload
    const payload = JSON.parse(body);

    // Handle event
    switch (payload.type) {
      case "document.signed":
        await handleDocumentSigned(payload);
        break;
      case "document.completed":
        await handleDocumentCompleted(payload);
        break;
      // ...
    }

    // Acknowledge receipt
    res.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

## Monitoring

### Key Metrics

1. **Pending Deliveries** (should stabilize near zero)

   ```sql
   SELECT COUNT(*) FROM tbl_webhook_deliveries
   WHERE status = 'PENDING'
   ```

2. **Failed Deliveries** (check for issues)

   ```sql
   SELECT webhook_id, COUNT(*) as count, MAX(last_error) as recent_error
   FROM tbl_webhook_deliveries
   WHERE status = 'FAILED'
   GROUP BY webhook_id
   ```

3. **Retry Queue Growth** (indicates downstream issue)
   ```sql
   SELECT COUNT(*) FROM tbl_webhook_deliveries
   WHERE status = 'PENDING'
   AND next_retry_at IS NOT NULL
   AND next_retry_at <= now()
   ```

### Alerts to Set Up

- `pending_deliveries > 1000` → Worker may be overwhelmed
- `failed_deliveries_rate > 10%` → Endpoint configuration issue
- `worker_last_run > 5 minutes ago` → Worker may be stuck

## Testing

### Unit Tests

```bash
pnpm run test -- src/business-logic/webhooks/__tests__/webhook.helpers.test.ts
```

### Integration Testing

1. Create a test webhook endpoint
2. Emit document event
3. Verify delivery record created
4. Verify delivery worker processes it
5. Verify payload format and signature

## Troubleshooting

### Webhooks Not Delivering

1. **Check endpoint is active:**

   ```sql
   SELECT * FROM tbl_webhook_endpoints WHERE id = '...';
   ```

2. **Check deliveries are being created:**

   ```sql
   SELECT * FROM tbl_webhook_deliveries WHERE webhook_id = '...';
   ```

3. **Check worker is running:**
   - Verify cron job is executing
   - Check logs for worker errors

4. **Check endpoint URL is reachable:**
   - Verify HTTPS certificate is valid
   - Check firewall rules
   - Test with `curl -v https://endpoint-url`

### High Failure Rate

1. **Check endpoint is responding:**

   ```sql
   SELECT last_error FROM tbl_webhook_deliveries
   WHERE webhook_id = '...'
   ORDER BY updated_at DESC LIMIT 10;
   ```

2. **Common issues:**
   - Client rejecting signature (verify secret)
   - Client timeout too short (webhook payload is large)
   - Client code returning 500 error

3. **Temporarily disable endpoint:**
   ```sql
   UPDATE tbl_webhook_endpoints SET is_active = false WHERE id = '...';
   ```

## Security Considerations

1. **Secret Storage**: Keep `webhook_endpoints.secret` encrypted in environment/vault
2. **Rate Limiting**: Implement per-endpoint rate limits on delivery attempts
3. **Signature Verification**: Always verify signatures on both sides
4. **TLS/HTTPS**: Only support HTTPS for webhook URLs (not HTTP)
5. **Timestamp Validation**: Clients should verify timestamp tolerance
6. **Payload Size Limits**: Monitor and limit webhook payload sizes

## Future Enhancements

- [ ] Webhook event batching (group multiple events in one request)
- [ ] Selective field delivery (clients choose what data to receive)
- [ ] Dead letter queue for permanently failed deliveries
- [ ] Delivery analytics dashboard
