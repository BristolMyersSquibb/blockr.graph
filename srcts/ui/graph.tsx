// The root of the DAG's UI, which draws the canvas, its toolbar, the panel of
// search and the outline, the panel of advanced actions, the empty board's
// line and why the board took nothing that the user asked for, in the element
// that the frontend gives the DAG's module
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#the-canvas).
//
// - The canvas fills the element and sizes itself from it, but for the panel
//   of advanced actions, which docks below it while it shows one, and takes
//   its height from the canvas (./panel.tsx). Where the element has no height
//   of its own, as a plugin's section under core's basic frontend has none,
//   the DAG's element takes half the window's height, since React Flow needs
//   an element with a height to draw in. The DAG decides this once, as its
//   element first shows.
// - The canvas draws again from the start as another board opens, since the
//   zoom and the pan belong to a board.
// - While the board holds no block, the canvas says so, and how to add one,
//   but under the board lock, which leaves nothing to add.
// - The DAG's element takes the keyboard's focus as the user presses on the
//   canvas, since React Flow makes each node focusable, but not the canvas
//   around the nodes, so that the DAG's keys act after a click on the canvas
//   or a drawn rectangle, as after a click on a node. The keys act on the
//   DAG's element alone (./keys.ts).
// - A drag that starts on the canvas selects no text on the page until the
//   pointer goes up, wherever it goes. WebKit would otherwise start a
//   selection as the user draws a rectangle with Shift, or drags a link onto
//   another panel of the dock, and Safari would leave it drawn on the page.
// - The DAG shows why the board took no link that the user dropped, and a
//   batch that the store or the command registry refused, where the user
//   dropped the link, opened the menu or pressed the toolbar's button, until
//   the user presses on the DAG or a moment has passed. A key has no point of
//   its own, so core raises the refusal of a key's batch instead, which a
//   frontend shows as a toast.
// - The browser's key for paste, Cmd+V on macOS and Ctrl+V elsewhere, pastes
//   what the browser's paste hands the page (./paste.ts).

import type { CoreApi, LinkId, PluginClassId } from "@blockr/core";
import { useBoard } from "@blockr/core/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import { notePasted, PASTE } from "../actions/index.ts";
import { ReactFlowProvider, useReactFlow } from "../flow/index.ts";
import type { Point } from "../state/index.ts";
import { useGraphActions } from "./actions.ts";
import { Canvas } from "./canvas.tsx";
import type { Refusal } from "./canvas.tsx";
import { GraphContext } from "./context.ts";
import type { Entered, Graph } from "./context.ts";
import type { Side } from "./elements.ts";
import { keyAction } from "./keys.ts";
import { usePanel } from "./panel.tsx";
import { onPaste } from "./paste.ts";
import { SearchPanel } from "./search.tsx";
import { Controls } from "./toolbar.tsx";
import { DURATION } from "./view.ts";

// How long the DAG shows why the board took nothing, unless the user presses
// on the DAG first.
const REFUSAL = 8000;

// How long a spread side stays spread once the pointer has left its handles,
// so that the pointer moves from one handle to the next without the side
// folding back between them.
const FOLD = 250;

// Keeps the page from starting a selection of text until the pointer that
// went down goes up.
function noSelection(doc: Document): void {
  const refuse = (event: Event) => {
    event.preventDefault();
  };
  const end = () => {
    doc.removeEventListener("selectstart", refuse, true);
    doc.removeEventListener("pointerup", end, true);
    doc.removeEventListener("pointercancel", end, true);
  };
  doc.addEventListener("selectstart", refuse, true);
  doc.addEventListener("pointerup", end, true);
  doc.addEventListener("pointercancel", end, true);
}

export function GraphRoot({ core, plugin }: { core: CoreApi; plugin: PluginClassId }): ReactElement {
  return (
    <ReactFlowProvider>
      <GraphFrame core={core} plugin={plugin} />
    </ReactFlowProvider>
  );
}

