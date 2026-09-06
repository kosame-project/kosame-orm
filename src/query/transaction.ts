import { sql } from "drizzle-orm";

export function isSyncDatabase(db: any): boolean {
  return db?.resultKind === "sync";
}

async function runManualBegin<R>(db: any, fn: (tx: unknown) => Promise<R>): Promise<R> {
  db.run(sql.raw("BEGIN"));
  try {
    const result = await fn(db);
    db.run(sql.raw("COMMIT"));
    return result;
  } catch (error) {
    db.run(sql.raw("ROLLBACK"));
    throw error;
  }
}

async function runManualSavepoint<R>(db: any, depth: number, fn: (tx: unknown) => Promise<R>): Promise<R> {
  const name = `kosame_sp_${depth}`;
  db.run(sql.raw(`SAVEPOINT ${name}`));
  try {
    const result = await fn(db);
    db.run(sql.raw(`RELEASE SAVEPOINT ${name}`));
    return result;
  } catch (error) {
    db.run(sql.raw(`ROLLBACK TO SAVEPOINT ${name}`));
    throw error;
  }
}

export async function runTransaction<R>(
  db: any,
  depth: number,
  fn: (tx: unknown) => Promise<R>,
): Promise<R> {
  if (!isSyncDatabase(db)) {
    return db.transaction((tx: unknown) => fn(tx));
  }
  return depth === 0 ? runManualBegin(db, fn) : runManualSavepoint(db, depth, fn);
}
