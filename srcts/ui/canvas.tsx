// The DAG's canvas: React Flow, drawing the nodes and the edges that the board
// and the DAG's state give (./elements.ts), with the gestures that run no
// board action (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2):
//
// - The canvas draws from the board and the DAG's state alone, and follows
//   store.subscribe(), so that every change shows at once, whoever makes it.
//   The nodes that the user moves are the exception: while a drag or a run of
//   presses of the arrow keys lasts, the DAG keeps their new positions in its
//   component alone (./moves.ts).
// - As a drag ends, the DAG runs blockr.graph-change_position once, with
//   every block and every stack without blocks that moved, so that a drag is
//   one step. A block that the user drops on the box of another stack joins
//   that stack through blockr.core-change_stack, in the same step, but on a
//   locked board.
// - A run of presses of the arrow keys becomes one step once the user pauses,
//   or once the focus leaves the block.
// - A drag from a result to an input, or from an input to a result, draws a
//   link through blockr.core-add_link. The DAG checks nothing while the user
//   drags, and shows why the command was refused where the user dropped the
//   link, taking the command's notifications so that core raises none. A link
//   dropped on a variadic block's place that a link holds adds nothing, and
//   the DAG says that the place is taken.
// - A double click on a stack's box collapses or expands the stack.
// - The selection follows core.selection, and selecting one block alone shows
//   it through core.show() (./selection.ts).
// - The DAG fits the view to the board as it first mounts on a board, at most
//   at 100%, once the board's blocks have positions, and keeps the zoom and
//   the pan for the page (./view.ts).
// - React Flow's props are set as the notes of Drawing the DAG give them:
//   selectNodesOnDrag off, so that a drag selects nothing; edgesFocusable off,
//   so that the first Tab reaches a block rather than every link first;
//   deleteKeyCode null, so that React Flow removes nothing itself.
//   The DAG sets no snapping of React Flow's, which rounds a node's top left
//   corner rather than its centre, and snaps drags and the arrow keys itself
//   (./moves.ts).

import type { BlockId, CommandCall, LinkId, Notification } from "@blockr/core";
import { useBoard } from "@blockr/core/react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ReactElement } from "react";
import { ReactFlow, useReactFlow } from "../flow/index.ts";
import type { EdgeChangeset, FinalConnectionState, NodeChangeset, NodeOrigin, Viewport } from "../flow/index.ts";
import { canvasOf, changed, merged } from "../geometry/index.ts";
import type { Canvas as CanvasOf, Changes } from "../geometry/index.ts";
import { defaultState, graphState } from "../state/index.ts";
import type { Point } from "../state/index.ts";
import { useGraph } from "./context.ts";
import { elementsOf } from "./elements.ts";
import type { Drawing, GraphEdge, GraphNode } from "./elements.ts";
import { blockNode } from "./ids.ts";
import { LinkView } from "./link.tsx";
import { linkDrop } from "./links.ts";
import { centreOf, dragMoves, joins, keyMoves, movesBatch, NO_MOVES } from "./moves.ts";
import { BlockNodeView, StackNodeView } from "./nodes.tsx";
import { sameSelection, selectedIds, selectionAfter, shownBlock } from "./selection.ts";
import type { SelectChange } from "./selection.ts";
import { fittedView, MAX_ZOOM, MIN_ZOOM, savedView, saveView } from "./view.ts";

const NODE_TYPES = { block: BlockNodeView, stack: StackNodeView };
const EDGE_TYPES = { link: LinkView };

// React Flow places each node by its centre, as the DAG's state keeps a
// position.
const ORIGIN: NodeOrigin = [0.5, 0.5];

// How long the user pauses between presses of the arrow keys before the DAG
// runs what they moved as one step.
const PAUSE = 500;

