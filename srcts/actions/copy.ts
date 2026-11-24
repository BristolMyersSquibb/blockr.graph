// What the DAG's Copy and Cut take of their target, and the JSON board that
// Copy puts on the clipboard, as today's copy does
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#the-dags-board-actions):
// the blocks and stacks that it acts on, the blocks of those stacks, the
// links between those blocks, any other stack that holds a block and whose
// blocks are all copied, and their positions.
// The JSON board is the store's JSON board of the whole board with only
// those, so that it records the versions of the packages and of the blocks'
// states, by which Paste migrates them as it reads the board. It holds the
// DAG's state with the positions of the copied blocks and of the copied
// stacks that hold no block, and no other plugin's state and no board option.
// A copied stack that the DAG shows collapsed pastes expanded.

import type { BlockId, Board, JsonBoard, StackId, Target } from "@blockr/core";
import { GRAPH, isGraphState, isPoint } from "../state/index.ts";
import type { GraphState } from "../state/index.ts";

export interface Copied {
  readonly blocks: readonly BlockId[];
  readonly stacks: readonly StackId[];
}

// The blocks and the stacks that Copy and Cut take of the target, each in the
// order that the board holds them, or none of either where the target names
// no block or stack that the board holds.
export function copiedOf(board: Board, target: Target): Copied {
  const objects = "selection" in target ? target.selection : [target];
  const actedBlocks = new Set<BlockId>();
  const actedStacks = new Set<StackId>();
  for (const object of objects) {
    if ("input" in object) continue;
    if ("block" in object && Object.hasOwn(board.blocks, object.block)) actedBlocks.add(object.block);
    if ("stack" in object && Object.hasOwn(board.stacks, object.stack)) actedStacks.add(object.stack);
  }
  for (const stack of actedStacks) {
    for (const block of board.stacks[stack]?.blocks ?? []) {
      if (Object.hasOwn(board.blocks, block)) actedBlocks.add(block);
    }
  }
  const stacks = Object.entries(board.stacks).flatMap(([id, stack]) =>
    actedStacks.has(id) || (stack.blocks.length > 0 && stack.blocks.every((block) => actedBlocks.has(block))) ? [id] : [],
  );
  return { blocks: Object.keys(board.blocks).filter((block) => actedBlocks.has(block)), stacks };
}

// Whether the target names a block or a stack that the board holds, which
// Copy and Cut act on.
export function copies(board: Board, target: Target): boolean {
  const { blocks, stacks } = copiedOf(board, target);
  return blocks.length + stacks.length > 0;
}

// The JSON board of what Copy takes, from the store's JSON board of the whole
// board.
export function copiedBoard(json: JsonBoard, copied: Copied): JsonBoard {
  const blocks = new Set(copied.blocks);
  const stacks = new Set(copied.stacks);
  const { board } = json;
  const graph = board.plugins[GRAPH];
  const state = graph === undefined || !isGraphState(graph.state) ? undefined : graph.state;
  return {
    ...json,
    board: {
      ...board,
      blocks: kept(board.blocks, (id) => blocks.has(id)),
      links: kept(board.links, (_id, link) => blocks.has(link.from) && blocks.has(link.to)),
      stacks: kept(board.stacks, (id) => stacks.has(id)),
      options: {},
      plugins: graph === undefined || state === undefined ? {} : { [GRAPH]: { ...graph, state: copiedState(state, blocks, stacks) } },
    },
  };
}

// The DAG's state with the positions of the copied blocks and of the copied
// stacks that hold no block alone.
function copiedState(state: GraphState, blocks: ReadonlySet<BlockId>, stacks: ReadonlySet<StackId>): GraphState {
  return {
    ...state,
    positions: kept(state.positions, (id) => blocks.has(id)),
    stacks: kept(state.stacks, (id, entry) => stacks.has(id) && isPoint(entry)),
  };
}

// The entries of a record that pass the check, by their keys.
function kept<T>(record: Readonly<Record<string, T>>, keep: (id: string, value: T) => boolean): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([id, value]) => keep(id, value)));
}
