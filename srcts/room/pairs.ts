// Finding the pairs of nodes that sit close to each other, without comparing
// every two of them: a sweep along x, from the node whose box starts furthest
// left, which compares each node only with those whose boxes start before
// its own ends.

import type { Box } from "../geometry/index.ts";

// The pairs of boxes that come closer than `reach` along both axes, each once,
// as [i, j] with i < j, ordered by i, then j.
// A pair that it gives may still sit further apart than `reach`, along the
// diagonal, so a caller checks the distance that it needs.
export function closePairs(boxes: readonly Box[], reach: number): [number, number][] {
  const left = boxes.map((box) => box.x - box.w / 2);
  const order = boxes.map((_, i) => i).sort((i, j) => (left[i] ?? 0) - (left[j] ?? 0) || i - j);
  const pairs: [number, number][] = [];
  for (const [k, i] of order.entries()) {
    const a = boxes[i];
    if (a === undefined) continue;
    const end = a.x + a.w / 2 + reach;
    for (let m = k + 1; m < order.length; m++) {
      const j = order[m] ?? i;
      const b = boxes[j];
      if (b === undefined || (left[j] ?? 0) >= end) break;
      if (Math.abs(a.y - b.y) - (a.h + b.h) / 2 < reach) pairs.push(i < j ? [i, j] : [j, i]);
    }
  }
  return pairs.sort(([i1, j1], [i2, j2]) => i1 - i2 || j1 - j2);
}
