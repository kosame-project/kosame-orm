import type { Model, ModelConstructorArgs } from "../model/index.js";
import type { ModelCollection } from "./collection.js";

/**
 * The shape a Model subclass's constructor must have to be registered on a
 * context. `static table` (the drizzle table binding) is deliberately not
 * required here — Step 3 (CRUD translation) is what reads it.
 */
export interface ModelClass<T extends Model = Model> {
  new (args: ModelConstructorArgs): T;
}

/**
 * Maps the key a Model will be exposed under on the context
 * (`schema.users` -> `context.users`) to its Model class. Named
 * `ContextSchema` (rather than `Schema`) to avoid colliding with the
 * per-Model `static schema` (zod) planned for Phase 8.
 */
export type ContextSchema = Record<string, ModelClass>;

/**
 * The per-key entry points a context ends up with once
 * `Object.entries(schema)` has been iterated — one `ModelCollection` per
 * schema key, typed to the Model instance it produces.
 */
export type ContextEntries<TSchema extends ContextSchema> = {
  [K in keyof TSchema]: ModelCollection<InstanceType<TSchema[K]>>;
};
