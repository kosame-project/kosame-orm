import type { ModelClass } from "../model/index.js";
import type { ModelCollection } from "./collection.js";

export type { ModelClass } from "../model/index.js";

export type ContextSchema = Record<string, ModelClass>;

export type ContextEntries<TSchema extends ContextSchema> = {
  [K in keyof TSchema]: TSchema[K] extends ModelClass<infer T, infer TTable>
    ? ModelCollection<T, TTable>
    : never;
};
