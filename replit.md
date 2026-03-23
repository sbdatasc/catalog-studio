# Workspace

## Overview

This project is a pnpm monorepo using TypeScript to build a data catalog management system. It provides an Express API server (`api-server`) and a React + Vite frontend (`studio`). The system allows users to define, manage, and publish data schemas and catalog entries, supporting features such as schema versioning, relationship linking, and reference data management. The goal is to create a scalable and user-friendly platform for organizing and governing enterprise data assets.

## User Preferences

I prefer concise and accurate responses. When making changes, prioritize functionality and adhere to established architectural patterns. Please ask for confirmation before implementing significant architectural shifts or making widespread changes. For tasks involving UI, ensure changes are visually consistent with the existing design language.

## System Architecture

The project is structured as a pnpm workspace monorepo.

**Core Technologies:**
- **Monorepo:** pnpm workspaces
- **Backend:** Node.js, Express, PostgreSQL, Drizzle ORM, Zod
- **Frontend:** React, Vite, Zustand, `@dnd-kit/core`
- **Language:** TypeScript

**Monorepo Structure:**
- `artifacts/`: Deployable applications
- `lib/`: Shared libraries (API specifications, client, database)
- `scripts/`: Utility scripts

**Backend (`api-server`) Architecture:**
- Express API with domain-organized routes.
- Services layer for business logic and database interaction.
- Drizzle ORM for database operations.
- Typed API responses with standardized error handling.
- Implements user authentication (JWT + HttpOnly Cookie Refresh Tokens) with role-based access control (RBAC) for platform administrators and catalog-specific roles.
- Provides a runtime GraphQL engine for catalog data, building schemas programmatically from snapshots and enforcing depth limits.

**Frontend (`studio`) Architecture:**
- React application with Vite.
- Global state managed using Zustand.
- React Router for navigation.
- Reusable UI components for catalog management, schema design, and entry relationship linking.
- Specific design patterns for template details, schema publishing/version control, and relationship instance linking.
- User interface for administrative tasks like user management and catalog role assignments.
- Integrates an embedded GraphiQL playground for exploring catalog data via GraphQL.

**Database Architecture:**
- PostgreSQL, managed by Drizzle ORM.
- **Schema Hierarchy:** Catalog → Template → Section → Attribute.
- Supports catalog status transitions and immutability rules for schema elements.
- Uses an EAV (Entity-Attribute-Value) pattern for storing attribute values with type coercion.
- Implements tables for users, refresh tokens, and catalog-specific roles to support authentication and authorization.

**Key Features & Design Principles:**
- **Publish / Version Control:** Manages schema publishing, versioning, and entry migration with a multi-step transaction and pre-publish checklist.
- **Relationship Instance Linking:** Provides comprehensive drag-and-drop functionality for linking entries, including cardinality enforcement and dynamic UI.
- **Operational Mode:** Supports full CRUD operations for catalog entries with validation against published schemas.
- **User Authentication:** Secure JWT-based authentication with refresh tokens and role-based access for system and catalog administration.
- **RBAC Enforcement (A-05):** `requireCatalogRole()` middleware factory enforces a 4-level role hierarchy (viewer → steward → designer → catalog_admin) on every API route. Platform admins bypass all checks. `api_consumer` receives FORBIDDEN on all REST routes. `GET /api/catalogs` is filtered per user — only returns catalogs the authenticated user has a role on.
- **GraphQL Engine:** Provides a runtime GraphQL API for each catalog, generating schemas dynamically from stored metadata, with configurable depth limits and slug conventions.

## External Dependencies

- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **Validation:** Zod
- **API Client Generation:** Orval
- **Drag-and-Drop:** `@dnd-kit/core`, `@dnd-kit/sortable`
- **State Management:** Zustand
- **GraphQL:** `graphql` (graphql-js)