// The root of the DAG's UI, which draws the canvas, its toolbar, the panel of
// search and the outline, the empty board's line and why a link was refused,
// in the element that the frontend gives the DAG's module
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#the-canvas).
//
// - The canvas fills the element and sizes itself from it. Where the element
//   has no height of its own, as a plugin's section under core's basic
//   frontend has none, the canvas takes half the window's height, since
//   React Flow needs an element with a height to draw in. The DAG decides
//   this once, as its element first shows.
// - The canvas draws again from the start as another board opens, since the
//   zoom and the pan belong to a board.
// - While the board holds no block, the canvas says so, and how to add one,
//   but under the board lock, which leaves nothing to add.
// - The DAG's element takes the keyboard's focus as the user presses on the
//   canvas, since React Flow makes each node focusable, but not the canvas
//   around the nodes, so that the DAG's keys act after a click on the canvas
//   or a drawn rectangle, as after a click on a node.

import type { CoreApi, LinkId, PluginClassId } from "@blockr/core";
import { useBoard } from "@blockr/core/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import { ReactFlowProvider } from "../flow/index.ts";
import { Canvas } from "./canvas.tsx";
import type { Refusal } from "./canvas.tsx";
import { GraphContext } from "./context.ts";
import type { Entered, Graph } from "./context.ts";
import type { Side } from "./elements.ts";
import { SearchPanel } from "./search.tsx";
import { Controls } from "./toolbar.tsx";

// How long the DAG shows why a link was refused, unless the user presses on
// the canvas first.
const REFUSAL = 8000;

// How long a spread side stays spread once the pointer has left its handles,
// so that the pointer moves from one handle to the next without the side
// folding back between them.
const FOLD = 250;

export function GraphRoot({ core, plugin }: { core: CoreApi; plugin: PluginClassId }): ReactElement {
  const [hovered, setHovered] = useState<LinkId | null>(null);
  const [spread, setSpread] = useState<{ readonly node: string; readonly side: Side } | null>(null);
  const fold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      clearTimeout(fold.current);
    },
    [],
  );
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
    }),
    [core, plugin],
  );
  const board = useBoard(core);
  const empty = Object.keys(board.blocks).length === 0;

  const element = useRef<HTMLDivElement>(null);
  const [own, setOwn] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = element.current;
    if (el === null) return;
    let decided = false;
    const measure = () => {
      if (el.getClientRects().length === 0) return;
      const { width, height } = el.getBoundingClientRect();
      if (!decided) {
        decided = true;
        if (height === 0) {
          setOwn(true);
          return;
        }
      }
      setSize((was) => (was.width === width && was.height === height ? was : { width, height }));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => {
      observer.disconnect();
    };
  }, []);

  const [searching, setSearching] = useState(false);
  const closeSearch = useCallback(() => {
    setSearching(false);
  }, []);

  const [refusal, setRefusal] = useState<Refusal | null>(null);
  useEffect(() => {
    if (refusal === null) return;
    const timer = setTimeout(() => {
      setRefusal(null);
    }, REFUSAL);
    return () => {
      clearTimeout(timer);
    };
  }, [refusal]);

  return (
    <GraphContext value={graph}>
      <ReactFlowProvider>
        <div
          ref={element}
          className="blockr-graph"
          data-height={own ? "own" : undefined}
          tabIndex={-1}
          onPointerDown={(event) => {
            setRefusal(null);
            const el = element.current;
            const target = event.target;
            if (el === null || !(target instanceof Element) || target.closest(".react-flow__pane") === null) return;
            const node = target.closest<HTMLElement>(".react-flow__node");
            (node ?? el).focus({ preventScroll: true });
          }}
        >
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
            <p className="blockr-graph-empty">
              {core.lock.board ? "No blocks yet." : "No blocks yet. Right-click to add one."}
            </p>
          ) : null}
          {refusal === null ? null : (
            <div className="blockr-graph-refusal" role="alert" style={{ left: refusal.x, top: refusal.y }}>
              {refusal.message}
            </div>
          )}
        </div>
      </ReactFlowProvider>
    </GraphContext>
  );
}
