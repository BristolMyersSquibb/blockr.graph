// Making room: the sweep that finds the pairs of close nodes, the projection,
// and Repulsion on the spike's layered boards, against the criteria that the
// spike fixed before it ran
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3, notes).

import type { Board } from "@blockr/core";
import { beforeAll, describe, expect, test } from "vitest";
import { blockBox, canvasOf, changed, distance, gapOf } from "../geometry/index.ts";
import type { Box } from "../geometry/index.ts";
import { layOut, loadDagre } from "../layout/index.ts";
import type { Dagre } from "../layout/index.ts";
import type { Layout } from "../state/index.ts";
import { intruders, layeredBoard, lcg, newlyClose, reshaped, SHAPES, stackSpecs, stateOf, swapped, withStacks, withState } from "../testing/index.ts";
import { closePairs, makeRoom, project } from "./index.ts";

describe("the sweep", () => {
  test("finds the pairs that comparing every two boxes finds", () => {
    const random = lcg(3);
    const boxes: Box[] = Array.from({ length: 200 }, () => ({
      x: random() * 2000,
      y: random() * 1500,
      w: 20 + random() * 160,
      h: 20 + random() * 60,
    }));
    const every: [number, number][] = [];
    for (const [i, a] of boxes.entries()) {
      for (const [j, b] of boxes.entries()) {
        const apart = [Math.abs(a.x - b.x) - (a.w + b.w) / 2, Math.abs(a.y - b.y) - (a.h + b.h) / 2];
        if (i < j && (apart[0] ?? 0) < 140 && (apart[1] ?? 0) < 140) every.push([i, j]);
      }
    }
    expect(closePairs(boxes, 140)).toEqual(every);
  });
});

describe("the projection", () => {
  const gap = 70;

  test("pushes a node that lies within the gap of a fixed node that pushes all out to the gap", () => {
    const [moved] = project(
      [
        { x: 40, y: 0, w: 32, h: 52, holder: null },
        { x: 0, y: 0, w: 32, h: 52, holder: null, fixed: "all" },
      ],
      [{ x: 40, y: 0 }, { x: 0, y: 0 }],
      gap,
    );
    expect(moved?.x).toBeCloseTo(32 + gap);
    expect(moved?.y).toBeCloseTo(0);
  });

  test("keeps what two nodes had where a fixed node pushes none", () => {
    const [moved] = project(
      [
        { x: 40, y: 0, w: 32, h: 52, holder: null },
        { x: 0, y: 0, w: 32, h: 52, holder: null, fixed: "none" },
      ],
      [{ x: 0, y: 0 }, { x: 0, y: 0 }],
      gap,
    );
    expect(moved?.x).toBeCloseTo(40);
  });

  // The box of a block whose name is one letter, 32 by 52 px, with the
  // padding of 20 px around it, in a stack that moves as one.
  const padded = (x: number, y: number) => ({ x, y, w: 72, h: 92, holder: "s", asOne: true });
  const pusher = (x: number, y: number) => ({ x, y, w: 32, h: 52, holder: null, fixed: "all" as const });

  test("moves the blocks of a stack that moves as one by one distance", () => {
    const bodies = [padded(0, 0), padded(0, 150), pusher(-60, 0)];
    const [first, second] = project(bodies, bodies, gap);
    // The fixed node pushes the first block to the gap beside it, 16 + 70 +
    // 36 = 122 px from its middle, and the second block moves with it.
    expect(first?.x).toBeCloseTo(-60 + 122);
    expect(second?.x).toBeCloseTo(first?.x ?? 0);
    expect([first?.y, second?.y]).toEqual([0, 150]);
  });

  test("keeps the gap from the padding around each block of a stack that moves as one, rather than from the stack's box", () => {
    // The blocks of the stack form an L, and the fixed node lies in the
    // corner of the L, in the stack's box, but a gap from each block's
    // padding.
    const bodies = [padded(0, 0), padded(0, 200), padded(200, 200), pusher(200, 0)];
    const places = project(bodies, bodies, gap);
    expect(places.slice(0, 3)).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 200 },
      { x: 200, y: 200 },
    ]);
  });

  test("keeps the gap from the box of a stack that moves as one, where a node lies between two of its blocks, too close to both", () => {
    // The fixed node lies halfway between the stack's two blocks, which sit
    // 244 px apart, so it would take 2 * (26 + 70 + 46) = 284 px to keep the
    // gap from both. The stack moves aside instead, by 16 + 70 + 36 = 122 px.
    const bodies = [padded(0, 0), padded(0, 244), pusher(0, 122)];
    const [first, second] = project(bodies, bodies, gap);
    expect(Math.abs(first?.x ?? 0)).toBeCloseTo(122);
    expect(second?.x).toBeCloseTo(first?.x ?? 0);
    expect([first?.y, second?.y]).toEqual([0, 244]);
  });

  test("keeps two nodes in their order along an axis along which they sat apart", () => {
    const places = project(
      [
        { x: 0, y: 0, w: 32, h: 52, holder: null },
        { x: 200, y: 0, w: 32, h: 52, holder: null },
      ],
      [{ x: 300, y: 0 }, { x: 200, y: 0 }],
      gap,
    );
    expect((places[1]?.x ?? 0) - (places[0]?.x ?? 0)).toBeGreaterThanOrEqual(32 + gap - 0.5);
  });
});

