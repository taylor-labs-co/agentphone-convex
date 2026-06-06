import type { AnyApi } from "convex/server";

export type ComponentApi<Name extends string | undefined = string | undefined> =
  AnyApi & {
    __componentName?: Name;
  };
