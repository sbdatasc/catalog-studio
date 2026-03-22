# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── studio/             # React + Vite frontend (Data Catalog Studio)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema definitions + shared types (no DB connection)
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.
- **Build lib/db first** — run `pnpm --filter @workspace/db run build` when schema files change, before running typecheck in api-server.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for schema definitions.

- Entry: `src/index.ts` — reads `PORT`, calls `openDatabase()`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /healthz` (full path: `/api/healthz`)
- **DB connection**: `src/db/connection.ts` — lazy singleton `getDb()`, `openDatabase()`, `closeDatabase()`
- **Migrations**: `src/db/migrate.ts` — forward-only runner; `src/db/migrations/001_initial.ts` — all tables + tracking table
- **Seed**: `src/db/seed.ts` — 5 default templates (Data Asset, Pipeline, Glossary Term, Person/Team, System/Source) each with a "General" section and attributes; idempotent
- **Services**: `src/services/` — business logic layer:
  - `coercionService.ts` — `toStorageString`, `fromStorageString`, `validateAttributeValue` for all 8 attribute types (including `reference_data`)
  - `templateService.ts` — full CRUD for templates, sections, attributes, relationships, and schema publishing (`publishSchema`, `getCurrentPublishedSchema`)
  - `referenceDataService.ts` — CRUD for reference datasets and their values
  - `entryService.ts` — 8 functions for CRUD on catalog entries with EAV coercion, plus link/unlink
- **API routes**:
  - `GET/POST /api/schema/templates` — list + create templates
  - `PATCH/DELETE /api/schema/templates/:id` — update/delete template
  - `GET/POST /api/schema/templates/:id/sections` — list/create sections
  - `PUT /api/schema/templates/:id/sections/reorder` — reorder sections
  - `POST /api/schema/templates/publish` — publish current schema as a version
  - `GET /api/schema/templates/current-version` — get current published schema
  - `GET/POST /api/schema/templates/relationships` — list/create schema relationships
  - `DELETE /api/schema/templates/relationships/:id` — delete relationship
  - `PATCH/DELETE /api/schema/sections/:id` — update/delete section
  - `GET/POST /api/schema/sections/:id/attributes` — list/create attributes
  - `PUT /api/schema/sections/:id/attributes/reorder` — reorder attributes
  - `PATCH/DELETE /api/schema/attributes/:id` — update/delete attribute
  - `GET/POST /api/reference-data` — list/create reference datasets
  - `GET/PATCH/DELETE /api/reference-data/:id` — get/update/delete dataset
  - `GET/POST /api/reference-data/:id/values` — list/create values
  - `PUT /api/reference-data/:id/values/reorder` — reorder values
  - `PATCH/DELETE /api/reference-data/values/:id` — update/delete value
- **Helpers**: `src/lib/response.ts` (`sendSuccess`/`sendError`), `src/lib/errors.ts` (`ServiceError`), `src/lib/utils.ts` (`toSlug`)
- Depends on: `@workspace/db`, `@workspace/api-zod`, `pg`, `drizzle-orm`

### `artifacts/studio` (`@workspace/studio`)

React + Vite frontend for the Data Catalog Studio. Served at previewPath `/` on port 18425.

- **Entry**: `src/main.tsx` → `src/App.tsx`
- **API client**: `src/lib/apiClient.ts` — custom fetch wrapper (no generated hooks); `CatalogTemplate` type; `apiClient.schema.*` namespace for template CRUD
- **State management** (Zustand):
  - `src/stores/schemaStore.ts` — `templates[]`, `templatesLoading`, `templatesError`, `fetchTemplates`, `addTemplate`, `updateTemplate`, `removeTemplate`. Store mutations happen ONLY after successful API responses (never optimistic).
  - `src/stores/uiStore.ts` — `drawerMode` (closed/create/edit), `drawerTemplateId`, `drawerIsDirty`, `guardAction`, `deleteModalTemplateId`; provides `requestCloseDrawer()` (dirty-aware), `closeDrawer()` (force), `confirmDiscard()`, `cancelDiscard()`
- **Pages**: `src/pages/DesignerPage.tsx` — single-page Designer Mode view
- **Components**:
  - `DrawerShell.tsx` — shadcn Sheet wrapper with ESC + backdrop guard
  - `EntityTypeForm.tsx` — exports `EntityTypeDrawer` (combined form + drawer logic for create/edit templates)
  - `EntityTypeCard.tsx` — card displaying template with hover-reveal edit/delete icons, System badge for seeds; shows sectionCount and attributeCount
  - `EntityTypeGrid.tsx` — loading skeletons, error/empty states, responsive card grid
  - `EntityTypeManager.tsx` — page-level container, fetches templates on mount
  - `DeleteConfirmModal.tsx` — handles `TEMPLATE_IN_USE` and `NOT_FOUND` error states
  - `UnsavedChangesGuard.tsx` — modal triggered by `uiStore.guardAction`
  - `DesignerNav.tsx` — top navigation bar with "Templates" and "Publish" tabs

### `lib/db` (`@workspace/db`)

Schema definitions and shared types for Drizzle ORM. **Does NOT create a database connection** — the api-server's `connection.ts` is the single source of truth for the pool.

- `src/index.ts` — barrel re-export of schema + types (no pool, no drizzle instance)
- `src/schema/` — 10 Drizzle table definitions (PRD-02 Amendment v1.0):
  - `schemaTemplates.ts` — template definitions (was `schemaEntityTypes.ts`)
  - `schemaSections.ts` — sections within a template (NEW)
  - `schemaAttributes.ts` — attributes within a section (was `schemaFields.ts`)
  - `schemaRelationships.ts` — template-to-template relationships
  - `schemaVersions.ts` — published schema snapshots
  - `referenceDatasets.ts` — controlled vocabulary datasets (NEW)
  - `referenceValues.ts` — values within a reference dataset (NEW)
  - `catalogEntries.ts` — EAV catalog entries (templateId, templateSlug)
  - `catalogFieldValues.ts` — EAV attribute values stored as TEXT (attributeId)
  - `catalogEntryRelationships.ts` — entry-to-entry links
- `src/types.ts` — `AttributeType` enum (string, text, number, boolean, date, enum, reference, reference_data), `AttributeConfigSchema` (Zod), `SchemaSnapshot` (templates + referenceDatasetsSnapshot), `SnapshotTemplate`, `SnapshotSection`, `SnapshotAttribute`
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- `pnpm --filter @workspace/db run build` — compiles declaration files (required before api-server typecheck)

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec. Used by `api-server` for response validation. Also exports the TypeScript types generated by Orval (e.g. `AppErrorCode`, `AppError`, `HealthStatus`).

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`). Also exports `ApiError`, `ResponseParseError`, and the shared schema types (`AppErrorCode`, `AppError`, etc.) so frontend code can import everything from one place.

