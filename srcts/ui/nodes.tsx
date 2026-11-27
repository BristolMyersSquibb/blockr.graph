// The DAG's nodes: a block, with its mark, its name below it, its status dot
// and its handles, and a stack, as a box behind its blocks or as the small box
// of a collapsed stack or of a stack that holds no block
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#nodes).
//
// - The mark is core's, 32 px across: the icon of the class's entry in the
//   block registry on a tint of its category's colour, which core's variables
//   give, as --bc-color-category-transform. A class that the registry lacks
//   takes the colour of a class without a category, and no icon.
// - The status dot sits on the mark's lower right corner, filled or a ring,
//   in core's colour of the status that it reads, with its tooltip
//   (./status-dot.ts). It follows the scheduler and the notifications of
//   CoreApi, and the DAG demands no block for it.
// - A handle sits where the node gives it (./elements.ts). While the pointer
//   is over a handle, the handle grows and takes the accent colour, the link
//   that feeds it shows as it does while the pointer is over the link, and
//   after a moment a tooltip names the input. A handle takes the pointer only
//   within its own size and a small margin around it.
// - A right click on the handle of an input opens the menu of the link that
//   feeds it, or where no link feeds it, the menu of the input, as
//   { block: "b", input: "y" }, or for a variadic block's placeholder
//   { block: "b", input: "" }, whatever the selection holds, since no
//   selection holds an input. A right click on a result's handle opens the
//   block's menu, as on the rest of the node.
// - Where more handles share a side than fit on the mark at full distance,
//   they crowd it, and the side spreads out while the pointer is over one of
//   them, so that each one is easy to hit (./graph.tsx).
// - A stack draws in the colour that core keeps on it, or in the colour of
//   borders where it has none, a default of the DAG's own. Its name sits above
//   its box, or inside the small box of a collapsed stack, with the number of
//   its blocks. A collapsed stack, and one with its box around its blocks,
//   has a button that collapses or expands it, as a double click on its box
//   does (./canvas.tsx).

import type { BlockId, RegistryEntry, Target } from "@blockr/core";
import { useNotified, useStatus } from "@blockr/core/react";
import { Button } from "@blockr/ui";
import { memo } from "react";
import type { CSSProperties, MouseEvent, ReactElement } from "react";
import { Handle } from "../flow/index.ts";
import type { NodeProps } from "../flow/index.ts";
import { useGraph } from "./context.ts";
import { HANDLE, positionOf } from "./elements.ts";
import type { BlockNode, HandleSpec, StackNode } from "./elements.ts";
import { objectOf } from "./ids.ts";
import { statusDot } from "./status-dot.ts";
import type { StatusDot } from "./status-dot.ts";
import { Tip } from "./tip.tsx";

// The category of a class that gives none, as R's registry names it.
const UNCATEGORIZED = "uncategorized";

// The category of a class, or uncategorized where it gives none or the
// registry lacks the class.
export function categoryOf(entry: RegistryEntry | undefined): string {
  return entry === undefined || entry.category === "" ? UNCATEGORIZED : entry.category;
}

// React Flow draws a node again whenever the DAG gives it a new node, which the
// DAG makes anew on every change, as on every step of a drag, so each node
// draws again only where what it draws has changed.
export const BlockNodeView = memo(DrawnBlock, sameNode);

export const StackNodeView = memo(DrawnStack, sameNode);

// Whether a node draws the same as before: whether it is selected, and what
// its data holds.
function sameNode(a: Readonly<NodeProps<BlockNode | StackNode>>, b: Readonly<NodeProps<BlockNode | StackNode>>): boolean {
  return a.selected === b.selected && sameValue(a.data, b.data);
}

// Whether two values of plain data are equal, those that are the same object
// at once, as the entry of a class in the block registry.
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, i) => sameValue(item, b[i]));
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null || Array.isArray(a) || Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => sameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
  );
}

function DrawnBlock({ id, data, selected }: NodeProps<BlockNode>): ReactElement {
  const { core } = useGraph();
  const status = useStatus(core, data.block);
  const notified = useNotified(core, { block: data.block });
  const dot = statusDot(status, notified);
  return (
    <div className="blockr-graph-block" data-selected={selected ? "" : undefined}>
      <span className="blockr-graph-mark-frame">
        <span
          className="blockr-graph-mark"
          data-category={categoryOf(data.entry)}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: data.entry?.icon ?? "" }}
        />
        {dot === null ? null : <Dot dot={dot} />}
      </span>
      <span className="blockr-graph-name">{data.name}</span>
      {data.handles.map((handle) => (
        <GraphHandle key={handle.id} node={id} handle={handle} />
      ))}
    </div>
  );
}

