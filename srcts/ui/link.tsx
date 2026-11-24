// The DAG's link: a curve from the result of the block that it comes from into
// the handle of the input that it feeds, with an arrow at its end, as today's
// link has, and the input's name on the curve while the pointer is over it
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#links).
// Its handles sit on the sides of the two marks that face each other
// (./elements.ts), so the curve leaves and enters the marks there.
// The curve ends at the arrow's base, and the arrow's tip meets the handle,
// so that the curve's stroke shows nowhere under the tip.

import { memo } from "react";
import type { ReactElement } from "react";
import { BaseEdge, getBezierPath, Position } from "../flow/index.ts";
import type { EdgeProps } from "../flow/index.ts";
import type { GraphEdge } from "./elements.ts";

// How long the arrow is, and how wide its base.
const ARROW = 8;

// The way from the target's side out of the node, along which the arrow
// points into it.
const OUTWARD: Readonly<Record<Position, readonly [number, number]>> = {
  [Position.Top]: [0, -1],
  [Position.Right]: [1, 0],
  [Position.Bottom]: [0, 1],
  [Position.Left]: [-1, 0],
};

// React Flow draws a link again whenever the DAG gives it a new edge, which the
// DAG makes anew on every change, so each link draws again only where its ends
// or its label have changed.
export const LinkView = memo(DrawnLink, (a, b) =>
  a.sourceX === b.sourceX &&
  a.sourceY === b.sourceY &&
  a.targetX === b.targetX &&
  a.targetY === b.targetY &&
  a.sourcePosition === b.sourcePosition &&
  a.targetPosition === b.targetPosition &&
  a.data?.label === b.data?.label,
);

function DrawnLink({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  data,
}: EdgeProps<GraphEdge>): ReactElement {
  const [ox, oy] = OUTWARD[targetPosition];
  const [baseX, baseY] = [targetX + ox * ARROW, targetY + oy * ARROW];
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX: baseX,
    targetY: baseY,
    targetPosition,
  });
  // The arrow's corners: its tip at the handle, and its base across the way
  // that it points.
  const [px, py] = [-oy * (ARROW / 2), ox * (ARROW / 2)];
  const arrow = `M${String(targetX)},${String(targetY)} L${String(baseX + px)},${String(baseY + py)} L${String(baseX - px)},${String(baseY - py)} Z`;
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        labelX={labelX}
        labelY={labelY}
        label={data?.label}
        labelShowBg
        labelBgPadding={[4, 2]}
        labelBgBorderRadius={4}
        interactionWidth={16}
      />
      <path className="blockr-graph-arrow" d={arrow} />
    </>
  );
}
