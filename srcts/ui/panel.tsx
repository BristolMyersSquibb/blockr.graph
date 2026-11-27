// The DAG's panel of advanced actions, which it docks at the bottom of its
// element, below the canvas, as the `advanced` of the DAG's calls of
// core.boardActions.menu() and trigger()
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#its-advanced-actions).
//
// 1. The user opens Edit link on a link, through the link's menu and the open
//    icon of its quick action.
// 2. Core calls the DAG's `advanced`.
// 3. The DAG docks its panel below the canvas, which shrinks to what the panel
//    leaves above it, pans the canvas where the link would lie below it
//    (./panel-place.ts), and has core mount the form in the panel.
// 4. Once done() ends the advanced action, the DAG closes the panel.
//
// An advanced action on the board, such as the block picker of Add block, and
// one on a selection, such as the form of Create stack, show there too.
// The DAG hands every call the same `advanced`, so that the panel shows one
// advanced action at a time: core ends the one that it showed as it opens
// another there.
// Where the element has no room for the panel below the canvas, the DAG hands
// that call no `advanced`, and the frontend shows the advanced action in its
// own place.
//
// The user may pin the panel. A pinned panel stays open once done() ends its
// advanced action, and has core mount it again, by the rules of the dock's
// pinned sidebar
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.2.4#places-besides-the-panel):
//
// 1. Once done() has run a batch, the panel mounts the advanced action on the
//    one board object that the batch added for which a menu offers the board
//    action, so that a pinned Append block moves on to the block that it
//    appended, and otherwise on the same target.
// 2. As core.selection comes to hold one board object for which a menu offers
//    the board action, the panel mounts the advanced action on that object,
//    so that a pinned Edit inputs follows the blocks that the user selects.
// 3. Otherwise a selection changes nothing.
//
// The panel takes the keyboard's focus as it opens, though not as a pinned
// panel mounts its advanced action again, and gives the focus back to the
// DAG's element as it closes with the focus in it.
// The panel closes as the user closes it, by its button or Escape, and as its
// advanced action ends while the panel is not pinned. Escape on the canvas
// closes it as well, unless it is pinned. A pinned panel closes as well once
// what its advanced action is about leaves the board.

import type { BlockId, Board, BoardObject, CoreApi, Delta, FrontendModule, Target } from "@blockr/core";
import { Button, ToggleButton } from "@blockr/ui";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, RefObject } from "react";
import { stackOf } from "../geometry/index.ts";
import { idOf, stackNode } from "./ids.ts";
import { hasRoom, revealPan } from "./panel-place.ts";
import type { Rect } from "./panel-place.ts";

// What core hands a place of advanced actions, and what the place returns.
type Place = NonNullable<FrontendModule["advanced"]>;
type PlaceArgs = Parameters<Place>[0];

// The advanced action that the panel shows: what core handed the panel, the
// target that the panel mounts it on now, how many mounts the panel has made
// since it opened, so that each mount takes an element of its own, and
// whether the panel takes the focus as it shows the mount, as it does as it
// opens.
interface Shown {
  readonly args: PlaceArgs;
  readonly target: Target;
  readonly mounts: number;
  readonly focus: boolean;
}

export interface PanelParts {
  readonly core: CoreApi;
  // The DAG's element, at whose bottom the panel docks.
  readonly element: () => HTMLElement | null;
  // The element of the canvas, above the panel.
  readonly stage: () => HTMLElement | null;
  // Pans the canvas by the distance given, on the screen.
  readonly pan: (by: { readonly x: number; readonly y: number }) => void;
}

export interface Panel {
  // The `advanced` of a call of menu() or trigger() on the target, or
  // undefined where the element has no room for the panel below the canvas,
  // or the DAG draws nothing of the target.
  readonly advanced: (target: Target) => Place | undefined;
  // Closes the panel unless it is pinned, as Escape on the canvas does, and
  // says whether it closed it.
  readonly dismiss: () => boolean;
  // The panel, while it shows an advanced action.
  readonly view: ReactElement | null;
}

