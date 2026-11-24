// The `update` of the DAG plugin's class
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#the-classs-update-and-afterstep).
// The store calls it with every delta that it applies, undos included, and
// adds the patches that it returns to the same step.
// It reads only the delta and the board, never the page, so every peer that
// applies a change computes the same patches.
//
// It drops the position of each block that the delta removes, the entry in
// `stacks` of each stack that the delta removes, and what each collapse moved
// of either, from the state that the delta's patches leave.
// A delta that removes an id and adds it again keeps what the state holds for
// it, since the new block or stack takes the place of the old.
// The store then calls the `update` again, on the delta with these patches,
// and it finds nothing more to drop.
// Where the delta's patches leave a state of another shape, it returns no
// patch, and the store's check of the state against the schema says what is
// wrong.

import type { Board, Delta, Patch, PluginClassId } from "@blockr/core";
import { at, unmovedPatches } from "../patches/index.ts";
import { isGraphState, patched } from "../state/index.ts";

export function update(delta: Delta, board: Board, plugin: PluginClassId): Patch[] {
  const removed = (rm: readonly string[] | undefined, add: object | undefined) =>
    (rm ?? []).filter((id) => add === undefined || !Object.hasOwn(add, id));
  const blocks = removed(delta.blocks?.rm, delta.blocks?.add);
  const stacks = removed(delta.stacks?.rm, delta.stacks?.add);
  if (blocks.length === 0 && stacks.length === 0) return [];

  const stored = board.plugins[plugin];
  const state = stored === undefined ? undefined : patched(stored, delta.patches ?? [], plugin);
  if (!isGraphState(state)) return [];
  const remove = (part: "positions" | "stacks", id: string): Patch => ({ op: "remove", path: at(plugin, part, id) });
  return [
    ...blocks.filter((block) => Object.hasOwn(state.positions, block)).map((block) => remove("positions", block)),
    ...stacks.filter((stack) => Object.hasOwn(state.stacks, stack)).map((stack) => remove("stacks", stack)),
    ...unmovedPatches(state, blocks, stacks, plugin, new Set(stacks)),
  ];
}
