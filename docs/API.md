# API Documentation

ElfatOOra API provides endpoints for managing electronic invoices (TEIF format) for the Tunisian tax authority system.

## Base URL

```
http://localhost:3000/v1
```

## Authentication

All API endpoints require authentication via API key in the `Authorization` header:

```
Authorization: Bearer <API_KEY>
```

## Response Format

All responses are in JSON format.

### Success Response

```json
{
  "status": 200,
  "data": {}
}
```

### Error Response

```json
{
  "status": 400,
  "error": "ERROR_CODE",
  "message": "Error description"
}
```

---

## Endpoints

### 1. Submit Invoice Documents

**Endpoint:** `POST /documents`

Submit one or more invoices for signing and submission to the TTN (Tax Authority).

#### Request Body

```typescript
{
  "data": [
    {
      "invoice": DocumentSchema,
      "pdf": "base64-encoded-pdf-string"
    }
  ],
  "successUrl": "https://example.com/success",  // optional
  "failureUrl": "https://example.com/failure"   // optional
}
```

#### Request Example

```json
{
  "data": [
    {
      "invoice": {
        "header": {
          "documentNumber": "INV/2025/001",
          "documentDate": "2025-01-20",
          "documentType": "FA"
        },
        "seller": {
          "identifier": "1234567890",
          "name": "Your Company Name",
          "address": "123 Main Street",
          "city": "Tunis",
          "postalCode": "1000"
        },
        "buyer": {
          "identifier": "0987654321",
          "name": "Customer Name",
          "address": "456 Customer Street",
          "city": "Ariana",
          "postalCode": "2100"
        },
        "lines": [
          {
            "lineNumber": 1,
            "description": "Product/Service Description",
            "quantity": 1,
            "unitPrice": 100.0,
            "totalAmount": 100.0
          }
        ],
        "totals": {
          "totalExcludingTax": 100.0,
          "totalTax": 19.0,
          "totalIncludingTax": 119.0
        }
      },
      "pdf": "JVBERi0xLjQKJeLj..."
    }
  ],
  "successUrl": "https://example.com/success",
  "failureUrl": "https://example.com/failure"
}
```

#### Response

**Status Code:** `202 Accepted`

```json
{
  "message": "Invoice accepted for signing, please redirect user to sign.",
  "signatureUUID": "uuid-string",
  "signatureUrl": "https://ngsign.example.com/sign/uuid-string"
}
```

#### Status Codes

- `202 Accepted` - Invoice submitted successfully for signing
- `400 Bad Request` - Invalid request payload
- `403 Forbidden` - Invoice issuer tax ID does not match authenticated customer
- `500 Internal Server Error` - Server error

---

### 2. Document Signing Callback

**Endpoint:** `POST /documents/callback/:status`

Callback endpoint for ngSign after document signing completion. This endpoint is called automatically by ngSign service.

#### URL Parameters

- `status` (required): Either `success` or `failure`

#### Query Parameters

- `hash` (required): Base64-encoded operation ID

#### Request Body (for success callback)

Array of signed documents:

```typescript
[
  {
    invoiceNumber: "INV/2025/001",
    xmlBase64: "base64-encoded-signed-xml",
    pdfBase64: "base64-encoded-signed-pdf",
  },
];
```

#### Response

**Status Code:** `302 Found` (Redirect) or `200 OK`

Redirects to:

- `successUrl` on successful signing
- `failureUrl` on signing failure
- Default customer URLs if no callback URL was provided

```json
{
  "message": "Operation marked as successful/failed."
}
```

---

### 3. Get Document Status

**Endpoint:** `GET /documents/status/:invoiceNumber`

Retrieve the current processing status of an invoice document.

#### URL Parameters

- `invoiceNumber` (required): The invoice document number (e.g., "INV/2025/001")

#### Response

**Status Code:** `200 OK`

```json
{
  "invoiceNumber": "INV/2025/001",
  "status": "TTN_PENDING"
}
```

#### Document Status Values

| Status            | Description                        |
| ----------------- | ---------------------------------- |
| `RECEIVED`        | Document received and validated    |
| `SIGNING_PENDING` | Awaiting user signature via ngSign |
| `SIGNING_FAILED`  | Signing failed                     |
| `TTN_PENDING`     | Signed, awaiting TTN submission    |
| `TTN_SUBMITTED`   | Submitted to Tax Authority         |
| `TTN_ACCEPTED`    | Accepted by Tax Authority          |
| `TTN_REJECTED`    | Rejected by Tax Authority          |
| `COMPLETED`       | Successfully processed             |
| `FAILED`          | Processing failed                  |
| `CANCELLED`       | Processing cancelled               |

#### Status Codes

- `200 OK` - Status retrieved successfully
- `404 Not Found` - Invoice not found
- `500 Internal Server Error` - Server error

---

### 4. Get Document Artifacts

**Endpoint:** `GET /documents/artifacts/:invoiceNumber`

Retrieve the signed XML artifacts and metadata for a processed invoice document.

#### URL Parameters

- `invoiceNumber` (required): The invoice document number (e.g., "INV/2025/001")

#### Response

**Status Code:** `200 OK`

```json
{
  "invoiceNumber": "INV/2025/001",
  "artifacts": [
    {
      "status": "TTN_ACCEPTED",
      "teif_xml": "<?xml version=\"1.0\"?>...",
      "xml_hash": "abc123def456...",
      "ttn_reference": "2025123456789",
      "qr_code_base64": "iVBORw0KGgoAAAANSUhEUg..."
    }
  ]
}
```