export function usePanel({ core, element, stage, pan }: PanelParts): Panel {
  const [shown, setShown] = useState<Shown | null>(null);
  const shownRef = useRef<Shown | null>(null);
  const [pinned, setPinned] = useState(false);
  const pinnedRef = useRef(false);
  const section = useRef<HTMLElement>(null);
  const parts = useRef({ core, element, stage, pan });
  useEffect(() => {
    parts.current = { core, element, stage, pan };
  }, [core, element, stage, pan]);

  const show = useCallback((next: Shown | null) => {
    const held = section.current;
    if (next === null && held?.contains(held.ownerDocument.activeElement) === true) {
      parts.current.element()?.focus({ preventScroll: true });
    }
    shownRef.current = next;
    setShown(next);
    if (next === null) {
      pinnedRef.current = false;
      setPinned(false);
    }
  }, []);

  // Pans the canvas so that the object of the target that the panel shows
  // lies within the canvas above the panel.
  const reveal = useCallback(() => {
    const current = shownRef.current;
    const { core: api, element: frameOf, stage: stageOf, pan: by } = parts.current;
    const [frame, canvas] = [frameOf(), stageOf()];
    if (current === null || frame === null || canvas === null || "board" in current.target) return;
    const box = objectBox(frame, api.store.board(), current.target);
    const y = box === undefined ? 0 : revealPan(box, canvas.getBoundingClientRect().height);
    if (y !== 0) by({ x: 0, y });
  }, []);
  useLayoutEffect(() => {
    if (shown !== null) reveal();
  }, [shown, reveal]);

  // Mounts the advanced action afresh on the target.
  const mountOn = useCallback(
    (current: Shown, target: Target) => {
      show({ ...current, target, mounts: current.mounts + 1, focus: false });
    },
    [show],
  );

  // The place that the DAG hands core, the same function for every call.
  const place = useMemo<Place>(
    () => (args) => {
      show({ args, target: args.target, mounts: (shownRef.current?.mounts ?? 0) + 1, focus: true });
      return (deltas?: readonly Delta[]) => {
        const current = shownRef.current;
        if (current?.args !== args) return;
        const { core: api } = parts.current;
        if (!pinnedRef.current) {
          show(null);
          return;
        }
        const next = addedTarget(api, args.id, deltas) ?? current.target;
        if (!holds(api.store.board(), next)) show(null);
        else mountOn(current, next);
      };
    },
    [mountOn, show],
  );

  const close = useCallback(() => {
    const current = shownRef.current;
    if (current === null) return;
    current.args.close();
    show(null);
  }, [show]);

  const dismiss = useCallback(() => {
    if (shownRef.current === null || pinnedRef.current) return false;
    close();
    return true;
  }, [close]);

  // A pinned panel follows the selection to one board object for which a
  // menu offers its board action.
  useEffect(
    () =>
      core.selection.subscribe((objects) => {
        const current = shownRef.current;
        const [only] = objects;
        if (current === null || !pinnedRef.current || objects.length !== 1 || only === undefined) return;
        if (sameTarget(only, current.target) || !offers(core, only, current.args.id)) return;
        mountOn(current, only);
      }),
    [core, mountOn],
  );

  const advanced = useCallback(
    (target: Target): Place | undefined => {
      const el = element();
      const box = el === null ? undefined : objectBox(el, core.store.board(), target);
      return el !== null && box !== undefined && hasRoom(el.getBoundingClientRect()) ? place : undefined;
    },
    [core, element, place],
  );

  const view =
    shown === null ? null : (
      <PanelView
        section={section}
        shown={shown}
        pinned={pinned}
        onPin={(next) => {
          pinnedRef.current = next;
          setPinned(next);
        }}
        onClose={close}
        onResize={reveal}
      />
    );
  return { advanced, dismiss, view };
}

