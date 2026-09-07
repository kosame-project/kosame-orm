import { timestamp } from "drizzle-orm/pg-core";

export function deletedAtColumn(name = "deletedAt") {
  return timestamp(name);
}
