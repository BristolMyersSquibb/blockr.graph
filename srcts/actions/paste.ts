// The batch of the DAG's Paste, from the board that the store reads from the
// text on the clipboard, as the DAG's Copy writes one
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#the-dags-board-actions):
//
// 1. Each block, link and stack of the read board gets a new id, which
//    CoreApi's mintId() mints, and the pasted links and stacks point at the
//    new ids. The blocks keep their names, and the name of each stack gains
//    " (copy)", as today's paste has it.
// 2. The batch holds core's commands that add the blocks, the stacks and the
//    links, and then change_position of blockr.graph with the positions that
//    the read board gives them in the DAG's state, moved together so that their
//    middle lands at the point where the user pastes, or at the free spot
//    nearest it, so that nothing pasted lands on a node or in a stack's box
//    that the board shows (../placement/free.ts).
//
// The class's afterStep places what the batch adds from there, as it places
// whatever a step adds, so that one undo takes the paste back. A pasted block
// that the read board gives no position, as a board copied without the DAG's
// state would, starts where the placement strategy starts any added block.

import type { BlockId, Board, CommandCall, CoreApi, StackId } from "@blockr/core";
import { bounds, canvasOf } from "../geometry/index.ts";
import type { Canvas } from "../geometry/index.ts";
import { freeOffset, shownBoxes } from "../placement/index.ts";
import { graphState, isPoint } from "../state/index.ts";
import type { Point } from "../state/index.ts";

// What the name of each pasted stack gains.
const COPY = " (copy)";

// The batch that pastes the read board onto the board, with the middle of
// what it pastes at the point, or where it was copied where no point is
// given. It is empty where the read board holds no block and no stack.
// It mints each new id with the caller's core.mintId(), and names each
// command by the Id that its core.id() gives.
export function pasteBatch(board: Board, read: Board, point: Point | undefined, core: Pick<CoreApi, "id" | "mintId">): CommandCall[] {
  const blocks = renamed(Object.keys(read.blocks), board.blocks, core);
  const stacks = renamed(Object.keys(read.stacks), board.stacks, core);
  const pastedLinks = Object.entries(read.links).filter(([, link]) => blocks.has(link.from) && blocks.has(link.to));
  const links = renamed(
    pastedLinks.map(([id]) => id),
    board.links,
    core,
  );

  const batch: CommandCall[] = [];
  for (const [id, block] of Object.entries(read.blocks)) {
    // A command's args are JSON, which holds the block's registry id as the
    // plain record of its package and its id.
    const { package: pkg, id: cls } = block.registry_id;
    batch.push({
      id: core.id("blockr.core", "add_block"),
      args: { registry_id: { package: pkg, id: cls }, id: newId(blocks, id), name: block.name, state: block.state },
    });
  }
  for (const [id, stack] of Object.entries(read.stacks)) {
    batch.push({
      id: core.id("blockr.core", "add_stack"),
      args: {
        id: newId(stacks, id),
        name: `${stack.name}${COPY}`,
        blocks: stack.blocks.flatMap((block) => blocks.get(block) ?? []),
        color: stack.color,
      },
    });
  }
  for (const [id, link] of pastedLinks) {
    batch.push({
      id: core.id("blockr.core", "add_link"),
      args: {
        id: newId(links, id),
        from: newId(blocks, link.from),
        to: newId(blocks, link.to),
        ...(link.input === "" ? {} : { input: link.input }),
      },
    });
  }
  const moved = positionsOf(board, read, blocks, stacks, point);
  if (moved !== undefined) batch.push({ id: core.id("blockr.graph", "change_position"), args: moved });
  return batch;
}

// The new id of each of the ids given, minted so that it is taken neither in
// the board's collection nor by another id of the paste.
function renamed(ids: readonly string[], collection: Readonly<Record<string, unknown>>, core: Pick<CoreApi, "mintId">): Map<string, string> {
  const minted = new Map<string, string>();
  const taken = new Set<string>();
  for (const id of ids) {
    const next = core.mintId((candidate) => Object.hasOwn(collection, candidate) || taken.has(candidate));
    taken.add(next);
    minted.set(id, next);
  }
  return minted;
}

function newId(ids: ReadonlyMap<string, string>, id: string): string {
  const minted = ids.get(id);
  if (minted === undefined) throw new Error(`The paste minted no id for "${id}".`);
  return minted;
}

// The args of change_position of blockr.graph for what the paste adds: the
// positions that the read board gives the pasted blocks and the pasted
// stacks that hold no block, moved together so that the middle of their
// bounds lands at the point, or at the free spot on the board nearest it.
// It is undefined where the read board gives none of them a position.
function positionsOf(
  board: Board,
  read: Board,
  blocks: ReadonlyMap<BlockId, BlockId>,
  stacks: ReadonlyMap<StackId, StackId>,
  point: Point | undefined,
): { positions: Record<BlockId, Point>; stacks: Record<StackId, Point> } | undefined {
  const state = graphState(read);
  if (state === undefined) return undefined;
  const positions = Object.entries(state.positions).flatMap(([id, at]): [BlockId, Point][] => {
    const pasted = blocks.get(id);
    return pasted === undefined ? [] : [[pasted, at]];
  });
  const points = Object.entries(state.stacks).flatMap(([id, entry]): [StackId, Point][] => {
    const pasted = stacks.get(id);
    return pasted === undefined || !isPoint(entry) || (read.stacks[id]?.blocks.length ?? 0) > 0 ? [] : [[pasted, entry]];
  });
  const box = bounds([...positions, ...points].map(([, at]) => ({ x: at.x, y: at.y, w: 0, h: 0 })));
  if (box === undefined) return undefined;
  let dx = point === undefined ? 0 : point.x - box.x;
  let dy = point === undefined ? 0 : point.y - box.y;
  const onto = graphState(board);
  if (onto !== undefined) {
    const free = freeOffset(canvasOf(board, onto), shownBoxes(shiftedCanvas(canvasOf(read, state), dx, dy)), onto.layout);
    dx += free.x;
    dy += free.y;
  }
  const moved = (entries: readonly [string, Point][]): Record<string, Point> =>
    Object.fromEntries(entries.map(([id, at]) => [id, { x: at.x + dx, y: at.y + dy }]));
  return { positions: moved(positions), stacks: moved(points) };
}

// The canvas with every block and every stack that holds no block moved by
// dx and dy.
function shiftedCanvas(canvas: Canvas, dx: number, dy: number): Canvas {
  const by = (points: Readonly<Record<string, Point>>): Record<string, Point> =>
    Object.fromEntries(Object.entries(points).map(([id, at]) => [id, { x: at.x + dx, y: at.y + dy }]));
  return { ...canvas, positions: by(canvas.positions), points: by(canvas.points) };
}

