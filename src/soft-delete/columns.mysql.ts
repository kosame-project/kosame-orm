import { datetime } from "drizzle-orm/mysql-core";

export function deletedAtColumn(name = "deletedAt") {
  return datetime(name);
}
