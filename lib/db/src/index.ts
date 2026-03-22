// Schema table definitions and shared types.
// The database connection is NOT created here — it is the api-server's responsibility
// to open a single connection via openDatabase() in artifacts/api-server/src/db/connection.ts.
export * from "./schema";
export * from "./types";
