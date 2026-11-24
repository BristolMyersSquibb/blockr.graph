// The ids by which React Flow names the DAG's nodes and edges.
// An id of the board is unique only within its collection, so that a block
// and a stack may share one
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.1.1#ids).
// React Flow names every node by one id, so each id starts with the kind of
// what it names: "b:" for a block, "s:" for a stack and "l:" for a link.

import type { BlockId, BoardObject, LinkId, StackId } from "@blockr/core";

export function blockNode(block: BlockId): string {
  return `b:${block}`;
}

export function stackNode(stack: StackId): string {
  return `s:${stack}`;
}

export function linkEdge(link: LinkId): string {
  return `l:${link}`;
}

// The board object that a node or an edge draws, or undefined for an id that
// none of the functions above gave.
export function objectOf(id: string): BoardObject | undefined {
  const rest = id.slice(2);
  if (id.startsWith("b:")) return { block: rest };
  if (id.startsWith("s:")) return { stack: rest };
  if (id.startsWith("l:")) return { link: rest };
  return undefined;
}

// The id of the node or the edge that draws a block, a stack or a link, or
// undefined for another board object, which the DAG does not draw.
export function idOf(object: BoardObject): string | undefined {
  if ("block" in object) return blockNode(object.block);
  if ("stack" in object) return stackNode(object.stack);
  if ("link" in object) return linkEdge(object.link);
  return undefined;
}
