import { openDatabase } from "../../../artifacts/api-server/src/db/connection";
import { beforeAll } from "vitest";

beforeAll(async () => {
  const url = process.env["DATABASE_URL_TEST"] ?? process.env["DATABASE_URL"];
  if (!url) {
    throw new Error("DATABASE_URL must be set for integration tests.");
  }
  process.env["DATABASE_URL"] = url;
  await openDatabase();
}, 30_000);
