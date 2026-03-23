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
- `/catalogs/:catalogId/designer/templates/:templateId` → `TemplateDetailPage` (D-02 Section & Attribute Builder)
- `/catalogs/:catalogId/designer/reference-data/:templateId` → `TemplateDetailPage` (Reference Data context)

#### State Management (Zustand)

- `catalogStore.ts` — `catalogs[]`, `catalogsLoading`, `catalogsError`, `fetchCatalogs`, `addCatalog`, `updateCatalog`, `removeCatalog`
- `schemaStore.ts` — `templates[]` (regular), `referenceDataTemplates[]`, `sectionsByTemplate` (keyed by templateId), `attributesBySection` (keyed by sectionId), fetch/add/update/remove/reorder helpers for all
- `uiStore.ts` — template drawer state, section drawer state machine (`sectionDrawerMode`, `sectionDrawerTemplateId`, `sectionDrawerSectionId`, `sectionDrawerIsDirty`, `sectionGuardAction`), `activeCatalogId`, `activeCatalogStatus`, delete modal state

#### Pages & Components

- `CatalogsPage.tsx` — catalog grid with CatalogCard, CatalogDrawer (create/edit), TransitionConfirmModal
- `DesignerPage.tsx` — extracts catalogId from URL params, sets activeCatalog in uiStore, renders tab content
- `DesignerNav.tsx` — nav bar with "← Catalogs" back link, Templates/Reference Data/Publish tabs (catalog-aware URLs)
- `EntityTypeManager.tsx` — Templates tab content; fetches `templates` via `fetchTemplates(catalogId)`
- `ReferenceDataTemplatesManager.tsx` — Reference Data tab content; fetches `referenceDataTemplates` via `fetchReferenceDataTemplates(catalogId)`
- `EntityTypeGrid.tsx` — responsive card grid (props: templates, loading, error, onRetry, emptyMessage, tabContext)
- `EntityTypeCard.tsx` — template card; clickable to navigate to template detail page; shows "System"/"Reference Data" badges
- `EntityTypeForm.tsx` — `EntityTypeDrawer` (combined form + drawer for create/edit)
- `DeleteConfirmModal.tsx` — handles deletion from both templates and referenceDataTemplates lists
- `UnsavedChangesGuard.tsx` — modal triggered by `uiStore.guardAction`

#### D-02 Template Detail Components (`components/designer/templates/`)

- `TemplateDetailPage.tsx` — full page: breadcrumb, catalog lock banner, section list, footer add-section button; mounts SectionDrawer + DeleteSectionModal + DeleteAttributeModal
- `SectionList.tsx` — @dnd-kit/core DndContext + SortableContext; handles drag-end with optimistic reorder + API call + revert on failure
- `SectionPanel.tsx` — individual section card using @dnd-kit/sortable `useSortable`; collapsible, drag handle, renders SectionHeader + AttributeList
- `SectionHeader.tsx` — section name, attribute count badge, chevron collapse, edit/delete icons on hover
- `AttributeList.tsx` — fetches attributes on mount via schemaStore; handles add/edit inline form; up/down arrow reorder with optimistic update
- `AttributeRow.tsx` — attribute display: name, required star, type badge, up/down arrows + edit/delete on hover
- `AttributeInlineForm.tsx` — inline create/edit form; type-conditional config fields (enum options textarea, reference/reference_data target template dropdown); type locked on edit
- `SectionDrawer.tsx` — DrawerShell (right panel) for create/edit section; own AlertDialog unsaved-changes guard
- `DeleteSectionModal.tsx` — AlertDialog to confirm section deletion; cascades to attributes if no field values exist; shows SECTION_IN_USE error if field values exist
- `DeleteAttributeModal.tsx` — AlertDialog to confirm attribute deletion

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
- `src/types.ts` — `AttributeType` enum, `AttributeConfigSchema` (Zod), `SchemaSnapshot`, `SchemaDiff` (diff between two snapshots), `SnapshotTemplate`, `SnapshotSection`, `SnapshotAttribute`
- `drizzle.config.ts` — requires `DATABASE_URL` (auto-provided by Replit)
- `pnpm --filter @workspace/db run push-force` — syncs schema to DB (for development)
- `pnpm --filter @workspace/db run build` — compiles declaration files

## API Contract

All API responses use a typed envelope:
```typescript
{ data: T | null, error: AppError | null }
```

Use `sendSuccess` and `sendError` from `artifacts/api-server/src/lib/response.ts`. Services throw `new ServiceError(code, message)`.

**Error codes**: `NOT_FOUND`, `CONFLICT`, `VALIDATION_ERROR`, `TEMPLATE_IN_USE`, `SECTION_IN_USE`, `CATALOG_LOCKED`, `CATALOG_INVALID_TRANSITION`, `SCHEMA_INVALID`, `BAD_REQUEST`, `INTERNAL_ERROR`

## Publish / Version Control (D-04)

### Backend

