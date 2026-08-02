/// <reference types="vite/client" />
import type { TestConvex } from "convex-test";
import type { GenericSchema, SchemaDefinition } from "convex/server";
import schema from "./component/schema.js";

const modules = import.meta.glob("./component/**/*.ts");

/** Register AgentPhone with a convex-test instance. */
export function register(
  test: TestConvex<SchemaDefinition<GenericSchema, boolean>>,
  name: string = "agentphone",
) {
  test.registerComponent(name, schema, modules);
}

export default { register, schema, modules };
