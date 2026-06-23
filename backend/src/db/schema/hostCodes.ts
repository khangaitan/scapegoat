import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const hostCodesTable = sqliteTable("host_codes", {
  code: text("code").primaryKey(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  note: text("note"),
  usedAt: text("used_at"),
  usedByName: text("used_by_name"),
  roomId: text("room_id"),
});

export type HostCode = typeof hostCodesTable.$inferSelect;
export type InsertHostCode = typeof hostCodesTable.$inferInsert;
