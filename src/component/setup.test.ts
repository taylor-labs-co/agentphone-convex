/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { test } from "vitest";
import schema from "./schema.js";

const modules = import.meta.glob("./**/*.*s");

export function initConvexTest() {
  return convexTest(schema, modules);
}

test("component test setup", () => {});
