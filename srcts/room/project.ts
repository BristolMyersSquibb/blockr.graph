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
// - A stack that moves as one is a node for each of its blocks, the block's
//   box with the padding, and those nodes move by one distance. So the nodes
//   around the stack keep the gap from the padding around each of its blocks,
//   which its shape holds, rather than from its box (../shape).
//   Where a node would have to keep the gap from two blocks of such a stack
//   on its two sides along one axis, which the stack cannot open up for, the
//   node keeps the gap from the stack's box instead, as it would from one
//   node.
// - The other nodes keep the gap from the padding around each block of an
//   expanded stack whose blocks move one by one.
//
// Each axis is one quadratic programme, which VPSC solves exactly, so the
// same nodes give the same places wherever the DAG runs. Each constraint
// orders its two nodes as they sat, and the nodes of a stack that moves as
// one keep where they sat against each other. So VPSC keeps every constraint,
// but where a chain of other nodes lies between two blocks of one stack
// along an axis, with too little room for them all. There it leaves a node
// closer than the gap. After it, the DAG adds a constraint for each two
// nodes that have come within the gap of each other, and solves again, up to
// eight times. Then it averages each node's move with the mean move of the
// nodes within two gaps of it and projects once more from there, so that the
// moves taper off rather than stop at the last node that had to move.

