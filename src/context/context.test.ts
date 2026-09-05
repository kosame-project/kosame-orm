import { describe, expect, test } from "bun:test";
import { Model } from "../model/index.js";
import { ModelCollection } from "./collection.js";
import { createContext } from "./context.js";

class User extends Model {}
class Post extends Model {}

describe("createContext", () => {
  test("builds one ModelCollection per schema key", () => {
    const context = createContext({}, { users: User, posts: Post });

    expect(context.users).toBeInstanceOf(ModelCollection);
    expect(context.posts).toBeInstanceOf(ModelCollection);
  });

  test("entry points are plain own properties assembled at construction time, not a Proxy", () => {
    const context = createContext({}, { users: User, posts: Post });

    expect(Object.keys(context).sort()).toEqual(["posts", "users"]);
    expect(Object.prototype.hasOwnProperty.call(context, "users")).toBe(true);
  });
});
