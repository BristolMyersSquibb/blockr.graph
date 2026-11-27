// JSON Patch for the DAG's state.
// It applies a delta's patches as the store does: RFC 6902's add, remove and
// replace, at JSON Pointers from the board's root (RFC 6901).
// The package @blockr/core ships types alone, so the DAG cannot call the
// store's own code for this.
// The `update` uses it to learn what a delta's patches leave of the DAG's
// state, and every part of the DAG uses pointer() to write its patches.
// The DAG's state holds objects and no arrays, so a patch whose path leads
// into an array cannot apply here.

import type { Json, Patch, PluginClassId } from "@blockr/core";
import { isObject } from "./json.ts";

// The JSON Pointer to the segments given, from the board's root.
// It writes "~" as "~0" and "/" as "~1", and gives
// "/plugins/blockr.graph/graph_plugin" for
// ["plugins", "blockr.graph", "graph_plugin"].
export function pointer(segments: readonly string[]): string {
  return segments.map((segment) => `/${segment.replaceAll("~", "~0").replaceAll("/", "~1")}`).join("");
}

// The segments of a JSON Pointer, or undefined where the text is no pointer
// below the board's root.
function segmentsFromPath(path: string): string[] | undefined {
  if (!path.startsWith("/")) return undefined;
  const segments = path.slice(1).split("/");
  if (segments.some((segment) => /~(?![01])/.test(segment))) return undefined;
  return segments.map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
}

// The state of the plugin `plugin` after the patches.
// It applies the patches that change the plugin's state, in order, to
// `state`, the plugin's state in the board before them, and skips the
// others. A patch names the plugin by two segments, the package and the id of
// its class, as /plugins/blockr.graph/graph_plugin/positions/a does.
// A patch at the plugin's own path replaces the state whole.
// It gives undefined where a patch cannot apply, as where its path leads to
// nothing, since the store then refuses the delta.
export function patched(state: Json, patches: readonly Patch[], plugin: Pick<PluginClassId, "package" | "id">): Json | undefined {
  let at: Json | undefined = state;
  for (const patch of patches) {
    const segments = segmentsFromPath(patch.path);
    if (segments?.[0] !== "plugins" || segments[1] !== plugin.package || segments[2] !== plugin.id) continue;
    at = at === undefined ? undefined : applied(at, segments.slice(3), patch);
  }
  return at;
}

// The value after a patch at the path `segments` below it, or undefined where
// the patch cannot apply.
function applied(at: Json, segments: readonly string[], patch: Patch): Json | undefined {
  const [segment, ...rest] = segments;
  if (segment === undefined) return patch.op === "replace" ? patch.value : undefined;
  if (!isObject(at)) return undefined;
  const has = Object.hasOwn(at, segment);

  if (rest.length > 0) {
    const inner = has ? applied(at[segment] as Json, rest, patch) : undefined;
    return inner === undefined ? undefined : { ...at, [segment]: inner };
  }

  if (patch.op === "remove") {
    return has ? Object.fromEntries(Object.entries(at).filter(([name]) => name !== segment)) : undefined;
  }
  if (patch.value === undefined || (patch.op === "replace" && !has)) return undefined;
  return { ...at, [segment]: patch.value };
}
