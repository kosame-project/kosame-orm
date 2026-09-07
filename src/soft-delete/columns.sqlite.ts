import { integer } from "drizzle-orm/sqlite-core";

export function deletedAtColumn(name = "deletedAt") {
  return integer(name, { mode: "timestamp" });
}
