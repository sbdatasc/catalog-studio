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
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml     # pnpm workspace
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **Build lib/db first** — run `pnpm --filter @workspace/db run build` when schema files change

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes in `src/routes/`, services in `src/services/`.

- Entry: `src/index.ts` — reads `PORT`, calls `openDatabase()`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON parsing, routes at `/api`
- **DB connection**: `src/db/connection.ts` — lazy singleton `getDb()`, `openDatabase()`, `closeDatabase()`
- **Migrations**: `src/db/migrate.ts` — forward-only runner; `src/db/migrations/001_initial.ts` — all tables + tracking table
- **Seed**: `src/db/seed.ts` — creates 1 "Demo Catalog" (Draft) with 5 default system templates; idempotent

#### Services

- `catalogService.ts` — CRUD for catalogs + status transitions + duplicate
- `templateService.ts` — CRUD for templates, sections, attributes, relationships, schema publishing
- `entryService.ts` — CRUD for catalog entries with EAV coercion, plus link/unlink
- `coercionService.ts` — `toStorageString`, `fromStorageString`, `validateAttributeValue` for all 8 attribute types

#### API Routes

**Catalogs:**
- `GET /api/catalogs` — list all catalogs (with templateCount)
- `POST /api/catalogs` — create catalog (status: draft)
- `GET /api/catalogs/:id` — get catalog
- `PATCH /api/catalogs/:id` — update name/description
- `POST /api/catalogs/:id/transition` — transition status (draft→pilot→published→discontinued)
- `POST /api/catalogs/:id/duplicate` — duplicate catalog + all templates into a new Draft

**Schema Templates:**
- `GET /api/schema/templates?catalogId=:id&isReferenceData=true|false` — list templates (catalogId required)
- `POST /api/schema/templates` — create template (body: `{ catalogId, name, description, isReferenceData }`)
- `GET/PATCH/DELETE /api/schema/templates/:id` — get/update/delete template
- `GET/POST /api/schema/templates/:id/sections` — list/create sections
- `PUT /api/schema/templates/:id/sections/reorder` — reorder sections
- `POST /api/schema/templates/publish` — publish schema snapshot (body: `{ catalogId }`)
- `GET /api/schema/templates/current-version` — get current published schema
- `GET/POST /api/schema/templates/relationships` — list/create relationships
- `DELETE /api/schema/templates/relationships/:id` — delete relationship

**Schema Sections & Attributes:**
- `PATCH/DELETE /api/schema/sections/:id` — update/delete section
- `GET/POST /api/schema/sections/:id/attributes` — list/create attributes
- `PUT /api/schema/sections/:id/attributes/reorder` — reorder attributes
- `PATCH/DELETE /api/schema/attributes/:id` — update/delete attribute

- **Helpers**: `src/lib/response.ts` (`sendSuccess`/`sendError`), `src/lib/errors.ts` (`ServiceError`), `src/lib/utils.ts` (`toSlug`)

### `artifacts/studio` (`@workspace/studio`)

React + Vite frontend. Served at previewPath `/` on port 18425.

- **Entry**: `src/main.tsx` → `src/App.tsx`
- **API client**: `src/lib/apiClient.ts` — custom fetch wrapper; `Catalog`, `CatalogTemplate` types; `apiClient.catalogs.*` and `apiClient.schema.*` namespaces

#### Routes

- `/` → redirects to `/catalogs`
- `/catalogs` → `CatalogsPage`
- `/catalogs/:catalogId/designer/templates` → `DesignerPage` (Templates tab)
- `/catalogs/:catalogId/designer/reference-data` → `DesignerPage` (Reference Data tab)

#### State Management (Zustand)

- `catalogStore.ts` — `catalogs[]`, `catalogsLoading`, `catalogsError`, `fetchCatalogs`, `addCatalog`, `updateCatalog`, `removeCatalog`
- `schemaStore.ts` — `templates[]` (regular), `referenceDataTemplates[]`, `fetchTemplates(catalogId)`, `fetchReferenceDataTemplates(catalogId)`, add/update/remove helpers for both lists
- `uiStore.ts` — drawer state (`drawerMode`, `drawerTemplateId`, `drawerIsDirty`, `drawerIsReferenceData`), `activeCatalogId`, `activeCatalogStatus`, delete modal state; provides `openCreateDrawer({ isReferenceData })`, `requestCloseDrawer()`, `closeDrawer()`

#### Pages & Components