// What the DAG keeps as a drag starts: the canvas then, the moves of the arrow
// keys that it had not run yet, which the drag's step takes along, the nodes
// that move with where each sat, and the node under the pointer.
interface DragStart {
  readonly canvas: CanvasOf;
  readonly pending: Changes;
  readonly from: ReadonlyMap<string, Point>;
  readonly lead: string;
}

// Why the board took no link that the user dropped, and where on the canvas.
export interface Refusal {
  readonly x: number;
  readonly y: number;
  readonly message: string;
}

export interface CanvasProps {
  readonly hovered: LinkId | null;
  // The crowded side of a node that spreads out, or null for none.
  readonly spread: Drawing["spread"];
  // The size of the DAG's element, which is 0 by 0 until it is laid out.
  readonly size: { readonly width: number; readonly height: number };
  readonly onRefusal: (refusal: Refusal | null) => void;
}

export function Canvas({ hovered, spread, size, onRefusal }: CanvasProps): ReactElement {
  const { core, plugin } = useGraph();
  const board = useBoard(core);
  const selection = useSyncExternalStore(
    useCallback((notify: () => void) => core.selection.subscribe(notify), [core]),
    () => core.selection.get(),
  );
  const flow = useReactFlow<GraphNode, GraphEdge>();
  const state = graphState(board, plugin) ?? defaultState;
  const { layout } = state;
  const locked = core.lock.board;
  const registry = core.blockRegistry();

  const [moves, setMovesState] = useState<Changes>(NO_MOVES);
  const movesRef = useRef<Changes>(NO_MOVES);
  const setMoves = useCallback((next: Changes) => {
    movesRef.current = next;
    setMovesState(next);
  }, []);

  const base = useMemo(() => canvasOf(board, state), [board, state]);
  const canvas = useMemo(() => changed(base, moves), [base, moves]);
  const selected = useMemo(() => selectedIds(selection), [selection]);
  const { nodes, edges } = useMemo(
    () => elementsOf({ canvas, registry, layout, selected, hovered, locked, spread }),
    [canvas, registry, layout, selected, hovered, locked, spread],
  );

  // The nodes and the edges drawn last, which the selection reads as it
  // applies React Flow's changes.
  const drawn = useRef({ nodes, edges });
  useEffect(() => {
    drawn.current = { nodes, edges };
  }, [nodes, edges]);

  // The canvas as the store holds it now, without the moves that the DAG has
  // not run yet.
  const current = useCallback((): CanvasOf => {
    const now = core.store.board();
    return canvasOf(now, graphState(now, plugin) ?? defaultState);
  }, [core, plugin]);

  // Runs the moves as one step, and forgets them once the store holds them,
  // or once the store refused them, as core tells the user.
  const keyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const runMoves = useCallback(
    async (batch: readonly CommandCall[]) => {
      clearTimeout(keyTimer.current);
      try {
        if (batch.length > 0) await core.commands.run(batch);
      } catch {
        // Core has told the user why the store refused the step.
      } finally {
        setMoves(NO_MOVES);
      }
    },
    [core, setMoves],
  );

  // Runs the moves of the arrow keys that the DAG has not run yet, unless a
  // drag goes on, whose step takes them along.
  const drag = useRef<DragStart | null>(null);
  const runKeys = useCallback(() => {
    clearTimeout(keyTimer.current);
    if (drag.current !== null || movesRef.current === NO_MOVES) return;
    void runMoves(movesBatch(current(), movesRef.current));
  }, [current, runMoves]);
  useEffect(
    () => () => {
      clearTimeout(keyTimer.current);
    },
    [],
  );

  // The centre on the canvas of a node at the position that React Flow gives
  // it, which is relative to the top left corner of its stack's box for a
  // block in a stack, as React Flow holds that box now.
  const centre = useCallback(
    (id: string, position: Point): Point => {
      const parentId = flow.getInternalNode(id)?.parentId;
      const parent = parentId === undefined ? undefined : flow.getInternalNode(parentId);
      const offset = parent?.internals.positionAbsolute ?? { x: 0, y: 0 };
      return { x: position.x + offset.x, y: position.y + offset.y };
    },
    [flow],
  );

  const startDrag = useCallback(
    (lead: string | undefined, dragged: readonly { readonly id: string }[]) => {
      clearTimeout(keyTimer.current);
      const pending = movesRef.current;
      const start = changed(current(), pending);
      const from = new Map<string, Point>();
      for (const { id } of dragged) {
        const point = centreOf(start, id);
        if (point !== undefined) from.set(id, point);
      }
      const first = lead ?? dragged[0]?.id;
      drag.current = first === undefined ? null : { canvas: start, pending, from, lead: first };
    },
    [current],
  );

  const endDrag = useCallback(() => {
    const ended = drag.current;
    drag.current = null;
    if (ended === null) return;
    const now = movesRef.current;
    const joined = locked ? new Map<BlockId, string>() : joins(ended.canvas, now, ended.from.keys());
    void runMoves(movesBatch(current(), now, joined));
  }, [current, locked, runMoves]);

  // The selection's changes, which the DAG applies once React Flow has
  // reported every change of one gesture, those of the nodes and those of
  // the edges.
  const selects = useRef<SelectChange[]>([]);
  const clicked = useRef<string | null>(null);
  const flushing = useRef(false);
  const rectangle = useRef<"drawing" | "ended" | null>(null);
  const flushSelects = useCallback(() => {
    flushing.current = false;
    const changes = selects.current;
    const click = clicked.current;
    const box = rectangle.current;
    selects.current = [];
    clicked.current = null;
    if (box === "ended") rectangle.current = null;
    const before = core.selection.get();
    const ids = new Set([...drawn.current.nodes.map((node) => node.id), ...drawn.current.edges.map((edge) => edge.id)]);
    const after = changes.length === 0 ? before : selectionAfter(before, ids, changes, box === "drawing" ? { edges: drawn.current.edges } : undefined);
    const changedSelection = !sameSelection(before, after);
    if (changedSelection) core.selection.set(after);
    if (box === "drawing") return;
    const block = shownBlock(after);
    if (block !== undefined && (changedSelection || box === "ended" || click === blockNode(block))) {
      core.show({ block }).catch(() => undefined);
    }
  }, [core]);
  const scheduleSelects = useCallback(() => {
    if (flushing.current) return;
    flushing.current = true;
    queueMicrotask(flushSelects);
  }, [flushSelects]);

  const onNodesChange = useCallback(
    (changes: NodeChangeset<GraphNode>) => {
      const moved = new Map<string, Point>();
      const selecting: SelectChange[] = [];
      for (const change of changes.toArray()) {
        if (change.type === "position" && change.position !== undefined) moved.set(change.id, centre(change.id, change.position));
        if (change.type === "select") selecting.push({ id: change.id, selected: change.selected });
      }
      const dragging = drag.current;
      if (moved.size > 0 && dragging !== null) {
        const lead = [dragging.lead, ...dragging.from.keys()].find((id) => moved.has(id));
        const from = lead === undefined ? undefined : dragging.from.get(lead);
        const to = lead === undefined ? undefined : moved.get(lead);
        if (from !== undefined && to !== undefined) {
          setMoves(merged(dragging.pending, dragMoves(dragging.canvas, dragging.from.keys(), from, to, layout)));
        }
      } else if (moved.size > 0) {
        const now = movesRef.current;
        setMoves(merged(now, keyMoves(changed(current(), now), moved, layout)));
        clearTimeout(keyTimer.current);
        keyTimer.current = setTimeout(runKeys, PAUSE);
      }
      if (selecting.length > 0) {
        selects.current.push(...selecting);
        scheduleSelects();
      }
    },
    [centre, current, layout, runKeys, scheduleSelects, setMoves],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChangeset<GraphEdge>) => {
      const selecting = changes.toArray().flatMap((change) => (change.type === "select" ? [{ id: change.id, selected: change.selected }] : []));
      if (selecting.length === 0) return;
      selects.current.push(...selecting);
      scheduleSelects();
    },
    [scheduleSelects],
  );

  const onConnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent, connection: FinalConnectionState) => {
      if (connection.fromNode === null) return;
      const { fromNode, fromHandle, toNode, toHandle, pointer, isValid } = connection;
      if (toNode === null || toHandle === null || isValid !== true) return;
      const dropped =
        fromHandle.type === "source"
          ? { source: fromNode.id, target: toNode.id, targetHandle: toHandle.id ?? "" }
          : { source: toNode.id, target: fromNode.id, targetHandle: fromHandle.id ?? "" };
      const drop = linkDrop(drawn.current.nodes, dropped);
      if (drop === undefined) return;
      const refuse = (message: string) => {
        onRefusal({ x: pointer.x, y: pointer.y, message });
      };
      if ("taken" in drop) {
        refuse(drop.taken);
        return;
      }
      core.commands
        .run("blockr.core-add_link", drop.add, "user", {
          notifier: (notifications: readonly Notification[]) => {
            refuse(notifications.map((notification) => notification.message).join("\n"));
          },
        })
        .catch(() => undefined);
    },
    [core, onRefusal],
  );

  // The first fit, as the DAG first mounts on the board: at once where the
  // board's blocks have positions, once the class's start has placed them
  // where they have none, and never where the page has drawn the board before.
  // On a board without blocks, the canvas's middle shows the origin, where the
  // first block that the board gains starts.
  const view = savedView(board.id);
  const fitted = useRef(view !== undefined);
  const hasBlocks = Object.keys(board.blocks).length > 0;
  useEffect(() => {
    if (fitted.current || size.width === 0 || size.height === 0) return;
    if (!hasBlocks) {
      fitted.current = true;
      void flow.setViewport({ x: size.width / 2, y: size.height / 2, zoom: 1 });
    } else if (nodes.length > 0) {
      const fit = fittedView(base, size);
      if (fit === undefined) return;
      fitted.current = true;
      void flow.setViewport(fit);
    }
  }, [base, flow, hasBlocks, nodes.length, size]);

  return (
    <ReactFlow<GraphNode, GraphEdge>
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      edgeTypes={EDGE_TYPES}
      nodeOrigin={ORIGIN}
      defaultViewport={view ?? DEFAULT_VIEW}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDragStart={(_event, node, dragged) => {
        startDrag(node.id, dragged);
      }}
      onNodeDragStop={endDrag}
      onSelectionDragStart={(_event, dragged) => {
        startDrag(undefined, dragged);
      }}
      onSelectionDragStop={endDrag}
      onNodeClick={(_event, node) => {
        clicked.current = node.id;
        scheduleSelects();
      }}
      onNodeDoubleClick={(_event, node) => {
        if (node.data.kind !== "stack" || node.data.shows === "empty") return;
        core.commands
          .run("blockr.graph-collapse_stack", { stack: node.data.stack, collapsed: node.data.shows === "expanded" })
          .catch(() => undefined);
      }}
      onPaneClick={() => {
        if (core.selection.get().length > 0) core.selection.set([]);
      }}
      onSelectionStart={() => {
        rectangle.current = "drawing";
      }}
      onSelectionEnd={() => {
        rectangle.current = "ended";
        scheduleSelects();
      }}
      onConnectEnd={onConnectEnd}
      onMoveEnd={(_event, moved: Viewport) => {
        saveView(board.id, moved);
      }}
      onBlur={runKeys}
      nodesConnectable={!locked}
      selectNodesOnDrag={false}
      edgesFocusable={false}
      edgesReconnectable={false}
      deleteKeyCode={null}
    />
  );
}

const DEFAULT_VIEW: Viewport = { x: 0, y: 0, zoom: 1 };

