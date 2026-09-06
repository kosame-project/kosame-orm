import { describe, expect, test } from "bun:test";
import { Model, type ModelConstructorArgs } from "./model.js";

class TestModel extends Model {}

describe("Model", () => {
  test("throws when constructed directly without the internal brand", () => {
    const fakeArgs = { brand: Symbol("not-internal"), context: undefined } as unknown as ModelConstructorArgs;
    expect(() => new TestModel(fakeArgs)).toThrow();
  });
});