## API Contract (PRD-01)

All API responses use a typed envelope:

```typescript
{ data: T | null, error: AppError | null, meta?: ApiResponseMeta | null }
```

**AppErrorCode** — defined in `lib/api-spec/openapi.yaml` and generated into both `@workspace/api-zod` and `@workspace/api-client-react`:
- `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `UNPROCESSABLE`, `INTERNAL_ERROR`, `VALIDATION_ERROR`
- `TEMPLATE_IN_USE` — template has catalog entries, cannot delete
- `SECTION_IN_USE` — section has attributes, cannot delete
- `REFERENCE_DATA_IN_USE` — reference dataset referenced by an attribute, cannot delete

**Server helpers** — use `sendSuccess` and `sendError` from `artifacts/api-server/src/lib/response.ts` in all route handlers. Never construct the envelope manually in a route.

```typescript
import { sendSuccess, sendError } from "../lib/response";

// Success:
sendSuccess(res, data);

// Error:
sendError(res, 404, "NOT_FOUND", "Resource not found");
```

**ServiceError** — services throw `new ServiceError(code, message)` from `src/lib/errors.ts`. Route handlers catch it and call `sendError`.

## Database Architecture (PRD-02 Amendment v1.0)

### Schema Hierarchy

Template → Section → Attribute (three-level hierarchy; all attributes must belong to a section)

### Rules

1. **DB singleton**: Only `artifacts/api-server/src/db/connection.ts` creates the Pool. All services call `getDb()` — never pass db as a parameter, never instantiate Drizzle outside this file.
2. **Migration rule**: NEVER edit `001_initial.ts` once applied. New structural changes require `002_*.ts`.
3. **Attribute type rule**: `updateAttribute()` throws `VALIDATION_ERROR` if `attributeType` is changed after creation.
4. **EAV pattern**: All attribute values stored as TEXT in `catalog_field_values.value_text`. Coercion to correct JS types done at read time via `coercionService`.
5. **Seed rule**: Templates with `is_system_seed = true` cannot be deleted. `deleteTemplate()` throws `VALIDATION_ERROR` for these. Their names are also readonly in the UI.
6. **entryService schema rule**: `entryService` reads template definitions ONLY from the `schema_versions` snapshot (via `getCurrentPublishedSchema()`), never directly from raw schema tables.
7. **Schema publish**: `templateService.publishSchema()` builds a full `SchemaSnapshot` JSON (including `referenceDatasetsSnapshot`), increments `version_number`, sets `is_current=false` on previous, wraps in a transaction.
8. **reference_data attributes**: Must include `config.referenceDatasetId` (UUID). The referenced dataset must exist. Deletion of datasets blocked if any attribute references them (`REFERENCE_DATA_IN_USE`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