describe("making room for what Repulsion places", () => {
  let dagre: Dagre;
  beforeAll(async () => {
    dagre = await loadDagre();
  });

  // A board of the shape, with its stacks, laid out with the layout.
  function laidOut(shape: keyof typeof SHAPES, layout: Layout): Board {
    const plain = layeredBoard({ ...SHAPES[shape], seed: 11 });
    const first = layOut(dagre, canvasOf(plain, stateOf(plain)), layout);
    const stacked = withStacks(plain, stackSpecs(Object.keys(plain.blocks).length), first.positions);
    const laid = layOut(dagre, canvasOf(stacked, stateOf(stacked)), layout);
    return withState(stacked, { positions: laid.positions, layout });
  }

  test.each([
    ["square", "TB"],
    ["square", "LR"],
    ["wide", "TB"],
    ["deep", "LR"],
  ] as const)("on a %s board laid out %s, beside the most crowded block", (shape, direction) => {
    const layout: Layout = { direction, spacing: "normal", placement: "repulsion", snap: false, snap_size: 20 };
    const gap = gapOf("normal");
    const laid = laidOut(shape, layout);
    const state = stateOf(laid);
    const before = canvasOf(laid, state);
    const held = new Set(Object.values(laid.stacks).flatMap((stack) => stack.blocks));
    const box = (block: string) => blockBox(state.positions[block] ?? { x: 0, y: 0 }, laid.blocks[block]?.name ?? "");
    const crowd = (block: string) => Object.keys(laid.blocks).filter((other) => distance(box(block), box(other)) < 3 * gap).length;
    const [hub = "b0"] = Object.keys(laid.blocks)
      .filter((block) => !held.has(block))
      .sort((a, b) => crowd(b) - crowd(a));
    const at = state.positions[hub] ?? { x: 0, y: 0 };

    // The new block starts one rank past the hub, where the hub's other
    // targets sit, as the spike appended it.
    const board: Board = {
      ...laid,
      blocks: { ...laid.blocks, added: { registry_id: "blockr.core-head_block", state: {}, name: "Filter rows", locked: null } },
    };
    const start = direction === "TB" ? { x: at.x, y: at.y + 52 + gap } : { x: at.x + box(hub).w / 2 + gap + 40, y: at.y };
    const started = changed(canvasOf(board, state), { positions: { added: start }, points: {} });
    const changes = makeRoom(started, { blocks: new Set(["added"]), stacks: new Set() }, new Set(), gap);
    const after = changed(started, changes);

    expect(changes.positions.added).toBeUndefined();
    expect(newlyClose(before, after, gap)).toEqual([]);
    expect(intruders(after)).toEqual([]);
    expect(swapped(started, after, gap)).toEqual([]);
    expect(reshaped(started, after)).toEqual([]);
  });
});
