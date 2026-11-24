// Loading dagre, which the DAG does only once it lays a board out: where
// blockr.graph-relayout prepares, or where the class's start opens a board
// that holds no position. The page loads the file once, and every later call
// gets the same module.
// A load that fails, as where the page cannot reach R, is tried afresh by
// the next call.

import type * as Vendor from "./vendor.ts";

export type Dagre = typeof Vendor;

let loading: Promise<Dagre> | undefined;

export function loadDagre(): Promise<Dagre> {
  loading ??= import("./vendor.ts").catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}