- `artifacts/api-server/src/utils/computeDiff.ts` — pure function, computes `SchemaDiff` between two `SchemaSnapshot`s. No DB access. Called at publish time only.
- `artifacts/api-server/src/services/templateService.ts` — `getPublishChecklist(catalogId)`, `publishSchema(catalogId)`, `getCurrentPublishedSchema(catalogId)`, `getVersionHistory(catalogId)`, `getVersionDiff(versionId)`
- `artifacts/api-server/src/routes/schema/publish.ts` — mounted at `/api/schema/publish`
- `schema_versions` table: `catalog_id`, `version_number`, `snapshot` (JSONB), `diff` (JSONB), `entry_count`, `is_current`, `published_by`, `published_at`

### Publish Flow (10-step transaction)
1. Load catalog (verify exists, status=draft)
2. Run pre-publish checklist (6 checks) — fails fast
3. Load all templates/sections/attributes/relationships inside transaction
4. Build SchemaSnapshot JSON
5. Compute SchemaDiff (vs. previous current version)
6. Increment version number scoped to catalogId
7. Mark previous isCurrent=false
8. INSERT new schema_versions row
9. Entry migration: INSERT NULL field_value rows for added attributes; DELETE rows for removed attributes
10. COMMIT

### Checklist Checks
1. `has_templates` — at least one non-reference-data template
2. `no_empty_templates` — all templates have at least one section
3. `no_empty_sections` — all sections have at least one attribute
4. `no_broken_references` — all reference attribute configs point to existing templates
5. `no_broken_relationships` — all relationships reference existing templates
6. `reference_data_valid` — all reference data templates have at least one section with attributes

### Frontend

- `artifacts/studio/src/stores/publishStore.ts` — Zustand store for checklist, versions, diff, publish action; call `reset()` when switching catalogs
- `artifacts/studio/src/pages/PublishPage.tsx` — full page at `/catalogs/:id/designer/publish`; contains: pre-publish checklist with Fix links, Publish button, confirm modal, version history list, diff panel
- `artifacts/studio/src/components/DesignerNav.tsx` — Publish tab is now a real Link (was disabled)

## O-03 Relationship Instance Linking

### Backend

- `entryService.ts` — `getLinkedEntries(entryId)`, `linkEntries(input)`, `unlinkEntries(linkId)` with cardinality enforcement (1:1, 1:N, M:N)
- `routes/entries.ts` — `GET /api/entries/:id/relationships`, `POST /api/entries/:id/relationships`, `DELETE /api/entries/:id/relationships/:linkId`; CONFLICT error for duplicate/cardinality violations; CATALOG_LOCKED error on unlink of discontinued catalog
- `EntryLinkInstance` interface now includes `fromTemplateId` for bidirectional navigation

### Frontend Store

- `entryStore.ts` — `linksByEntry`, `linksLoading`, `fetchLinks`, `addLink`, `removeLink`
- `uiStore.ts` — `linkModeActive`, `linkModeSourceEntryId`, `startLinkMode`, `endLinkMode`; `relationshipLinkDrawerOpen`, `relationshipLinkDrawerRelId`, `openRelationshipLinkDrawer`, `closeRelationshipLinkDrawer`

### Frontend Utility

- `utils/getCompatibleTemplateIds.ts` — pure function: given `sourceTemplateId` + `SchemaSnapshot`, returns all templateIds reachable via any relationship (from either side)

### Frontend Components

- `EntryLinkChip` — chip displaying a linked entry name (clickable to navigate) + X button to unlink
- `UnlinkConfirmModal` — Dialog confirming removal; shows entry names + relationship label
- `RelationshipSubsection` — collapsible panel per relationship type; wraps chips + "Add Link" button
- `RelatedEntriesSection` — inline relationship surface (rendered when template has 1–2 rel types)
- `RelationshipsTab` — tab-based surface (rendered when template has ≥3 rel types); two-column layout with sidebar navigation
- `RelationshipLinkDrawer` — Sheet from the right; typeahead search (min 2 chars); handles both "from" and "to" sides of a relationship; CONFLICT error display
- `CardLinkHandle` — draggable circular handle at bottom-center of EntryCard on hover
- `LinkModeOverlay` — fixed overlay with instruction banner + ESC cancel button during drag-to-link
- `RelationshipSelectionDialog` — Dialog shown after drag-drop to select relationship type before confirming link

### EntryDetailPage Threshold Logic

- `template.relationships.length === 0` → no relationship surface
- `1 ≤ length ≤ 2` → inline `RelatedEntriesSection` below field sections
- `length ≥ 3` → "Details" / "Relationships" tab bar; tab layout with `RelationshipsTab`

### EntryCard + EntryCardGrid Drag-to-Link

- `EntryCard` — accepts `isInLinkMode`, `isLinkSource`, `isCompatibleTarget`, `onLinkDragStart`, `onDropLink` props; renders `CardLinkHandle` on hover; visual states (blue border for source, green for compatible, dimmed for incompatible)
- `EntryCardGrid` — orchestrates drag-to-link: tracks source entry, computes compatible templates via `getCompatibleTemplateIds`, shows `LinkModeOverlay`, opens `RelationshipSelectionDialog` on drop; ESC key cancels link mode

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
