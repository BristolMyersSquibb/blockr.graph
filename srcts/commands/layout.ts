// The DAG's commands for its layout
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#commands):
//
// - The command blockr.graph-relayout sets the direction and the spacing
//   given and lays the whole board out again with them. In prepare(), it
//   loads dagre where it has not loaded yet, and lays the board out. Its
//   run() returns the
//   positions that the layout gave the blocks still on the board and the
//   stacks that still hold no block, snapped while `snap` is on, and the
//   settings that it was given, so that one undo puts every block back. A
//   block that someone added while the layout ran keeps the place that the
//   class's afterStep gave it. It empties what each collapse moved, since
//   every block moves, so that expanding a stack later makes room around its
//   box alone.
// - The command blockr.graph-set_placement sets how added blocks get their
//   place, and blockr.graph-set_snap whether the DAG snaps the positions
//   that it sets, and to what size. Neither moves a block, so neither takes
//   an undo step, and the next operation or drag snaps.

import type { Patch } from "@blockr/core";
import { canvasOf, snapChanges } from "../geometry/index.ts";
import type { Changes } from "../geometry/index.ts";
import { layOut, loadDagre } from "../layout/index.ts";
import type { Settings } from "../layout/index.ts";
import { at, changePatches } from "../patches/index.ts";
import { GRAPH, graphState, isCollapse } from "../state/index.ts";
import type { GraphState, Layout } from "../state/index.ts";
import { command, passes, stateFailures } from "./common.ts";
import * as schemas from "./schemas.ts";

type Relayout = Partial<Settings>;

// What blockr.graph-relayout prepares: the settings that it lays out with,
// and where the layout puts the blocks and the stacks that hold no block.
interface Laid extends Settings {
  readonly changes: Changes;
}

interface SetPlacement {
  readonly placement: Layout["placement"];
}

interface SetSnap {
  readonly snap?: boolean;
  readonly snap_size?: number;
}

export const layoutCommands = [
  command<Relayout, Laid>({
    id: "blockr.graph-relayout",
    label: "Lay out again",
    description:
      "Lays the whole board out again, every block and every stack that holds no block, with the direction and the spacing given, which the DAG keeps from then on, or with those it holds where they are left out. It moves every block, so run it before placing blocks by hand, never after.",
    args: schemas.object({
      direction: schemas.setting("direction", "The way that the board runs: TB from top to bottom, or LR from left to right."),
      spacing: schemas.setting("spacing", "The gaps between blocks and between ranks: 50 px when compact, 70 px when normal and 100 px when loose."),
    }),
    preflight: (board, _args, context) => passes(stateFailures(board), context),
    async prepare(board, { direction, spacing }) {
      const state = graphState(board);
      const settings: Settings = {
        direction: direction ?? state?.layout.direction ?? "TB",
        spacing: spacing ?? state?.layout.spacing ?? "normal",
      };
      const dagre = await loadDagre();
      const changes = state === undefined ? { positions: {}, points: {} } : layOut(dagre, canvasOf(board, state), settings);
      return { ...settings, changes };
    },
    run(board, { direction, spacing, changes }) {
      const state = graphState(board);
      if (state === undefined) return [];
      const layout: Layout = { ...state.layout, direction, spacing };
      const kept: Changes = {
        positions: Object.fromEntries(Object.entries(changes.positions).filter(([id]) => Object.hasOwn(board.blocks, id))),
        points: Object.fromEntries(Object.entries(changes.points).filter(([id]) => board.stacks[id]?.blocks.length === 0)),
      };
      const snapped = snapChanges(canvasOf(board, state), kept, layout);
      return { patches: [...changePatches(state, snapped, GRAPH), ...settingPatches(state, { direction, spacing }), ...emptied(state)] };
    },
  }),
  command<SetPlacement>({
    id: "blockr.graph-set_placement",
    label: "Set placement",
    description:
      "Sets how the DAG places the blocks that later edits add: repulsion keeps a new block where it starts and moves the blocks around it out of its way, and beside moves the new block on to the nearest free spot and moves no other block. It moves no block itself.",
    args: schemas.object(
      { placement: schemas.setting("placement", "How the DAG places the blocks that later edits add.") },
      ["placement"],
    ),
    undo: false,
    preflight: (board, _args, context) => passes(stateFailures(board), context),
    run(board, { placement }) {
      const state = graphState(board);
      return state === undefined ? [] : { patches: settingPatches(state, { placement }) };
    },
  }),
  command<SetSnap>({
    id: "blockr.graph-set_snap",
    label: "Set snapping",
    description:
      "Sets whether the DAG snaps every position that it sets to a multiple of the snap size, and the snap size, in pixels of the canvas. It moves no block itself: the next move or layout snaps.",
    args: schemas.object({
      snap: schemas.setting("snap", "Whether the DAG snaps the positions that it sets."),
      snap_size: schemas.setting("snap_size", "The size that positions snap to, in pixels of the canvas."),
    }),
    undo: false,
    preflight: (board, _args, context) => passes(stateFailures(board), context),
    run(board, { snap, snap_size }) {
      const state = graphState(board);
      return state === undefined ? [] : { patches: settingPatches(state, { snap, snap_size }) };
    },
  }),
];

// The patches that set the settings of the layout given, each where it
// differs from what the state holds.
function settingPatches(state: GraphState, settings: Partial<Layout>): Patch[] {
  const names = Object.keys(settings) as (keyof Layout)[];
  return names.flatMap((name): Patch[] => {
    const value = settings[name];
    return value === undefined || state.layout[name] === value ? [] : [{ op: "replace", path: at(GRAPH, "layout", name), value }];
  });
}

// The patches that empty what each collapse moved.
function emptied(state: GraphState): Patch[] {
  return Object.entries(state.stacks).flatMap(([id, entry]): Patch[] => {
    if (!isCollapse(entry)) return [];
    const { positions, stacks } = entry.moved;
    if (Object.keys(positions).length === 0 && Object.keys(stacks).length === 0) return [];
    return [{ op: "replace", path: at(GRAPH, "stacks", id, "moved"), value: { positions: {}, stacks: {} } }];
  });
}
