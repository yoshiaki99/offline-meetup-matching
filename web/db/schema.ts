import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const appState = sqliteTable("app_state", {
  id: text("id").primaryKey(),
  data: text("data").notNull(),
  revision: integer("revision").notNull().default(0),
});
export const sessions = sqliteTable(
  "sessions",
  {
    hash: text("hash").primaryKey(),
    user: text("user_json").notNull(),
    expires: integer("expires").notNull(),
  },
  (t) => [index("sessions_expiry").on(t.expires)],
);
export const oauthStates = sqliteTable(
  "oauth_states",
  { hash: text("hash").primaryKey(), expires: integer("expires").notNull() },
  (t) => [index("oauth_states_expiry").on(t.expires)],
);