import { apart, bounds, distance, STACK_PADDING } from "../geometry/index.ts";
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
  // The expanded stack that holds it, for a block in one, or null.
  readonly holder: string | null;
  // Whether it moves as one with the other nodes of its holder, as the box of
  // a block with the padding, rather than on its own within the padding.
  readonly asOne?: boolean;
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
  const at = (axis: Axis, i: number) => body(i)[axis];
  const goal = { x: targets.map((t, i) => (isFixed(i) ? body(i).x : t.x)), y: targets.map((t, i) => (isFixed(i) ? body(i).y : t.y)) };
  const now = { x: bodies.map((b) => b.x), y: bodies.map((b) => b.y) };

  // The stack that moves as one of which a body is a block, or null, and
  // the bodies of each such stack, with the box around them where they sat.
  const groupOf = (i: number) => (body(i).asOne === true ? body(i).holder : null);
  const together = (i: number, j: number) => groupOf(i) !== null && groupOf(i) === groupOf(j);
  const groups = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const group = groupOf(i);
    if (group !== null) groups.set(group, [...(groups.get(group) ?? []), i]);
  }
  const groupBoxes = new Map([...groups].map(([group, of]) => [group, bounds(of.map((i) => sat[i] ?? NONE)) ?? NONE]));

  // What two bodies keep between their centres along the axis: half their
  // sizes, the gap, and the padding around a block that moves on its own in
  // an expanded stack, where only one of them sits in that stack.
  const pad = (i: number) => (body(i).holder === null || body(i).asOne === true ? 0 : STACK_PADDING);
  const need = (i: number, j: number, axis: Axis) => {
    const [a, b] = [body(i), body(j)];
    const size = axis === "x" ? a.w + b.w : a.h + b.h;
    const padding = a.holder !== null && a.holder === b.holder ? 0 : pad(i) + pad(j);
    return size / 2 + gap + padding;
  };

  // The order of the bodies along each axis, by where they sit, which gives
  // each constraint its direction.
  const rank = { x: ranks(bodies.map((b) => b.x)), y: ranks(bodies.map((b) => b.y)) };
  const before = (axis: Axis, i: number, j: number) => (rank[axis][i] ?? 0) < (rank[axis][j] ?? 0);
  const constraints = { x: new Map<number, number>(), y: new Map<number, number>() };
  const key = (axis: Axis, i: number, j: number) => (before(axis, i, j) ? i * n + j : j * n + i);
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

  // The bodies that keep the gap from the box of a stack that moves as one,
  // rather than from its blocks, each by `${body}:${stack}`.
  const boxed = new Set<string>();

  // Whether the constraints along the axis between the body and the blocks
  // of the stack leave the body a place, while the blocks keep where they
  // sat against each other. The body must lie past each block before it by
  // what it keeps from that block, and short of each block after it by what
  // it keeps from that one.
  const fits = (i: number, group: string, axis: Axis): boolean => {
    let [least, most] = [-Infinity, Infinity];
    for (const j of groups.get(group) ?? []) {
      const sep = constraints[axis].get(key(axis, i, j));
      if (sep === undefined) continue;
      if (before(axis, j, i)) least = Math.max(least, at(axis, j) + sep);
      else most = Math.min(most, at(axis, j) - sep);
    }
    return least <= most + SLACK;
  };

  // Makes the body keep the gap from the box of the stack, as it would from
  // one node, in place of what it keeps from each of the stack's blocks.
  // - It keeps its order with the box's centre along each axis along which it
  //   sat at least half a gap from that centre.
  // - It stays apart from the box along the other axis than the one along
  //   which the blocks hold it, on the side of the box's centre on which it
  //   sat.
  // The constraints hold between the body and the stack's first block, which
  // the box moves with.
  const box = (i: number, group: string, held: Axis) => {
    boxed.add(`${String(i)}:${group}`);
    const of = groups.get(group) ?? [];
    for (const j of of) {
      for (const axis of AXES) constraints[axis].delete(key(axis, i, j));
    }
    const [first] = of;
    const around = groupBoxes.get(group);
    if (first === undefined || around === undefined) return;
    const order = (axis: Axis, sep: number) => {
      const off = around[axis] - at(axis, first);
      const after = at(axis, i) > around[axis] || (at(axis, i) === around[axis] && i > first);
      if (after) constraints[axis].set(first * n + i, Math.max(constraints[axis].get(first * n + i) ?? -Infinity, off + sep));
      else constraints[axis].set(i * n + first, Math.max(constraints[axis].get(i * n + first) ?? -Infinity, sep - off));
    };
    const axis: Axis = held === "x" ? "y" : "x";
    const off = apart(sat[i] ?? NONE, around);
    const push = body(i).fixed ?? body(first).fixed;
    const full = push === "all" || (push === "inside" && off.x < 0 && off.y < 0);
    const size = axis === "x" ? body(i).w + around.w : body(i).h + around.h;
    const want = size / 2 + gap + pad(i);
    const had = Math.abs(at(axis, i) - around[axis]);
    order(axis, full ? want : Math.min(want, had));
    if (isFixed(i) || isFixed(first)) return;
    for (const along of AXES) {
      if (Math.abs(at(along, i) - around[along]) >= gap / 2) order(along, gap / 2);
    }
  };

  // Where the body would have to keep the gap from two blocks of a stack
  // that moves as one on its two sides along one axis, it keeps the gap from
  // the stack's box instead. It gives whether it does.
  const check = (i: number, j: number): boolean => {
    const group = groupOf(j);
    if (group === null || groupOf(i) === group || boxed.has(`${String(i)}:${group}`)) return false;
    const held = AXES.find((axis) => !fits(i, group, axis));
    if (held === undefined) return false;
    box(i, group, held);
    return true;
  };

  // Whether a constraint between the two bodies comes from the box of a stack
  // that moves as one, which one of them keeps the gap from.
  const viaBox = (i: number, j: number) => {
    const [gi, gj] = [groupOf(i), groupOf(j)];
    return (gj !== null && boxed.has(`${String(i)}:${gj}`)) || (gi !== null && boxed.has(`${String(j)}:${gi}`));
  };

  // The bodies within two gaps of each other, which keep their order and stay
  // apart, but for the blocks of a stack that moves as one, which keep where
  // they sat against each other.
  const near: number[][] = bodies.map(() => []);
  const pairs: [number, number][] = [];
  for (const [i, j] of closePairs(sat, 2 * gap)) {
    if ((isFixed(i) && isFixed(j)) || together(i, j)) continue;
    if (distance(sat[i] ?? NONE, sat[j] ?? NONE) >= 2 * gap) continue;
    near[i]?.push(j);
    near[j]?.push(i);
    pairs.push([i, j]);
    const { axis, sep } = separation(i, j);
    keep(axis, i, j, sep);
    if (isFixed(i) || isFixed(j)) continue;
    for (const ordered of AXES) {
      if (Math.abs(at(ordered, i) - at(ordered, j)) >= gap / 2) keep(ordered, i, j, gap / 2);
    }
  }
  for (const [i, j] of pairs) {
    check(i, j);
    check(j, i);
  }

  const solve = (axis: Axis) => {
    const vars = bodies.map((_, i) => new Variable(goal[axis][i] ?? 0, isFixed(i) ? FIXED_WEIGHT : 1));
    const held = [...constraints[axis]].flatMap(([k, sep]) => {
      const [left, right] = [vars[Math.floor(k / n)], vars[k % n]];
      return left === undefined || right === undefined ? [] : [new Constraint(left, right, sep)];
    });
    for (const of of groups.values()) {
      const [first] = of;
      if (first === undefined || isFixed(first)) continue;
      for (const j of of.slice(1)) {
        const [left, right] = before(axis, first, j) ? [first, j] : [j, first];
        const [a, b] = [vars[left], vars[right]];
        if (a !== undefined && b !== undefined) held.push(new Constraint(a, b, at(axis, right) - at(axis, left), true));
      }
    }
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
        if ((isFixed(i) && isFixed(j)) || together(i, j) || viaBox(i, j)) continue;
        const close = AXES.every((axis) => Math.abs((now[axis][i] ?? 0) - (now[axis][j] ?? 0)) < need(i, j, axis) - SLACK);
        if (!close) continue;
        const { axis, sep } = separation(i, j);
        if (kept(axis, i, j) >= sep - SLACK) continue;
        keep(axis, i, j, sep);
        added++;
        check(i, j);
        check(j, i);
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
