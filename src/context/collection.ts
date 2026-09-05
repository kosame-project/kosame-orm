import type { Model } from "../model/index.js";
import type { Context } from "./context.js";
import type { ModelClass } from "./types.js";

/**
 * The `context.users` / `context.posts` entry point for a single Model.
 *
 * Step 2 only wires up the reference to the owning {@link Context} and the
 * Model class it was registered under. The CRUD translation methods
 * (`find()`, `add()`, ...) are added on top of this in Phase 2 Step 3.
 */
export class ModelCollection<T extends Model> {
  readonly #context: Context;
  readonly #modelClass: ModelClass<T>;

  constructor(context: Context, modelClass: ModelClass<T>) {
    this.#context = context;
    this.#modelClass = modelClass;
  }
}
