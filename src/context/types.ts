import type { Model, ModelConstructorArgs } from "../model/index.js";
import type { ModelCollection } from "./collection.js";

export interface ModelClass<T extends Model = Model> {
  new (args: ModelConstructorArgs): T;
}

export type ContextSchema = Record<string, ModelClass>;

export type ContextEntries<TSchema extends ContextSchema> = {
  [K in keyof TSchema]: ModelCollection<InstanceType<TSchema[K]>>;
};
