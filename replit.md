# Workspace

## Overview

This project is a pnpm monorepo utilizing TypeScript for building a data catalog management system. It comprises an Express API server (`api-server`) and a React + Vite frontend (`studio`). The system enables users to define, manage, and publish data schemas and catalog entries, supporting features like schema versioning, relationship linking, and reference data management. The overarching vision is to provide a robust, scalable, and user-friendly platform for organizing and governing data assets within an enterprise.

## User Preferences

I prefer concise and accurate responses. When making changes, prioritize functionality and adhere to established architectural patterns. Please ask for confirmation before implementing significant architectural shifts or making widespread changes. For tasks involving UI, ensure changes are visually consistent with the existing design language.

## System Architecture

The project is structured as a pnpm workspace monorepo.

**Core Technologies:**
- **Monorepo:** pnpm workspaces
- **Backend:** Node.js 24, Express 5, PostgreSQL, Drizzle ORM, Zod for validation
- **Frontend:** React, Vite, Zustand for state management, `@dnd-kit/core` for drag-and-drop
- **Build:** esbuild (CJS bundle)
- **Language:** TypeScript 5.9 (with composite projects for optimized type-checking)

**Monorepo Structure:**
- `artifacts/`: Deployable applications (`api-server`, `studio`)
- `lib/`: Shared libraries (`api-spec`, `api-client-react`, `api-zod`, `db`)
- `scripts/`: Utility scripts

**Backend (`api-server`) Architecture:**
- Express API with routes organized by domain (e.g., `/api/catalogs`, `/api/schema`).
- Services layer (`catalogService`, `templateService`, `entryService`, `coercionService`) handles business logic and interacts with the database.
- Centralized database connection management (`src/db/connection.ts`).
- Drizzle ORM for database interactions, with schema definitions in `lib/db`.
- Database migrations and seeding utilities.
- API responses follow a typed envelope `{ data: T | null, error: AppError | null }` with standardized error codes.

**Frontend (`studio`) Architecture:**
- React application with Vite as the build tool.
- Global state managed using Zustand (`catalogStore`, `schemaStore`, `uiStore`, `publishStore`, `entryStore`).
- React Router for client-side navigation.
- UI components are designed for reusability, with specific components for catalog management, schema design (templates, sections, attributes), and entry relationship linking.
- Design patterns include:
    - **D-02 Template Detail Components:** Dedicated components for managing sections and attributes within a template (`SectionList`, `SectionPanel`, `AttributeList`, `AttributeInlineForm`, `SectionDrawer`).
    - **D-04 Publish / Version Control:** Dedicated store and page for managing schema publishing, checklist validation, and version history.
    - **O-03 Relationship Instance Linking:** Comprehensive drag-and-drop linking functionality between catalog entries (`EntryLinkChip`, `RelationshipSubsection`, `RelationshipLinkDrawer`, `EntryCard`, `EntryCardGrid`). Dynamic UI adaptations based on the number of relationships per template.

**Database Architecture (v2 — Catalog Layer):**
- PostgreSQL database managed by Drizzle ORM.
- **Schema Hierarchy:** Catalog → Template → Section → Attribute.
- All templates and catalog entries are scoped to a Catalog.
- **Key Rules:**
    1. Single DB connection pool managed by `api-server`.
    2. Catalog status transitions: `draft → pilot → published → discontinued`. Schema mutations are only allowed in `draft` status.
    3. Support for "Reference Data templates" for controlled vocabularies.
    4. Attribute type immutability after creation.
    5. EAV (Entity-Attribute-Value) pattern for storing attribute values as TEXT, with coercion at read time.
    6. System seed templates are protected from deletion and name modification.
    7. Catalog duplication feature performs a deep copy of schema definitions.
    8. Unique constraints for template names/slugs are scoped per catalog.

**Publish / Version Control (D-04):**
- Backend: `computeDiff` utility, `templateService` for publishing logic, `schema_versions` table to store snapshots and diffs.
- Frontend: `publishStore` (Zustand) for checklist and version management, `PublishPage` for UI.
- Publish flow involves a 10-step transaction including pre-publish checklist, schema snapshot generation, diff computation, versioning, and entry migration.
- Pre-publish checklist includes checks for template completeness, broken references, and valid reference data.

