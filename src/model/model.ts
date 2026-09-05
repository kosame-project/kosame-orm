import type { Table } from "drizzle-orm";
import { INTERNAL, type InternalBrand } from "./internal.js";

export interface ModelConstructorArgs {
  brand: InternalBrand;
  context: unknown;
}

export abstract class Model {
  declare static readonly table: Table;

  readonly #context: unknown;

  constructor(args: ModelConstructorArgs) {
    if (args.brand !== INTERNAL) {
      throw new Error(
        "Model subclasses cannot be constructed directly with `new`. Obtain instances via a context factory method instead (e.g. `context.users.find()`).",
      );
    }
    this.#context = args.context;
  }

  protected get context(): unknown {
    return this.#context;
  }
}
