import type { Model } from "../model/index.js";
import type { Context } from "./context.js";
import type { ModelClass } from "./types.js";

export class ModelCollection<T extends Model> {
  readonly #context: Context;
  readonly #modelClass: ModelClass<T>;

  constructor(context: Context, modelClass: ModelClass<T>) {
    this.#context = context;
    this.#modelClass = modelClass;
  }
}
