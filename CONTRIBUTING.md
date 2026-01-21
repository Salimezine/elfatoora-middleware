# Contributing to Elfatoora API

Thank you for your interest in contributing to Elfatoora API! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. Please be respectful, constructive, and professional in all interactions.

## Getting Started

### Prerequisites

- **Node.js**: Version 24 or higher
- **pnpm**: Version 10.28.0 or higher
- **PostgreSQL**: For database development
- **Git**: For version control

### Local Development Setup

1. **Clone the repository**

   ```bash
   git clone git@gitlab.tekru.net:tekru/elfatoora-api.git
   cd elfatoora-api
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the project root with the following variables:

   ```env
   # Database Configuration
   DATABASE_URL=postgresql://user:password@localhost:5432/elfatoora_dev

   # API Configuration
   PORT=3000
   NODE_ENV=development
   ```

4. **Initialize the database**

   ```bash
   pnpm db:migrate
   ```

5. **Start the development server**

   ```bash
   pnpm dev
   ```

   The API will be available at `http://localhost:3000`

## Development Workflow

### Available Commands

```bash
# Development
pnpm dev              # Start dev server with hot reload
pnpm build            # Compile TypeScript to JavaScript
pnpm start            # Run production build

# Testing
pnpm test             # Run all tests
pnpm test:watch       # Run tests in watch mode

# Code Quality
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix ESLint issues

# Database
pnpm db:migrate       # Run pending database migrations

# Cleanup
pnpm clean            # Remove build artifacts
```

### Project Structure

```
src/
├── index.ts                   # Application entry point
├── business-logic/            # Core business logic
│   ├── auth/                  # Authentication & token management
│   ├── document/              # Document calculations and processing
│   ├── ngsign/                # Digital signing integration
│   ├── teif/                  # TEIF XML generation
│   ├── ttn/                   # TTN web service integration
│   └── webhooks/              # Webhook handling
├── controllers/               # Express request handlers
├── cron/                      # Scheduled background jobs
├── db/                        # Database setup and migrations
├── routes/                    # API route definitions
├── schemas/                   # Zod validation schemas
└── utils/                     # Utility functions
```

## Testing

We use **tsx** with Node.js built-in test runner. All new features must include tests.

### Writing Tests

- Test files are co-located with source code: `src/module/__tests__/module.test.ts`
- Use descriptive test names
- Each test should be focused and independent
- Mock external dependencies (TTN, ngsign, database)

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests for a specific file
pnpm test src/business-logic/auth/__tests__/token.test.ts
```

### Test Coverage

Aim for high test coverage, especially for:

- Business logic and calculations
- Schema validation
- Document transformations
- Error handling

## Code Style & Quality

### TypeScript

- Use strict TypeScript (`strict: true` in tsconfig.json)
- Avoid `any` types; use proper typing
- Export types alongside implementations
- Add JSDoc comments for public APIs

### Formatting

Code is automatically formatted using **Prettier**. Format before committing:

```bash
# ESLint will handle this, but you can manually format:
pnpm lint:fix
```

### Linting

We use **ESLint** to maintain code quality. Run before submitting changes:

```bash
pnpm lint
```

Fix issues with:

```bash
pnpm lint:fix
```

### Naming Conventions

- **Files**: Use kebab-case (e.g., `create-transaction.ts`)
- **Functions/Variables**: Use camelCase
- **Classes**: Use PascalCase
- **Constants**: Use UPPER_SNAKE_CASE
- **Zod Schemas**: Suffix with `.schema.ts`
- **Types**: Suffix with `.d.ts` or use `.ts` with `export type`

## Commit Messages

Follow conventional commit format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons)
- `refactor`: Code refactoring without feature changes
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, etc.

### Examples

```
feat(auth): add JWT token refresh mechanism

fix(ttn): handle timeout errors in submission

docs(api): update webhook documentation

test(document): add validation edge cases
```

## Database Migrations

When making database schema changes:

1. Create a new migration file in `src/db/migrations/`
2. Follow the naming convention: `NNN_description.ts` (e.g., `005_add_status_column.ts`)
3. Use Kysely for type-safe migrations
4. Update `src/db/schema.ts` to reflect schema changes
5. Document the migration in your pull request

```typescript
// Example migration
import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("new_table")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("new_table").execute();
}
```

## Pull Request Process

1. **Create a feature branch** from `main`

   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes** with clear, focused commits

3. **Write or update tests** for your changes

4. **Run the full test suite**

   ```bash
   pnpm test
   ```

5. **Ensure code quality**

   ```bash
   pnpm lint
   pnpm lint:fix
   ```

6. **Push your branch**

   ```bash
   git push origin feat/your-feature-name
   ```

7. **Open a Pull Request** with:
   - Clear title and description
   - Reference to related issues
   - Explanation of changes and rationale
   - Any testing notes or breaking changes

### Pull Request Checklist

- [ ] Tests added/updated for new functionality
- [ ] All tests pass (`pnpm test`)
- [ ] Code follows style guidelines (`pnpm lint`)
- [ ] TypeScript compiles without errors (`pnpm build`)
- [ ] Documentation updated if needed
- [ ] Commit messages follow conventional format
- [ ] No unnecessary dependencies added

## Reporting Issues

When reporting bugs or suggesting features:

### Bug Reports

Include:

- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node version, OS)
- Relevant error logs or stack traces

### Feature Requests

Include:

- Clear use case and motivation
- Proposed solution or approach
- Examples or mockups if applicable
- Potential alternatives considered

## API Documentation

- Main API documentation: [docs/API.md](docs/API.md)
- Webhook documentation: [docs/WEBHOOKS.md](docs/WEBHOOKS.md)
- TTN service documentation: [docs/ttn/ttn-ws-docs.md](docs/ttn/ttn-ws-docs.md)

When adding new endpoints, update the relevant documentation files.

## Debugging

### Debug Mode

Use the `DEBUG` environment variable:

```bash
DEBUG=* pnpm dev
```

### VS Code Debugging

Add this to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Launch Program",
  "program": "${workspaceFolder}/node_modules/tsx/cjs/index.js",
  "args": ["watch", "src/index.ts"],
  "restart": true,
  "console": "integratedTerminal"
}
```

## License

By contributing to this project, you agree that your contributions will be licensed under its Apache License 2.0.

## Questions?

Feel free to open an issue with your question or reach out through the project's communication channels.

Thank you for contributing! 🎉
