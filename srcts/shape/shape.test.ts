// The shape that the DAG draws an expanded stack as, which Bubble Sets draw,
// on boards built for each case. A block whose name is one letter has a node
// 32 px across and 52 px tall, so the padding of 20 px around it reaches
// 36 px from its middle across and 46 px up and down.

import { describe, expect, test } from "vitest";
import { canvasOf, NO_CHANGES } from "../geometry/index.ts";
import type { Changes } from "../geometry/index.ts";
import { boardOf, stateOf } from "../testing/index.ts";
import type { BoardSpec } from "../testing/index.ts";
import { shapePath, stackShape, withinShape } from "./index.ts";
import type { Shape } from "./index.ts";

function shapeOf(spec: BoardSpec, moving: Changes = NO_CHANGES): Shape {
  const board = boardOf(spec);
  const shape = stackShape(canvasOf(board, stateOf(board)), "s", moving);
  if (shape === undefined) throw new Error("No shape");
  return shape;
}

const at = (x: number, y: number) => ({ x, y });

// The stack s holds p and q, 300 px apart, and block x, which s does not hold,
// lies between them.
const between: BoardSpec = {
  blocks: { p: "P", q: "Q", x: "X" },
  stacks: { s: ["p", "q"] },
  state: { positions: { p: at(0, 0), q: at(300, 0), x: at(150, 0) } },
};

describe("a stack's shape", () => {
  test("holds a block with the padding around it, with round corners", () => {
    const shape = shapeOf({ blocks: { a: "A" }, stacks: { s: ["a"] }, state: { positions: { a: at(0, 0) } } });
    for (const point of [at(0, 0), at(31, 0), at(-31, 0), at(0, 41), at(0, -41), at(26, 36)]) {
      expect(withinShape(shape, point), JSON.stringify(point)).toBe(true);
    }
    // Beyond the padding, and in the corner of the box around the padding.
    for (const point of [at(41, 0), at(0, 51), at(0, -51), at(34, 44)]) {
      expect(withinShape(shape, point), JSON.stringify(point)).toBe(false);
    }
  });

  test("leaves out a block that the stack does not hold, between two of its blocks, and holds both of them", () => {
    const shape = shapeOf(between);
    expect(withinShape(shape, at(150, 0))).toBe(false);
    expect(withinShape(shape, at(0, 0))).toBe(true);
    expect(withinShape(shape, at(300, 0))).toBe(true);
  });

  test("does not keep clear of a block that a drag moves", () => {
    const shape = shapeOf(between, { positions: { x: at(150, 0) }, points: {} });
    expect(withinShape(shape, at(150, 0))).toBe(true);
  });

  test("reaches a block apart from the others through a narrow strip, which leaves out what lies beside it", () => {
    // The example `stacks`, once Rbind joins Joins: Rbind lies far from the
    // other blocks of Joins, beyond Head.
    const shape = shapeOf({
      blocks: { iris: "Dataset", head: "Head", bound: "Rbind", bod: "Dataset", cw: "Dataset", joined: "Merge" },
      stacks: { s: ["bod", "cw", "joined", "bound"] },
      state: { positions: { iris: at(0, 0), head: at(0, 150), bound: at(0, 300), bod: at(300, 0), cw: at(450, 0), joined: at(375, 150) } },
    });
    for (const block of [at(300, 0), at(450, 0), at(375, 150), at(0, 300)]) expect(withinShape(shape, block)).toBe(true);
    for (const block of [at(0, 0), at(0, 150)]) expect(withinShape(shape, block)).toBe(false);
    // Halfway from Rbind to Merge, and 40 px off that line on either side.
    expect(withinShape(shape, at(187.5, 225))).toBe(true);
    expect(withinShape(shape, at(187.5, 185))).toBe(false);
    expect(withinShape(shape, at(187.5, 265))).toBe(false);
  });

  test("is the one that the DAG computed last for the same canvas", () => {
    expect(shapeOf(between)).toBe(shapeOf(between));
  });

  test("is none for a collapsed stack, nor for a stack that holds no block", () => {
    const board = boardOf({
      blocks: { a: "A" },
      stacks: { s: ["a"], t: [] },
      state: { positions: { a: at(0, 0) }, stacks: { s: { collapsed: 1, moved: { positions: {}, stacks: {} } }, t: at(300, 0) } },
    });
    const canvas = canvasOf(board, stateOf(board));
    expect(stackShape(canvas, "s")).toBeUndefined();
    expect(stackShape(canvas, "t")).toBeUndefined();
  });
});

describe("the path of a shape", () => {
  test("runs through its points from the origin, to a tenth of a pixel, and closes", () => {
    const shape = { points: [at(10, 20), at(30.04, 20), at(30, 40.06)] };
    expect(shapePath(shape, at(10, 10))).toBe("M0,10L20,10L20,30.1Z");
    expect(shapePath({ points: [] }, at(0, 0))).toBe("");
  });
});
