// The class's `start`, which gives every block and every stack that holds no
// block a position as a board opens
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#starting-on-a-board):
//
// 1. Where the board holds no position for any block or stack, as a board
//    that a script builds without positions or a converted file that holds
//    none, it lays the whole board out, once dagre has loaded.
// 2. Where it lacks the positions of some blocks or stacks only, it places
//    those as Beside places what a step adds, whatever the placement, so
//    that every block that has a position opens where it was saved.
//
// In the same delta, it drops what the state holds that does not fit the
// board, as an app script may give it:
// - Each position, each entry in `stacks` and each entry in what a collapse
//   moved that names a block or a stack that the board lacks.
// - The entry of each stack that holds a block and has a position.
// - The parts `collapsed` and `moved` of the entry of each stack that holds
//   no block, which then gets a position.
// It names every entry that it drops in one warning about the DAG, of the
// code `graph_state_dropped`, which holds until the next board opens, as
// core's note of what the store dropped does, and logs the same at warn.
// The delta's origin is the id of the DAG plugin's class, the Id that core
// hands `start`. The delta has `undo: false`, so that undo never takes the
// board back to blocks without positions.
// Core calls `start` once the frontend's render() has returned, so a step
// that the frontend takes as it starts comes before it.

import type { Board, CoreApi, Patch, PluginClassId } from "@blockr/core";
import { canvasOf, snapChanges } from "../geometry/index.ts";
import type { Changes } from "../geometry/index.ts";
import { layOut, loadDagre } from "../layout/index.ts";
import type { Dagre } from "../layout/index.ts";
import { at, changePatches } from "../patches/index.ts";
import { placeAdded } from "../placement/index.ts";
import { graphState, isCollapse } from "../state/index.ts";
import type { GraphState, StackEntry } from "../state/index.ts";

// The package whose log lines the DAG writes.
const PACKAGE = "blockr.graph";

// What the class's start does on the board: the patches of its delta and the
// entries that it drops, each in words, or that it waits for dagre, which it
// lays the board out with.
export type Starting = { readonly patches: readonly Patch[]; readonly dropped: readonly string[] } | "layout";

// The step that starting takes on the board, given dagre where it has loaded.
export function starting(board: Board, plugin: Pick<PluginClassId, "package" | "id">, dagre?: Dagre): Starting {
  const state = graphState(board, plugin);
  if (state === undefined) return { patches: [], dropped: [] };
  const { kept, patches, dropped } = fitted(board, state, plugin);

  const canvas = canvasOf(board, kept);
  const lacking = {
    blocks: new Set(Object.keys(board.blocks).filter((block) => kept.positions[block] === undefined)),
    stacks: new Set(
      Object.entries(board.stacks)
        .filter(([id, stack]) => stack.blocks.length === 0 && canvas.points[id] === undefined)
        .map(([id]) => id),
    ),
  };
  if (lacking.blocks.size + lacking.stacks.size === 0) return { patches, dropped };

  const none = Object.keys(kept.positions).length === 0 && Object.keys(canvas.points).length === 0;
  if (none && dagre === undefined) return "layout";
  const changes: Changes =
    none && dagre !== undefined
      ? snapChanges(canvas, layOut(dagre, canvas, kept.layout), kept.layout)
      : placeAdded(canvas, lacking, new Set(), kept.layout, "beside");
  return { patches: [...patches, ...changePatches(state, changes, plugin)], dropped };
}

// The state with what does not fit the board dropped, the patches that drop
// it, and each entry that they drop, in words.
// A stack that holds no block keeps its collapse in `kept`'s patches, since
// the position that it gets replaces the collapse in one patch.
function fitted(
  board: Board,
  state: GraphState,
  plugin: Pick<PluginClassId, "package" | "id">,
): { kept: GraphState; patches: Patch[]; dropped: string[] } {
  const patches: Patch[] = [];
  const dropped: string[] = [];
  const drop = (path: string, what: string) => {
    patches.push({ op: "remove", path });
    dropped.push(what);
  };

  const positions = Object.fromEntries(Object.entries(state.positions).filter(([block]) => Object.hasOwn(board.blocks, block)));
  for (const block of Object.keys(state.positions)) {
    if (!Object.hasOwn(positions, block)) drop(at(plugin, "positions", block), `the position of the block "${block}", which the board lacks`);
  }

  const stacks: Record<string, StackEntry> = {};
  for (const [id, entry] of Object.entries(state.stacks)) {
    const stack = board.stacks[id];
    if (stack === undefined) {
      drop(at(plugin, "stacks", id), `the entry of the stack "${id}", which the board lacks`);
    } else if (!isCollapse(entry)) {
      if (stack.blocks.length === 0) stacks[id] = entry;
      else drop(at(plugin, "stacks", id), `the position of the stack "${id}", which holds blocks`);
    } else if (stack.blocks.length === 0) {
      dropped.push(`the collapse of the stack "${id}", which holds no block`);
    } else {
      const moved = (part: "positions" | "stacks", holds: (other: string) => boolean, kind: string) =>
        Object.fromEntries(
          Object.entries(entry.moved[part]).filter(([other]) => {
            if (holds(other)) return true;
            drop(at(plugin, "stacks", id, "moved", part, other), `what the collapse of the stack "${id}" moved of the ${kind} "${other}", which the board lacks`);
            return false;
          }),
        );
      stacks[id] = {
        collapsed: entry.collapsed,
        moved: {
          positions: moved("positions", (other) => Object.hasOwn(board.blocks, other), "block"),
          stacks: moved("stacks", (other) => Object.hasOwn(board.stacks, other), "stack"),
        },
      };
    }
  }
  return { kept: { ...state, positions, stacks }, patches, dropped };
}

// Runs the class's start on the open board: takes the step at once, or once
// dagre has loaded where it lays the whole board out, unless the signal has
// aborted by then, as the next board opens.
// Where the step fails once dagre has loaded, as where dagre's file does not
// load or the store refuses the delta, it logs why at error. Core has told
// the user already of a delta that the store refuses.
export function start({ core, plugin, signal }: { readonly core: CoreApi; readonly plugin: PluginClassId; readonly signal: AbortSignal }): undefined {
  const first = starting(core.store.board(), plugin);
  if (first !== "layout") {
    take(core, plugin, first);
    return undefined;
  }
  loadDagre()
    .then((dagre) => {
      if (signal.aborted) return;
      const step = starting(core.store.board(), plugin, dagre);
      if (step !== "layout") take(core, plugin, step);
    })
    .catch((error: unknown) => {
      if (signal.aborted) return;
      const why = error instanceof Error ? error.message : String(error);
      core.log(PACKAGE).error(`The DAG could not lay the board out as it opened: ${why}`);
    });
  return undefined;
}

// Applies the step as one delta of the plugin's class that undo does not take
// back, and names what it dropped in a warning and in the log.
function take(core: CoreApi, plugin: PluginClassId, step: Exclude<Starting, "layout">): void {
  if (step.patches.length > 0) core.store.apply({ patches: step.patches }, plugin, { undo: false });
  if (step.dropped.length === 0) return;
  const message = `The DAG dropped what its state held that does not fit the board: ${listing(step.dropped)}.`;
  core.notifications.notify(plugin, { severity: "warning", code: "graph_state_dropped", message });
  core.log(PACKAGE).warn(message);
}

// The items as a list in prose, as "a, b and c".
function listing(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1) ?? ""}`;
}