function PanelView({
  section,
  shown,
  pinned,
  onPin,
  onClose,
  onResize,
}: {
  section: RefObject<HTMLElement | null>;
  shown: Shown;
  pinned: boolean;
  onPin: (pinned: boolean) => void;
  onClose: () => void;
  // Called as the panel's height changes, as where the advanced action draws
  // more, which the canvas above it loses.
  onResize: () => void;
}): ReactElement {
  const { args, target, mounts, focus } = shown;
  useLayoutEffect(() => {
    const el = section.current;
    if (el === null) return;
    const observer = new ResizeObserver(() => {
      onResize();
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [section, onResize]);
  // The panel takes the focus once core has given it back to where the user
  // opened the menu from, as the menu closed.
  useEffect(() => {
    const el = section.current;
    if (!focus || el === null) return;
    const frame = requestAnimationFrame(() => {
      if (!el.contains(el.ownerDocument.activeElement)) el.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [section, focus, mounts]);
  return (
    <section
      ref={section}
      className="blockr-graph-panel"
      aria-label={args.title}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        event.preventDefault();
        onClose();
      }}
    >
      <header className="blockr-graph-panel-header">
        <h2 className="blockr-graph-panel-title">{args.title}</h2>
        <ToggleButton className="blockr-graph-panel-control" aria-label="Pin" isSelected={pinned} onChange={onPin}>
          <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true" className="blockr-graph-icon">
            <path d="M6 2.5 H10 M7 2.5 V6.5 L5 9 H11 L9 6.5 V2.5 M8 9 V13.5" />
          </svg>
        </ToggleButton>
        <Button variant="quiet" className="blockr-graph-panel-control" aria-label="Close" onPress={onClose}>
          <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true" className="blockr-graph-icon">
            <path d="M4 4 L12 12 M12 4 L4 12" />
          </svg>
        </Button>
      </header>
      <PanelBody key={mounts} args={args} target={target} />
    </section>
  );
}

// The element in which core mounts the advanced action on the target, a new
// one for each mount, as core's dialog mounts one: core mounts it as React
// commits the element, and unmounts it once React has finished the work in
// which the element went. A module written in React then unmounts its own
// root at once, before core empties the element. Within that work, React would
// put the unmount off until core had emptied the element, and then fail to
// remove what it drew. A new element for each mount keeps such a late unmount
// from emptying the next mount.
function PanelBody({ args, target }: { args: PlaceArgs; target: Target }): ReactElement {
  const body = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = body.current;
    if (el === null) return;
    const unmount = args.mount(el, target);
    return () => {
      queueMicrotask(unmount);
    };
  }, [args, target]);
  return <div ref={body} className="blockr-graph-panel-body" />;
}

// The box on the screen, relative to the DAG's element, of what the target is
// about: the toolbar for the board, the node of a block, or of its collapsed
// stack, for a block and for an input of a block, the node of a stack, the
// edge of a link, and the box around them for a selection. It is undefined
// where the DAG draws none of them.
export function objectBox(el: HTMLElement, board: Board, target: Target): Rect | undefined {
  const frame = el.getBoundingClientRect();
  const relative = (rects: readonly DOMRect[]): Rect | undefined => {
    if (rects.length === 0) return undefined;
    const left = Math.min(...rects.map((rect) => rect.left));
    const top = Math.min(...rects.map((rect) => rect.top));
    const right = Math.max(...rects.map((rect) => rect.right));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    return { left: left - frame.left, top: top - frame.top, width: right - left, height: bottom - top };
  };
  if ("board" in target) {
    const toolbar = el.querySelector(".blockr-graph-toolbar");
    return toolbar === null ? undefined : relative([toolbar.getBoundingClientRect()]);
  }
  const objects: readonly BoardObject[] = "selection" in target ? target.selection : ["input" in target ? { block: target.block } : target];
  const stacks = stackOf(board);
  const rects = objects.flatMap((object) => {
    const drawn = drawnOf(el, object, stacks);
    return drawn === null ? [] : [drawn.getBoundingClientRect()];
  });
  return relative(rects);
}

// The element that draws a board object: its node or its edge, or the node of
// the collapsed stack that hides a block.
function drawnOf(el: HTMLElement, object: BoardObject, stacks: ReadonlyMap<BlockId, string>): Element | null {
  const id = idOf(object);
  if (id === undefined) return null;
  const found = el.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"], .react-flow__edge[data-id="${CSS.escape(id)}"]`);
  if (found !== null || !("block" in object)) return found;
  const stack = stacks.get(object.block);
  return stack === undefined ? null : el.querySelector(`.react-flow__node[data-id="${CSS.escape(stackNode(stack))}"]`);
}

// The one board object that the deltas add for which a menu offers the board
// action, or undefined where they add none or several.
function addedTarget(core: CoreApi, action: string, deltas: readonly Delta[] | undefined): BoardObject | undefined {
  if (deltas === undefined) return undefined;
  const added: BoardObject[] = deltas.flatMap((delta) => [
    ...Object.keys(delta.blocks?.add ?? {}).map((block) => ({ block })),
    ...Object.keys(delta.links?.add ?? {}).map((link) => ({ link })),
    ...Object.keys(delta.stacks?.add ?? {}).map((stack) => ({ stack })),
  ]);
  const offered = added.filter((object) => offers(core, object, action));
  return offered.length === 1 ? offered[0] : undefined;
}

// Whether a menu of the target offers the board action with the id given.
function offers(core: CoreApi, target: Target, action: string): boolean {
  return core.boardActions.on(target).some((each) => each.id === action);
}

// Whether the board holds every block, link and stack that the target names.
function holds(board: Board, target: Target): boolean {
  if ("board" in target) return true;
  const objects: readonly BoardObject[] = "selection" in target ? target.selection : [target];
  return objects.every((object) => {
    if ("block" in object) return Object.hasOwn(board.blocks, object.block);
    if ("link" in object) return Object.hasOwn(board.links, object.link);
    if ("stack" in object) return Object.hasOwn(board.stacks, object.stack);
    return true;
  });
}

function sameTarget(a: Target, b: Target): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
