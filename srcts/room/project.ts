// The projection through which the DAG makes room
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#making-room):
// each node has a target, and the projection finds the places nearest the
// targets that keep what the board held. It is the spike's, which checked it
// against the criteria in the notes of Client-drawn DAG
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3).
//
// - Every two nodes within two gaps of each other keep their order along
//   each axis along which they sit at least half a gap apart, by at least
//   half a gap.
// - They stay apart along the axis along which they sit apart, by the
//   spacing's gap, or by what they had where they sat closer.
//   Two nodes that sit apart along both axes sit apart along the one along
//   which they are further apart.
// - A fixed node stays where it is, and pushes the nodes around it, as its
//   `fixed` says: "none" keeps what each had, "inside" pushes what lies in it
//   out to the gap, and "all" pushes all that lies within the gap of it.
// - No node comes into the box of a stack that it is not in.
//
// Each axis is one quadratic programme, which VPSC solves exactly, so the
// same nodes give the same places wherever the DAG runs. Each constraint
// orders its two nodes as they sat, so the constraints of an axis never form
// a cycle, and the projection always finds places. After it, the DAG adds a
// constraint for each two nodes that have come within the gap of each other,
// and for each node that has come into a stack's box, and solves again, up to
// eight times. Then it averages each node's move with the mean move of the
// nodes within two gaps of it and projects once more from there, so that the
// moves taper off rather than stop at the last node that had to move.

import { apart, bounds, distance, overlaps, padded, STACK_PADDING } from "../geometry/index.ts";
import type { Box } from "../geometry/index.ts";
import type { Point } from "../state/index.ts";
import { closePairs } from "./pairs.ts";
import { Constraint, Solver, Variable } from "./vendor.ts";

// What a fixed node pushes.
export type Push = "none" | "inside" | "all";

// A node of the projection.
export interface Body {
  // Where it sits, its box's centre, and its box's size.
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  // The expanded stack whose box holds it, for a block in one, or null.
  readonly holder: string | null;
  // Set for a node that stays where it sits, with what it pushes.
  readonly fixed?: Push;
}

// How many times the projection solves again for what came too close.
const ROUNDS = 8;
// How much more a fixed node weighs than one that moves.
const FIXED_WEIGHT = 1e6;
// How far within what it wants a constraint may fall, in pixels.
const SLACK = 0.5;

type Axis = "x" | "y";

