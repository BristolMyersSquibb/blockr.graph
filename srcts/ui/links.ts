// What a link that the user draws by dragging does, as the user drops it on a
// handle (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#gestures):
//
// - From a block's result to an input of another block, or from an input to a
//   result, it runs blockr.core-add_link for the input whose handle takes the
//   link. The DAG checks nothing itself, and leaves to the command's preflight
//   to refuse a link that would close a cycle, join a block to itself or feed
//   an input that a link feeds already.
// - Dropped on a variadic block's placeholder, it takes the block's next place,
//   through an empty input.
// - Dropped on a variadic block's place that a link holds, it adds nothing,
//   and the DAG says that the place is taken, as the preflight says of an
//   input that a link feeds.
// - Dropped on the canvas, away from every node and stack, it triggers Append
//   block from a block's result, or Prepend block on the input that it came
//   from, or on a variadic block's next place, through their roles. Dropped
//   on a node or on a stack's box, away from its handles, it adds nothing, as
//   today's does.

import type { BlockId, Json, Target } from "@blockr/core";
import type { Point } from "../state/index.ts";
import type { GraphNode } from "./elements.ts";
import { objectOf } from "./ids.ts";

// The two ends of a dropped link, by the ids of their nodes in React Flow,
// with the handle that takes the link on the node that the link feeds.
export interface DroppedLink {
  readonly source: string;
  readonly target: string;
  readonly targetHandle: string;
}

// The args of blockr.core-add_link for the link, or why the DAG adds none.
export type LinkDrop = { readonly add: Readonly<Record<string, Json>> } | { readonly taken: string };

// What the link dropped between the ends given does, or undefined where it
// joins no two blocks, as at a collapsed stack's box.
export function linkDrop(nodes: readonly GraphNode[], { source, target, targetHandle }: DroppedLink): LinkDrop | undefined {
  const from = objectOf(source);
  const to = objectOf(target);
  const node = nodes.find((each) => each.id === target);
  if (from === undefined || to === undefined || !("block" in from) || !("block" in to) || node?.data.kind !== "block") return undefined;
  const handle = node.data.handles.find((each) => each.id === targetHandle);
  if (handle === undefined) return undefined;
  if (handle.input === undefined) return { taken: takenPlace(handle.link ?? "", handle.name, to.block) };
  return { add: { from: from.block, to: to.block, ...(handle.input === "" ? {} : { input: handle.input }) } };
}

function takenPlace(link: string, place: string, block: BlockId): string {
  return `The link "${link}" feeds the place "${place}" of block "${block}" already.`;
}

// What a link that the user dropped on the canvas triggers: the role, its
// target and the drop on the screen, or undefined where the link was dropped
// on a node, came from no block, or came from a variadic block's place that a
// link holds.
export function canvasDrop(
  event: MouseEvent | TouchEvent,
  nodes: readonly GraphNode[],
  from: string,
  handle: { readonly id?: string | null; readonly type: "source" | "target" } | null,
): { readonly role: string; readonly target: Target; readonly client: Point } | undefined {
  const client = clientOf(event);
  if (client === undefined || handle === null) return undefined;
  if (document.elementFromPoint(client.x, client.y)?.closest(".react-flow__node") != null) return undefined;
  const object = objectOf(from);
  const node = nodes.find((each) => each.id === from);
  if (object === undefined || !("block" in object) || node?.data.kind !== "block") return undefined;
  if (handle.type === "source") return { role: "append_block_role", target: { block: object.block }, client };
  const input = node.data.handles.find((each) => each.id === handle.id)?.input;
  return input === undefined ? undefined : { role: "prepend_block_role", target: { block: object.block, input }, client };
}

// Where the pointer or the touch was as the event ended a drag, on the screen.
function clientOf(event: MouseEvent | TouchEvent): Point | undefined {
  if ("changedTouches" in event) {
    const touch = event.changedTouches[0];
    return touch === undefined ? undefined : { x: touch.clientX, y: touch.clientY };
  }
  return { x: event.clientX, y: event.clientY };
}