**Relationship Instance Linking (O-03):**
- Backend: `entryService` for linking/unlinking entries with cardinality enforcement.
- Frontend: `entryStore` for link state, `uiStore` for link mode management.
- Utility `getCompatibleTemplateIds` for identifying linkable templates.
- UI components for displaying links (`EntryLinkChip`), managing relationships (`RelationshipSubsection`, `RelationshipsTab`), and facilitating the drag-and-drop linking experience (`CardLinkHandle`, `LinkModeOverlay`, `RelationshipSelectionDialog`).

**O-01 Operational Mode — Entry Creation:**
- Full CRUD entry lifecycle: `entryService.ts` (createEntry, listEntries, searchEntries, getEntry, updateEntry, deleteEntry) + `coercionService.ts` (toStorageString, fromStorageString, validateAttributeValue, toDisplayString).
- Entries validated against the published schema snapshot; `REQUIRED_FIELD_MISSING` / `REFERENCE_NOT_FOUND` / `VALIDATION_ERROR` service error codes.
- REST routes: `POST /api/entries`, `GET /api/entries`, `GET /api/entries/search`, `PATCH /api/entries/:id`, `DELETE /api/entries/:id`.
- Frontend: `OperationalPage.tsx` with tabbed template navigation, card/table view toggle, debounced search. `EntryForm.tsx` with `SectionAccordion`, 8 typed field controls in `components/operational/fields/`. `entryStore.ts` (paginated entry lists, activeEntry, linksByEntry). `uiStore.ts` additions: activeTemplateTabId, isEntryFormOpen, entryListViewMode.

**G-02 Embedded GraphiQL Playground:**
- Route `/catalogs/:catalogId/graphql` renders `GraphQLPage.tsx` — full-height GraphiQL editor with the catalog's GraphQL endpoint pre-configured.
- `createCatalogFetcher` auto-injects `catalogId` variable into all query requests.
- `ExampleQueriesPanel` generates schema-aware example queries and loads them into the editor via `initialQuery` + key-based remount (GraphiQL v5 API; `query` prop removed).
- `GraphQLNav` / `GraphQLPageHeader` / `GraphQLPageHeader` nav components; "API" link added to `DesignerNav` and `OperationalNav`.
- CSP middleware added for `/catalogs/:catalogId/graphql` path in Express `app.ts` (using Express 5 compatible route pattern).

**G-01 Runtime GraphQL Engine:**
- `graphql` (graphql-js ^16) installed in `api-server` as the runtime schema building and execution library.
- `artifacts/api-server/src/graphql/` contains: `context.ts` (GraphQLContext, SlugMap), `filters.ts` (6 scalar filter input types + in-memory filter application), `resolvers.ts` (rootList, rootSingle, relationship, attribute, refData resolvers), `engine.ts` (schema building, caching, slug utilities).
- `POST /api/graphql` route handler in `artifacts/api-server/src/routes/graphql.ts`.
- Schema built programmatically from `SchemaSnapshot` — no code generation. Cached per catalog (keyed by versionId).
- Two-level traversal rule: `depth` tracked in context; relationship resolvers return null at `depth >= 3`.
- `catalogId` required as a GraphQL variable on all queries.
- Error codes added to `AppErrorCode`: `GRAPHQL_SCHEMA_UNREADY`, `GRAPHQL_QUERY_INVALID`.
- Studio `apiClient.graphql(query, variables)` method added.
- Slug conventions: `toGraphQLSlug()` → object type name via `toPascalCase()`; list query = `slug + 's'`; single = `slug`; relationship field = `toGraphQLSlug(rel.label)`.

## External Dependencies

- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **Validation:** Zod
- **API Client Generation:** Orval (used in `lib/api-spec` to generate `api-client-react` and `api-zod`)
- **Drag-and-Drop:** `@dnd-kit/core` and `@dnd-kit/sortable`
- **State Management:** Zustand
- **GraphQL:** `graphql` ^16 (graphql-js) — runtime schema building in `api-server`