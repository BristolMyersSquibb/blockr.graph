// The patches through which the DAG's commands and its class write what they
// change into the DAG's state, each at the key of the block or the stack
// that it changes, so that a patch names a block or a stack rather than an
// index of an array, which may hold another by the time undo or redo applies
// the patch (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#the-state).

import type { BlockId, Patch, PluginClassId, StackId } from "@blockr/core";
import type { Changes } from "../geometry/index.ts";
import { isCollapse, pointer } from "../state/index.ts";
import type { GraphState, StackEntry } from "../state/index.ts";

// The JSON Pointer from the board's root to the segments given, inside the
// state of the plugin, which the board holds under the package and the id of
// the plugin's class, as /plugins/blockr.graph/graph_plugin/positions/a.
export function at(plugin: Pick<PluginClassId, "package" | "id">, ...segments: string[]): string {
  return pointer(["plugins", plugin.package, plugin.id, ...segments]);
}

// The patches that set the positions of blocks, and of stacks that hold no
// block, that the changes give.
export function changePatches(state: GraphState, changes: Changes, plugin: Pick<PluginClassId, "package" | "id">): Patch[] {
  const set = (part: "positions" | "stacks", id: string, value: Patch["value"]): Patch => ({
    op: Object.hasOwn(state[part], id) ? "replace" : "add",
    path: at(plugin, part, id),
    value,
  });
  return [
    ...Object.entries(changes.positions).map(([id, point]) => set("positions", id, point)),
    ...Object.entries(changes.points).map(([id, point]) => set("stacks", id, point)),
  ];
}

// The patches that set the entries in `stacks`, or remove those given as
// null.
export function entryPatches(
  state: GraphState,
  entries: Readonly<Record<StackId, StackEntry | null>>,
  plugin: Pick<PluginClassId, "package" | "id">,
): Patch[] {
  return Object.entries(entries).flatMap(([id, entry]): Patch[] => {
    const has = Object.hasOwn(state.stacks, id);
    if (entry === null) return has ? [{ op: "remove", path: at(plugin, "stacks", id) }] : [];
    return [{ op: has ? "replace" : "add", path: at(plugin, "stacks", id), value: entry }];
  });
}

// The patches that drop the blocks and the stacks given from what each
// collapse moved, so that no expand puts them back.
// It leaves alone the entries that `except` names, as of a stack whose entry
// the same step replaces.
export function unmovedPatches(
  state: GraphState,
  blocks: Iterable<BlockId>,
  stacks: Iterable<StackId>,
  plugin: Pick<PluginClassId, "package" | "id">,
  except: ReadonlySet<StackId> = new Set(),
): Patch[] {
  const [gone, goneStacks] = [[...blocks], [...stacks]];
  return Object.entries(state.stacks).flatMap(([id, entry]) => {
    if (!isCollapse(entry) || except.has(id)) return [];
    const drop = (part: "positions" | "stacks", ids: readonly string[]): Patch[] =>
      ids
        .filter((other) => Object.hasOwn(entry.moved[part], other))
        .map((other) => ({ op: "remove", path: at(plugin, "stacks", id, "moved", part, other) }));
    return [...drop("positions", gone), ...drop("stacks", goneStacks)];
  });
}
