// The selection, which the DAG draws from core.selection, whoever set it, and
// sets as the user selects in it
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#gestures).
// The DAG names each node and edge by its id in React Flow (./ids.ts), and
// core.selection holds board objects.
//
// - React Flow reports a click, a rectangle and the keyboard as changes that
//   select or unselect its nodes and edges. The DAG applies them to the
//   selection that it draws and puts the result into core.selection.
// - A change that unselects something replaces what core.selection holds
//   beyond what the DAG draws, as a click without Cmd or Ctrl does, while a
//   change that only adds keeps it, as a click with Cmd or Ctrl does.
// - React Flow's rectangle selects every link of each node that it covers,
//   links to nodes outside it among them, so the DAG keeps only the links
//   whose two nodes the rectangle covers.
// - Where the user selects one block alone, the DAG shows it through
//   core.show(), while a selection of several shows none, and neither does a
//   selection of a link or a stack.
// - A right click on an object of a selection of several opens the
//   selection's menu, rather than the object's.

import type { BlockId, BoardObject, Target } from "@blockr/core";
import { idOf, objectOf } from "./ids.ts";

// A change that React Flow reports, of whether a node or an edge is selected.
export interface SelectChange {
  readonly id: string;
  readonly selected: boolean;
}

// An edge, by its id and the ids of its two nodes.
export interface EdgeEnds {
  readonly id: string;
  readonly source: string;
  readonly target: string;
}

// The ids of the nodes and the edges that draw what the selection holds.
export function selectedIds(objects: readonly BoardObject[]): Set<string> {
  return new Set(objects.flatMap((object) => idOf(object) ?? []));
}

// The selection that the changes leave of `current`, which core.selection
// holds: what the DAG draws, as the changes leave it selected, and what it does
// not draw, which stays only where no change unselects anything.
// Where the user draws a rectangle, only the edges whose two nodes the
// selection holds stay selected.
// The board objects keep their order, and those that the changes select come
// after them, in the order of the changes.
export function selectionAfter(
  current: readonly BoardObject[],
  drawn: ReadonlySet<string>,
  changes: readonly SelectChange[],
  rectangle?: { readonly edges: readonly EdgeEnds[] },
): BoardObject[] {
  const additive = changes.every((change) => change.selected);
  const ids = new Map<string, BoardObject>();
  for (const object of current) {
    const id = idOf(object);
    const kept = id !== undefined && drawn.has(id) ? true : additive;
    if (kept) ids.set(id ?? `other:${JSON.stringify(object)}`, object);
  }
  for (const { id, selected } of changes) {
    const object = objectOf(id);
    if (object === undefined) continue;
    if (selected) ids.set(id, object);
    else ids.delete(id);
  }
  if (rectangle !== undefined) {
    for (const edge of rectangle.edges) {
      if (ids.has(edge.id) && !(ids.has(edge.source) && ids.has(edge.target))) ids.delete(edge.id);
    }
  }
  return [...ids.values()];
}

// Whether two selections hold the same board objects, in any order.
export function sameSelection(a: readonly BoardObject[], b: readonly BoardObject[]): boolean {
  if (a.length !== b.length) return false;
  const keys = new Set(a.map((object) => JSON.stringify(object)));
  return b.every((object) => keys.has(JSON.stringify(object)));
}

// The target of the menu that a right click on a board object opens: the
// selection, where the object is one of several that the user selected, and
// otherwise the object alone.
export function menuTarget(object: BoardObject, selection: readonly BoardObject[]): Target {
  const key = JSON.stringify(object);
  return selection.length > 1 && selection.some((each) => JSON.stringify(each) === key) ? { selection } : object;
}

// The block that the selection shows: its block, where it holds one block
// alone, or undefined.
export function shownBlock(objects: readonly BoardObject[]): BlockId | undefined {
  const [only] = objects;
  return objects.length === 1 && only !== undefined && "block" in only ? only.block : undefined;
}