- `CatalogsPage.tsx` — catalog grid with CatalogCard, CatalogDrawer (create/edit), TransitionConfirmModal
- `DesignerPage.tsx` — extracts catalogId from URL params, sets activeCatalog in uiStore, renders tab content
- `DesignerNav.tsx` — nav bar with "← Catalogs" back link, Templates/Reference Data/Publish tabs (catalog-aware URLs)
- `EntityTypeManager.tsx` — Templates tab content; fetches `templates` via `fetchTemplates(catalogId)`
- `ReferenceDataTemplatesManager.tsx` — Reference Data tab content; fetches `referenceDataTemplates` via `fetchReferenceDataTemplates(catalogId)`
- `EntityTypeGrid.tsx` — responsive card grid (props: templates, loading, error, onRetry, emptyMessage)
- `EntityTypeCard.tsx` — template card; shows "System" grey badge for `isSystemSeed`, "Reference Data" amber badge for `isReferenceData`
- `EntityTypeForm.tsx` — `EntityTypeDrawer` (combined form + drawer for create/edit; reads `activeCatalogId` and `drawerIsReferenceData` from uiStore)
- `DeleteConfirmModal.tsx` — handles deletion from both templates and referenceDataTemplates lists
- `UnsavedChangesGuard.tsx` — modal triggered by `uiStore.guardAction`

### `lib/db` (`@workspace/db`)

Schema definitions and shared types. **Does NOT create a DB connection.**

- `src/schema/` — 9 Drizzle table definitions (v2):
  - `catalogs.ts` — catalog table (`id`, `name`, `description`, `status`, timestamps); `CatalogStatus` type
  - `schemaTemplates.ts` — templates scoped to a catalog (`catalog_id` FK, `is_reference_data` flag, unique per catalog+name and catalog+slug)
  - `schemaSections.ts` — sections within a template
  - `schemaAttributes.ts` — attributes within a section
  - `schemaRelationships.ts` — template-to-template relationships
  - `schemaVersions.ts` — published schema snapshots
  - `catalogEntries.ts` — EAV catalog entries (`catalog_id` FK, `template_id` FK)
  - `catalogFieldValues.ts` — EAV attribute values stored as TEXT
  - `catalogEntryRelationships.ts` — entry-to-entry links
- `src/types.ts` — `AttributeType` enum, `AttributeConfigSchema` (Zod), `SchemaSnapshot` (includes `catalogId`, `catalogName`, `isReferenceData` per template), `SnapshotTemplate`, `SnapshotSection`, `SnapshotAttribute`
- `drizzle.config.ts` — requires `DATABASE_URL` (auto-provided by Replit)
- `pnpm --filter @workspace/db run push-force` — syncs schema to DB (for development)
- `pnpm --filter @workspace/db run build` — compiles declaration files

## API Contract

All API responses use a typed envelope:
```typescript
{ data: T | null, error: AppError | null }
```

Use `sendSuccess` and `sendError` from `artifacts/api-server/src/lib/response.ts`. Services throw `new ServiceError(code, message)`.

**Error codes**: `NOT_FOUND`, `CONFLICT`, `VALIDATION_ERROR`, `TEMPLATE_IN_USE`, `SECTION_IN_USE`, `CATALOG_LOCKED`, `CATALOG_INVALID_TRANSITION`, `BAD_REQUEST`, `INTERNAL_ERROR`

## Database Architecture (v2 — Catalog Layer)

### Schema Hierarchy

**Catalog** → Template → Section → Attribute

All templates are scoped to a Catalog. All catalog entries are scoped to a Catalog.

### Key Rules

1. **DB singleton**: Only `artifacts/api-server/src/db/connection.ts` creates the Pool. Services call `getDb()`.
2. **Catalog status flow**: `draft → pilot → published → discontinued`. All schema mutations check `catalog.status === 'draft'` and throw `CATALOG_LOCKED` otherwise.
3. **Reference Data templates**: Templates with `is_reference_data=true` define controlled vocabularies. Created via `POST /api/schema/templates` with `isReferenceData: true`. Attributes of type `reference_data` point to these templates via `config.targetTemplateId`.
4. **Attribute type rule**: `updateAttribute()` throws `VALIDATION_ERROR` if `attributeType` is changed after creation.
5. **EAV pattern**: All attribute values stored as TEXT in `catalog_field_values.value_text`. Coercion at read time via `coercionService`.
6. **Seed rule**: Templates with `is_system_seed=true` cannot be deleted and their names are readonly in the UI.
7. **Duplicate catalog**: `duplicateCatalog()` creates a new Draft catalog and deep-copies all templates (sections + attributes) into it.
8. **Unique constraints**: Template names/slugs are unique per catalog (`UNIQUE(catalog_id, name)`), not globally.

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script.
