// Boxes on the canvas, each by its centre and its size, in pixels of the
// canvas, with x to the right and y downwards.

export interface Box {
  // The box's centre.
  readonly x: number;
  readonly y: number;
  // Its width and its height.
  readonly w: number;
  readonly h: number;
}

// The smallest box that holds every box given, or undefined for none.
export function bounds(boxes: Iterable<Box>): Box | undefined {
  let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const box of boxes) {
    left = Math.min(left, box.x - box.w / 2);
    right = Math.max(right, box.x + box.w / 2);
    top = Math.min(top, box.y - box.h / 2);
    bottom = Math.max(bottom, box.y + box.h / 2);
  }
  if (left === Infinity) return undefined;
  return { x: (left + right) / 2, y: (top + bottom) / 2, w: right - left, h: bottom - top };
}

// The box grown by `by` on every side.
export function padded(box: Box, by: number): Box {
  return { ...box, w: box.w + 2 * by, h: box.h + 2 * by };
}

// The box moved by dx and dy.
export function shifted(box: Box, dx: number, dy: number): Box {
  return { ...box, x: box.x + dx, y: box.y + dy };
}

// How far apart two boxes sit along each axis, which is less than 0 along an
// axis along which they overlap.
export function apart(a: Box, b: Box): { readonly x: number; readonly y: number } {
  return { x: Math.abs(a.x - b.x) - (a.w + b.w) / 2, y: Math.abs(a.y - b.y) - (a.h + b.h) / 2 };
}

// The distance between the nearest points of two boxes, 0 where they meet.
export function distance(a: Box, b: Box): number {
  const { x, y } = apart(a, b);
  return Math.hypot(Math.max(0, x), Math.max(0, y));
}

// Whether two boxes come closer than `gap` along both axes, so that they
// overlap where the gap is 0.
export function overlaps(a: Box, b: Box, gap = 0): boolean {
  const { x, y } = apart(a, b);
  return x < gap - EPSILON && y < gap - EPSILON;
}

// How much closer than wanted two boxes may sit, as what rounding leaves.
const EPSILON = 1e-6;