#### Response Fields

- `invoiceNumber` - The invoice document number
- `artifacts` - Array of document artifacts
  - `status` - Current document status
  - `teif_xml` - The signed TEIF XML content
  - `xml_hash` - Hash of the XML for verification
  - `ttn_reference` - Tax Authority reference number (if submitted)
  - `qr_code_base64` - QR code image in base64 format (if generated)

#### Status Codes

- `200 OK` - Artifacts retrieved successfully
- `404 Not Found` - Invoice or artifacts not found
- `500 Internal Server Error` - Server error

---

## Document Schema

The invoice document follows this schema:

```typescript
{
  // Header
  header: {
    documentNumber: string,              // Unique invoice number
    documentDate: string,                // ISO 8601 date format
    documentType: string,                // Document type code (e.g., FA)
    currencyCode?: string,               // ISO 4217 currency code (default: TND)
  },

  // Seller (Issuer)
  seller: {
    identifier: string,                  // Tax ID or registration number
    name: string,                        // Business name
    address: string,                     // Street address
    city: string,                        // City
    postalCode: string,                  // Postal code
    country?: string,                    // Country code (default: TN)
  },

  // Buyer (Customer)
  buyer: {
    identifier: string,                  // Tax ID or registration number
    name: string,                        // Business/Person name
    address: string,                     // Street address
    city: string,                        // City
    postalCode: string,                  // Postal code
    country?: string,                    // Country code
    type?: string,                       // Customer type (B2B, B2C, etc)
  },

  // Line Items
  lines: [
    {
      lineNumber: number,                // Sequential line number
      description: string,               // Product/service description
      quantity: number,                  // Item quantity
      unitPrice: number,                 // Price per unit
      taxRate?: number,                  // Tax percentage (e.g., 19)
      totalAmount: number,               // Line total before tax
      notes?: string,                    // Optional line notes
    }
  ],

  // Totals
  totals: {
    totalExcludingTax: number,           // Sum of all line items
    totalTax: number,                    // Total tax amount
    totalIncludingTax: number,           // Total including tax
    discountAmount?: number,             // Optional discount
    advancePayment?: number,             // Optional advance payment
  },

  // Optional metadata
  notes?: string,                        // Invoice notes
  dueDate?: string,                      // Payment due date
  paymentTerms?: string,                 // Payment terms description
}
```

---

## Error Codes

| Error Code               | Description                                     | HTTP Status |
| ------------------------ | ----------------------------------------------- | ----------- |
| `INVALID_PAYLOAD`        | Request payload validation failed               | 400         |
| `INVALID_INVOICE_DATA`   | Invoice data does not meet requirements         | 400         |
| `MISSING_REQUIRED_FIELD` | Required field is missing                       | 400         |
| `INVALID_TAX_ID`         | Tax ID format is invalid                        | 400         |
| `TAX_ID_MISMATCH`        | Seller tax ID does not match authenticated user | 403         |
| `DOCUMENT_NOT_FOUND`     | Requested document not found                    | 404         |
| `OPERATION_NOT_FOUND`    | Operation not found                             | 404         |
| `SIGNING_FAILED`         | Document signing failed                         | 500         |
| `TTN_SUBMISSION_FAILED`  | Failed to submit to Tax Authority               | 500         |
| `DATABASE_ERROR`         | Database operation failed                       | 500         |
| `INTERNAL_SERVER_ERROR`  | Unexpected server error                         | 500         |

---

## Rate Limiting

Rate limiting may be implemented per customer API key:

- **Requests per minute:** 100
- **Requests per hour:** 5000

Exceeding limits returns `429 Too Many Requests`.

---

## Workflow Example

### 1. Submit Invoices for Signing

```bash
curl -X POST http://localhost:3000/v1/documents \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d @invoice_request.json
```

Response:

```json
{
  "message": "Invoice accepted for signing, please redirect user to sign.",
  "signatureUUID": "123e4567-e89b-12d3-a456-426614174000",
  "signatureUrl": "https://ngsign.example.com/sign/123e4567-e89b-12d3-a456-426614174000"
}
```

### 2. Redirect User to ngSign

Direct the user to `signatureUrl` where they sign the document.

### 3. ngSign Redirects Back

User is redirected to either:

- `successUrl` if signing was successful
- `failureUrl` if signing failed

### 4. Check Document Status

```bash
curl -X GET http://localhost:3000/v1/documents/status/INV/2025/001 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Response:

```json
{
  "invoiceNumber": "INV/2025/001",
  "status": "TTN_SUBMITTED"
}
```

---

## Callback URLs

### Success Callback

When a document is successfully signed and processed:

```
POST {successUrl}?operation_id={operationId}&status=completed
```

### Failure Callback

When document processing fails:

```
POST {failureUrl}?operation_id={operationId}&status=failed&reason={errorReason}
```

---

## Best Practices

1. **Always validate responses** - Check the HTTP status code before processing response data
2. **Use exponential backoff** - Retry failed requests with increasing delays
3. **Store operation IDs** - Track `signatureUUID` to correlate with callbacks
4. **Validate signatures** - Verify document signatures before processing
5. **Handle redirects** - Ensure your callback URLs accept HTTP redirects
6. **Log transactions** - Maintain audit logs of all submissions and status changes
7. **Use HTTPS** - Always use HTTPS for production environments

---

## Support

For API issues or questions, please contact the development team or refer to the main [README.md](../README.md).
