// Making room: the sweep that finds the pairs of close nodes, the projection,
// and Repulsion on the spike's layered boards, against the criteria that the
// spike fixed before it ran
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3, notes).

import type { Board } from "@blockr/core";
import { id } from "@blockr/core/stubs";
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
      blocks: { ...laid.blocks, added: { registry_id: id("blockr.core", "head_block"), state: {}, name: "Filter rows", locked: null } },
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