function GraphFrame({ core, plugin }: { core: CoreApi; plugin: PluginClassId }): ReactElement {
  const flow = useReactFlow();
  const [hovered, setHovered] = useState<LinkId | null>(null);
  const [spread, setSpread] = useState<{ readonly node: string; readonly side: Side } | null>(null);
  const fold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      clearTimeout(fold.current);
    },
    [],
  );

  const element = useRef<HTMLDivElement>(null);
  const elementOf = useCallback(() => element.current, []);
  // The element of the canvas and the toolbar, above the panel of advanced
  // actions.
  const stage = useRef<HTMLDivElement>(null);
  const stageOf = useCallback(() => stage.current, []);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const refuse = useCallback((client: Point, message: string) => {
    const box = element.current?.getBoundingClientRect();
    setRefusal({ x: client.x - (box?.left ?? 0), y: client.y - (box?.top ?? 0), message });
  }, []);
  useEffect(() => {
    if (refusal === null) return;
    const timer = setTimeout(() => {
      setRefusal(null);
    }, REFUSAL);
    return () => {
      clearTimeout(timer);
    };
  }, [refusal]);

  const pan = useCallback(
    (by: { readonly x: number; readonly y: number }) => {
      const { x, y, zoom } = flow.getViewport();
      void flow.setViewport({ x: x + by.x, y: y + by.y, zoom }, { duration: DURATION });
    },
    [flow],
  );
  const panel = usePanel({ core, element: elementOf, stage: stageOf, pan });
  const actions = useGraphActions({
    core,
    element: elementOf,
    toCanvas: (client) => flow.screenToFlowPosition(client),
    refuse,
    panel: panel.advanced,
  });
  // The text of the browser's paste goes to Paste's run, which takes it as
  // core calls the run, at once.
  useEffect(() => {
    const el = element.current;
    if (el === null) return;
    return onPaste(el, (text) => {
      notePasted(text);
      void actions.trigger(core.id("blockr.graph", PASTE), { board: true }, { key: true });
      notePasted(undefined);
    });
  }, [actions, core]);

  const graph = useMemo<Graph>(
    () => ({
      core,
      plugin,
      enter: ({ node, side, link, crowded }: Entered) => {
        setHovered(link ?? null);
        clearTimeout(fold.current);
        setSpread((was) => (!crowded ? was : was?.node === node && was.side === side ? was : { node, side }));
      },
      leave: () => {
        setHovered(null);
        clearTimeout(fold.current);
        fold.current = setTimeout(() => {
          setSpread(null);
        }, FOLD);
      },
      actions,
    }),
    [actions, core, plugin],
  );
  const board = useBoard(core);
  const empty = Object.keys(board.blocks).length === 0;

  const [own, setOwn] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const [el, canvas] = [element.current, stage.current];
    if (el === null || canvas === null) return;
    let decided = false;
    const measure = () => {
      if (el.getClientRects().length === 0) return;
      if (!decided) {
        decided = true;
        if (el.getBoundingClientRect().height === 0) {
          setOwn(true);
          return;
        }
      }
      const { width, height } = canvas.getBoundingClientRect();
      setSize((was) => (was.width === width && was.height === height ? was : { width, height }));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    observer.observe(canvas);
    measure();
    return () => {
      observer.disconnect();
    };
  }, []);

  const [searching, setSearching] = useState(false);
  const closeSearch = useCallback(() => {
    setSearching(false);
  }, []);

  return (
    <GraphContext value={graph}>
      <div
        ref={element}
        className="blockr-graph"
        data-height={own ? "own" : undefined}
        tabIndex={-1}
        onPointerDown={(event) => {
          setRefusal(null);
          const el = element.current;
          const target = event.target;
          if (el === null || !(target instanceof Element)) return;
          if (target.closest(".react-flow") !== null) noSelection(el.ownerDocument);
          if (target.closest(".react-flow__pane") === null) return;
          const node = target.closest<HTMLElement>(".react-flow__node");
          (node ?? el).focus({ preventScroll: true });
        }}
        onKeyDown={(event) => {
          if (event.defaultPrevented) return;
          if (event.key === "Escape" && panel.dismiss()) {
            event.preventDefault();
            return;
          }
          const text = event.currentTarget.ownerDocument.getSelection()?.toString() ?? "";
          const pressed = keyAction(event, core.selection.get(), text !== "");
          if (pressed === undefined) return;
          event.preventDefault();
          const { action, target } = pressed;
          void actions.trigger("role" in action ? action.role : core.id("blockr.graph", action.id), target, { key: true });
        }}
      >
        <div ref={stage} className="blockr-graph-stage">
          <Canvas key={board.id} hovered={hovered} spread={spread} size={size} onRefusal={setRefusal} />
          <div className="blockr-graph-tools">
            <Controls
              size={size}
              searching={searching}
              onSearch={() => {
                setSearching((open) => !open);
              }}
            />
            {searching ? <SearchPanel onClose={closeSearch} /> : null}
          </div>
          {empty ? (
            <p className="blockr-graph-empty">{core.lock.board ? "No blocks yet." : "No blocks yet. Right-click to add one."}</p>
          ) : null}
          {refusal === null ? null : (
            <div className="blockr-graph-refusal" role="alert" style={{ left: refusal.x, top: refusal.y }}>
              {refusal.message}
            </div>
          )}
        </div>
        {panel.view}
      </div>
    </GraphContext>
  );
}