// Where each body goes, in the order given, from the targets of the bodies
// that move. A fixed body's target is where it sits. The passes of
// `smoothing` average the moves.
export function project(bodies: readonly Body[], targets: readonly Point[], gap: number, smoothing = 1): Point[] {
  const n = bodies.length;
  const sat = bodies.map((body) => ({ x: body.x, y: body.y, w: body.w, h: body.h }));
  const body = (i: number): Body => bodies[i] ?? { x: 0, y: 0, w: 0, h: 0, holder: null };
  const isFixed = (i: number) => body(i).fixed !== undefined;
  const pad = (i: number) => (body(i).holder === null ? 0 : STACK_PADDING);
  const at = (axis: Axis, i: number) => body(i)[axis];
  const goal = { x: targets.map((t, i) => (isFixed(i) ? body(i).x : t.x)), y: targets.map((t, i) => (isFixed(i) ? body(i).y : t.y)) };
  const now = { x: bodies.map((b) => b.x), y: bodies.map((b) => b.y) };

  // What two bodies keep between their centres along the axis: half their
  // sizes, the gap, and the padding of a stack's box where only one of them
  // sits in that stack.
  const need = (i: number, j: number, axis: Axis) => {
    const [a, b] = [body(i), body(j)];
    const size = axis === "x" ? a.w + b.w : a.h + b.h;
    const padding = a.holder !== null && a.holder === b.holder ? 0 : pad(i) + pad(j);
    return size / 2 + gap + padding;
  };

  // The order of the bodies along each axis, by where they sit, which gives
  // each constraint its direction.
  const rank = { x: ranks(bodies.map((b) => b.x)), y: ranks(bodies.map((b) => b.y)) };
  const constraints = { x: new Map<number, number>(), y: new Map<number, number>() };
  const key = (axis: Axis, i: number, j: number) =>
    (rank[axis][i] ?? 0) < (rank[axis][j] ?? 0) ? i * n + j : j * n + i;
  const kept = (axis: Axis, i: number, j: number) => constraints[axis].get(key(axis, i, j)) ?? -Infinity;
  const keep = (axis: Axis, i: number, j: number, sep: number) => {
    constraints[axis].set(key(axis, i, j), Math.max(kept(axis, i, j), sep));
  };

  // What two bodies keep along the axis along which they sat apart.
  const separation = (i: number, j: number): { axis: Axis; sep: number } => {
    const off = apart(sat[i] ?? NONE, sat[j] ?? NONE);
    const axis: Axis = off.x >= off.y ? "x" : "y";
    const had = Math.abs(at(axis, i) - at(axis, j));
    const push = body(i).fixed ?? body(j).fixed;
    const full = push === "all" || (push === "inside" && off.x < 0 && off.y < 0);
    const want = need(i, j, axis);
    return { axis, sep: full ? want : Math.min(want, had) };
  };

  // The bodies within two gaps of each other, which keep their order and stay
  // apart.
  const near: number[][] = bodies.map(() => []);
  for (const [i, j] of closePairs(sat, 2 * gap)) {
    if (isFixed(i) && isFixed(j)) continue;
    if (distance(sat[i] ?? NONE, sat[j] ?? NONE) >= 2 * gap) continue;
    near[i]?.push(j);
    near[j]?.push(i);
    const { axis, sep } = separation(i, j);
    keep(axis, i, j, sep);
    if (isFixed(i) || isFixed(j)) continue;
    for (const ordered of AXES) {
      if (Math.abs(at(ordered, i) - at(ordered, j)) >= gap / 2) keep(ordered, i, j, gap / 2);
    }
  }

  // The bodies of each expanded stack that move, and the stack's box where
  // they sat.
  const members = new Map<string, number[]>();
  for (const [i, b] of bodies.entries()) {
    if (b.holder !== null && b.fixed === undefined) members.set(b.holder, [...(members.get(b.holder) ?? []), i]);
  }
  const boxOf = (of: readonly number[], where: (i: number) => Box) => padded(bounds(of.map(where)) ?? NONE, STACK_PADDING);
  const satBoxes = new Map([...members].map(([stack, of]) => [stack, boxOf(of, (i) => sat[i] ?? NONE)]));

  // Keeps a body that is not in the stack out of the stack's box: apart from
  // each of the stack's bodies along the axis along which it sat beside the
  // box, by what it needs, or by what it had where it sat closer. It gives how
  // many constraints it added.
  const guard = (stack: string, i: number): number => {
    const off = apart(sat[i] ?? NONE, satBoxes.get(stack) ?? NONE);
    const axis: Axis = off.x >= off.y ? "x" : "y";
    let added = 0;
    for (const j of members.get(stack) ?? []) {
      const sep = Math.min(need(i, j, axis), Math.abs(at(axis, i) - at(axis, j)));
      if (kept(axis, i, j) >= sep - SLACK) continue;
      keep(axis, i, j, sep);
      added++;
    }
    return added;
  };
  for (const [stack, box] of satBoxes) {
    for (let i = 0; i < n; i++) {
      if (body(i).holder !== stack && distance(sat[i] ?? NONE, box) < 2 * gap) guard(stack, i);
    }
  }

  const solve = (axis: Axis) => {
    const vars = bodies.map((_, i) => new Variable(goal[axis][i] ?? 0, isFixed(i) ? FIXED_WEIGHT : 1));
    const held = [...constraints[axis]].flatMap(([k, sep]) => {
      const [left, right] = [vars[Math.floor(k / n)], vars[k % n]];
      return left === undefined || right === undefined ? [] : [new Constraint(left, right, sep)];
    });
    new Solver(vars, held).solve();
    for (const [i, v] of vars.entries()) now[axis][i] = v.position();
  };

  const settle = () => {
    for (let round = 0; round < ROUNDS; round++) {
      solve("x");
      solve("y");
      const boxes = bodies.map((b, i) => ({ x: now.x[i] ?? b.x, y: now.y[i] ?? b.y, w: b.w, h: b.h }));
      let added = 0;
      for (const [i, j] of closePairs(boxes, gap + 2 * STACK_PADDING)) {
        if (isFixed(i) && isFixed(j)) continue;
        const close = AXES.every((axis) => Math.abs((now[axis][i] ?? 0) - (now[axis][j] ?? 0)) < need(i, j, axis) - SLACK);
        if (!close) continue;
        const { axis, sep } = separation(i, j);
        if (kept(axis, i, j) >= sep - SLACK) continue;
        keep(axis, i, j, sep);
        added++;
      }
      for (const [stack, of] of members) {
        const box = boxOf(of, (i) => boxes[i] ?? NONE);
        for (const [i, b] of boxes.entries()) {
          if (body(i).holder !== stack && overlaps(b, box)) added += guard(stack, i);
        }
      }
      if (added === 0) break;
    }
  };

  for (let pass = 0; pass <= smoothing; pass++) {
    if (pass > 0) {
      const moves = { x: now.x.map((x, i) => x - body(i).x), y: now.y.map((y, i) => y - body(i).y) };
      for (const [i, around] of near.entries()) {
        if (isFixed(i) || around.length === 0) continue;
        for (const axis of AXES) {
          const mean = around.reduce((sum, j) => sum + (moves[axis][j] ?? 0), 0) / around.length;
          goal[axis][i] = at(axis, i) + ((moves[axis][i] ?? 0) + mean) / 2;
        }
      }
    }
    settle();
  }

  return bodies.map((b, i) => ({ x: now.x[i] ?? b.x, y: now.y[i] ?? b.y }));
}

const AXES: readonly Axis[] = ["x", "y"];

// A box of no size, for an index that holds none.
const NONE: Box = { x: 0, y: 0, w: 0, h: 0 };

// The rank of each value among the values, ties by their order.
function ranks(values: readonly number[]): number[] {
  const order = values.map((_, i) => i).sort((i, j) => (values[i] ?? 0) - (values[j] ?? 0) || i - j);
  const rank = new Array<number>(values.length).fill(0);
  for (const [r, i] of order.entries()) rank[i] = r;
  return rank;
}
