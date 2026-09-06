import { describe, expect, test } from "bun:test";
import { Model, type ModelConstructorArgs } from "./model.js";
import type { Constructor } from "./mixin.js";

function WithGreeting<TBase extends Constructor<Model>>(Base: TBase) {
  abstract class WithGreetingMixin extends Base {
    greet(): string {
      return "hello";
    }
  }
  return WithGreetingMixin;
}

function WithTag<TBase extends Constructor<Model>>(Base: TBase) {
  abstract class WithTagMixin extends Base {
    tag = "tagged";
  }
  return WithTagMixin;
}

class TestModel extends WithGreeting(WithTag(Model)) {}

describe("mixin composition", () => {
  test("the brand guard still throws through two layers of mixins", () => {
    const fakeArgs = { brand: Symbol("not-internal"), context: undefined } as unknown as ModelConstructorArgs;
    expect(() => new TestModel(fakeArgs)).toThrow();
  });

  test("methods added by every mixin in the chain are present on the class prototype", () => {
    expect(TestModel.prototype.greet).toBeInstanceOf(Function);
  });
});