function Dot({ dot }: { dot: StatusDot }): ReactElement {
  return (
    <Tip label={dot.tooltip}>
      <span
        className="blockr-graph-dot"
        data-status={dot.status}
        data-ring={dot.ring ? "" : undefined}
        role="img"
        aria-label={dot.tooltip}
      />
    </Tip>
  );
}

function GraphHandle({ node, handle }: { node: string; handle: HandleSpec }): ReactElement {
  const { enter, leave, actions } = useGraph();
  const style: CSSProperties = { left: handle.x, top: handle.y, width: HANDLE, height: HANDLE };
  const object = objectOf(node);
  const target = object !== undefined && "block" in object ? handleTarget(object.block, handle) : undefined;
  return (
    <Tip label={handle.label}>
      <Handle
        id={handle.id}
        type={handle.type}
        position={positionOf(handle.side)}
        isConnectable={handle.connectable}
        className="blockr-graph-handle"
        style={style}
        role="button"
        aria-label={handle.label}
        data-crowded={handle.crowded ? "" : undefined}
        onPointerEnter={() => {
          enter({ node, side: handle.side, ...(handle.link === undefined ? {} : { link: handle.link }), crowded: handle.crowded });
        }}
        onPointerLeave={leave}
        {...(target === undefined
          ? {}
          : {
              onContextMenu: (event: MouseEvent<HTMLDivElement>) => {
                event.preventDefault();
                event.stopPropagation();
                actions.menu(target, { x: event.clientX, y: event.clientY });
              },
            })}
      />
    </Tip>
  );
}

// The target of the menu of a block's handle: the link that feeds the input,
// the input where no link feeds it, or undefined for the block's result.
export function handleTarget(block: BlockId, handle: HandleSpec): Target | undefined {
  if (handle.type === "source") return undefined;
  if (handle.link !== undefined) return { link: handle.link };
  return handle.input === undefined ? undefined : { block, input: handle.input };
}

function DrawnStack({ data, selected }: NodeProps<StackNode>): ReactElement {
  const { core } = useGraph();
  const color = data.color ?? "var(--bk-color-border)";
  const count = `${String(data.count)} ${data.count === 1 ? "block" : "blocks"}`;
  const collapse =
    data.shows === "empty" ? null : (
      <Button
        variant="quiet"
        className="blockr-graph-collapse nodrag"
        aria-label={data.shows === "collapsed" ? `Expand ${data.name}` : `Collapse ${data.name}`}
        onPress={() => {
          void core.commands.run("blockr.graph-collapse_stack", { stack: data.stack, collapsed: data.shows !== "collapsed" });
        }}
      >
        <Chevron collapsed={data.shows === "collapsed"} />
      </Button>
    );
  return (
    <div
      className="blockr-graph-stack"
      data-shows={data.shows}
      data-selected={selected ? "" : undefined}
      style={{ "--blockr-graph-stack-color": color } as CSSProperties}
    >
      {data.shows === "expanded" ? (
        <>
          <span className="blockr-graph-stack-name">{data.name}</span>
          {collapse}
        </>
      ) : (
        <>
          <span className="blockr-graph-stack-title">
            <span className="blockr-graph-stack-label">{data.name}</span>
            <span className="blockr-graph-stack-count">{count}</span>
          </span>
          {collapse}
          {data.handles.map((handle) => (
            <Handle
              key={handle.id}
              id={handle.id}
              type={handle.type}
              position={positionOf(handle.side)}
              isConnectable={false}
              className="blockr-graph-handle blockr-graph-stack-handle"
              style={{ left: handle.x, top: handle.y, width: HANDLE, height: HANDLE }}
            />
          ))}
        </>
      )}
    </div>
  );
}

// The chevron of the button that collapses a stack, which points down while
// the stack is expanded and to the right while it is collapsed.
function Chevron({ collapsed }: { collapsed: boolean }): ReactElement {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden="true" data-collapsed={collapsed ? "" : undefined}>
      <path d="M3 4.5 L6 7.5 L9 4.5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
