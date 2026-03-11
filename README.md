# Elfatoora API

A middleware API for TEIF (Tunisian Electronic Invoicing Format) electronic invoicing. This service provides JSON validation, TEIF XML generation, digital signing via ngsign, TTN (Tax Authority) submission, status polling, signature verification, and webhook integration for third-party invoicing systems.

## Overview

Elfatoora API acts as a bridge between third-party invoicing systems and Tunisia's electronic invoicing infrastructure. It handles the complete lifecycle of electronic invoices from validation through submission and tracking.

### Key Features

- **JSON Schema Validation**: Validates invoice documents against predefined schemas
- **TEIF XML Generation**: Converts validated JSON invoices to TEIF XML format
- **Digital Signing**: Integration with ngsign for cryptographic signing of documents
- **TTN Submission**: Submits signed invoices to the Tunisian Tax Authority (TTN) via web services or SFTP
- **SFTP Support**: Secure file transfer for invoice uploads and downloads from TTN
- **Status Polling**: Background jobs for tracking invoice processing status
- **Signature Verification**: Validates digital signatures on submitted documents
- **Webhook Support**: Notifies third-party systems of invoice processing results

## Tech Stack

- **Runtime**: Node.js 24+
- **Language**: TypeScript
- **Package Manager**: pnpm 10.28.0
- **Framework**: Express.js 5.2.1
- **Database**: PostgreSQL with Kysely ORM
- **Validation**: Zod
- **Scheduling**: node-cron
- **XML Processing**: fast-xml-parser

## Project Structure

```
src/
├── index.ts                      # Entry point
├── business-logic/               # Core business logic
│   ├── auth/                     # Authentication & token management
│   ├── document/                 # Document calculations and processing
│   ├── ngsign/                   # Digital signing integration
│   ├── teif/                     # TEIF XML generation and type definitions
│   └── ttn/                      # TTN integration
│       ├── ws/                   # Web service submission
│       ├── sftp/                 # SFTP file transfer for TTN
│       └── ...workers            # Background workers
├── controllers/                  # Request handlers
├── cron/                         # Scheduled jobs
├── db/                           # Database client, migrations, and schema
├── routes/                       # API route definitions
├── schemas/                      # Zod validation schemas
└── utils/                        # Utility functions

tests/                           # Test files (co-located with source)
docs/                            # Documentation and WSDL files
```

## Prerequisites

- Node.js 24.0.0 or higher
- pnpm 10.28.0 or higher
- PostgreSQL database
- Access to TTN web services (for production)
- ngsign credentials for document signing

## Installation

### 1. Clone and Setup

```bash
git clone git@gitlab.tekru.net:tekru/elfatoora-api.git
cd elfatoora-api
pnpm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/e_fatoura

# Public URLs
PUBLIC_BASE_URL=http://localhost:3000
```

### 3. Database Setup

Run migrations to set up the database schema:

```bash
pnpm run db:migrate
```

## Usage

### Development

Start the development server with hot reload:

```bash
pnpm run dev
```

The server will start on http://localhost:3000

### Production Build

```bash
pnpm run build
pnpm run start
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

### Code Quality

```bash
# Lint code
pnpm run lint

# Fix linting issues
pnpm run lint:fix
```

## API Endpoints

### Documents Controller

- `POST /v1/documents` - Submit a new invoice document for signing
- `POST /v1/documents/callback/:status` - Callback endpoint for ngSign (success/failure)
  See [docs/API.md](docs/API.md) for detailed endpoint specifications.

### TTN Integration

The application supports multiple TTN submission methods:

- **Web Services**: SOAP-based submission to TTN servers
- **SFTP**: Secure file transfer for invoice uploads and downloads

See [src/business-logic/ttn/sftp/README.md](src/business-logic/ttn/sftp/README.md) for SFTP configuration and usage.

## Database Migrations

Migrations are located in `src/db/migrations/`:

1. `001_init_invoice_middleware.ts` - Initial schema setup
2. `002_add_ttn_reference.ts` - Add TTN reference tracking
3. `003_add_qr_code_base64.ts` - Add QR code support
4. `004_webhooks.ts` - Webhook endpoints and deliveries (outbox pattern)

## Scheduled Jobs

The application includes cron jobs for:

- **TTN Submission**: Submits pending documents to TTN every 5 minutes
- **TTN Document Consultation**: Polls TTN for document status updates every 10 minutes
- **Webhook Worker**: Processes pending webhook deliveries every minute

Configure cron schedules in [src/cron/index.ts](src/cron/index.ts).

## Development Workflow

### Adding New Features

1. Create business logic in appropriate `src/business-logic/` subdirectory
2. Add validation schemas in `src/schemas/`
3. Implement controllers in `src/controllers/`
4. Define routes in `src/routes/`
5. Add comprehensive tests alongside implementation
6. Update documentation

### Testing

Tests are co-located with source files using the `__tests__/` directory pattern:

```
src/
├── business-logic/
│   ├── document/
│   │   ├── calculations.ts
│   │   └── __tests__/
│   │       └── calculations.test.ts
```

## Configuration

### Environment Variables

All configuration is managed through environment variables. Key variables:

- `NODE_ENV`: Application environment (development/production)
- `PORT`: Server port (default: 3000)
- `DB_*`: Database connection parameters

## Performance

- Database queries use Kysely for type-safe SQL generation
- XML processing uses fast-xml-parser for efficiency
- Background jobs use node-cron for scheduled operations
- Webhook retries with exponential backoff

## Security

- Environment variables for sensitive credentials
- Zod schema validation for all inputs
- Digital signature verification for document authenticity
- HTTPS/TLS for external service communication

## Troubleshooting

### Database Connection Issues

```bash
# Check database connectivity
pnpm run db:migrate
```

### TTN Service Errors

Check `docs/ttn/ttn-ws-docs.md` for service-specific documentation and error codes.

### Build Issues

```bash
# Clean build artifacts
pnpm run clean

# Rebuild
pnpm run build
```

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Write tests for new features
2. Ensure all tests pass: `pnpm test`
3. Run linter: `pnpm run lint`
4. Follow TypeScript best practices
5. Update README for significant changes

## Authors

- **Tekru** - Core development and architecture
- **NGSign** - Digital signing integration and cryptographic services

## License

This project is open source and available under the Apache License Version 2.0. See LICENSE file for details.

## Support

For issues or questions, contact the development team.

---

**Last Updated**: 21/01/2026
