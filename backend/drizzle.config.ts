import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "./src/db/schema/index.ts",
  dialect: "sqlite",
  dbCredentials: { url: process.env.SQLITE_PATH ?? "./data/songolt.db" },
});
