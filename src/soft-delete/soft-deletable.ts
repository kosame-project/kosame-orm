import type { Constructor, Model } from "../model/index.js";
import { SOFT_DELETE_COLUMN } from "./marker.js";

export interface SoftDeletableInstance {
  hardDelete(): Promise<void>;
}

export function SoftDeletable<TBase extends Constructor<Model>>(
  Base: TBase,
  columnKey = "deletedAt",
): TBase & Constructor<SoftDeletableInstance> {
  abstract class SoftDeletableMixin extends Base {
    static readonly [SOFT_DELETE_COLUMN] = columnKey;

    override async delete(): Promise<void> {
      await this.beforeDelete();
      await this.writeUpdate({ [columnKey]: new Date() });
    }

    async hardDelete(): Promise<void> {
      await super.delete();
    }
  }
  return SoftDeletableMixin as TBase & Constructor<SoftDeletableInstance>;
}
