// The panel of search and the outline, which the toolbar's search button opens
// beside the toolbar
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#search-and-the-outline).
//
// - A field at the top narrows the panel to the blocks and stacks whose name
//   or id holds what the user types, the stacks first.
// - Below the field, the outline, "Board contents", lists each stack as a row
//   that folds, with its blocks in the order of their links and the number of
//   its blocks, and then the blocks in no stack (./outline.ts). A stack that
//   is collapsed on the canvas shows folded, while folding a row leaves the
//   canvas alone.
// - Picking a row moves the view to the block or the stack and selects it once
//   the view has reached it, so that picking a block shows it, as a click on
//   its node does. Picking a
//   block of a collapsed stack expands the stack first, through
//   blockr.graph-collapse_stack, which moves the blocks around the stack and
//   takes an undo step, as any expand does.
// - Escape, a click outside the panel or a pick closes it.

import type { BoardObject } from "@blockr/core";
import { useBoard } from "@blockr/core/react";
import { SearchField, Tree, TreeItem } from "@blockr/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import { useReactFlow } from "../flow/index.ts";
import { canvasOf } from "../geometry/index.ts";
import { defaultState, graphState } from "../state/index.ts";
import { useGraph } from "./context.ts";
import { blockNode, objectOf, stackNode } from "./ids.ts";
import { centreOf } from "./moves.ts";
import { matching, outlineOf } from "./outline.ts";

// How long moving the view to a pick takes on the screen.
const DURATION = 300;

export function SearchPanel({ onClose }: { onClose: () => void }): ReactElement {
  const { core, plugin } = useGraph();
  const board = useBoard(core);
  const flow = useReactFlow();
  const [query, setQuery] = useState("");
  const outline = useMemo(() => outlineOf(board), [board]);
  const found = useMemo(() => matching(outline, query), [outline, query]);
  const [expanded, setExpanded] = useState<ReadonlySet<string | number>>(() => {
    const { collapsed } = canvasOf(board, graphState(board, plugin) ?? defaultState);
    return new Set(outline.stacks.filter(({ stack }) => !collapsed.has(stack)).map(({ stack }) => stackNode(stack)));
  });

  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || panel.current?.contains(target) === true) return;
      if (target instanceof Element && target.closest(".blockr-graph-toolbar") !== null) return;
      onClose();
    };
    document.addEventListener("pointerdown", away, true);
    return () => {
      document.removeEventListener("pointerdown", away, true);
    };
  }, [onClose]);

  // Moves the view to the block or the stack, selects it once the view has
  // reached it, so that what follows the selection, as a pinned panel of
  // advanced actions, finds it where it ends, and shows a block.
  const pick = async (key: string) => {
    const object = objectOf(key);
    if (object === undefined) return;
    onClose();
    const before = core.store.board();
    const stack = "block" in object ? outline.stacks.find(({ blocks }) => blocks.some(({ block }) => block === object.block)) : undefined;
    const state = graphState(before, plugin) ?? defaultState;
    if (stack !== undefined && canvasOf(before, state).collapsed.has(stack.stack)) {
      await core.commands.run("blockr.graph-collapse_stack", { stack: stack.stack, collapsed: false }).catch(() => undefined);
    }
    const now = core.store.board();
    const centre = centreOf(canvasOf(now, graphState(now, plugin) ?? defaultState), key);
    if (centre !== undefined) await flow.setCenter(centre.x, centre.y, { zoom: flow.getZoom(), duration: DURATION });
    const picked: BoardObject[] = [object];
    core.selection.set(picked);
    if ("block" in object) core.show({ block: object.block }).catch(() => undefined);
  };

  const searching = query.trim() !== "";
  return (
    <div
      ref={panel}
      className="blockr-graph-search"
      role="dialog"
      aria-label="Search blocks"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <SearchField aria-label="Search blocks and stacks" placeholder="Search blocks and stacks" value={query} onChange={setQuery} autoFocus />
      {searching ? (
        found.stacks.length + found.blocks.length === 0 ? (
          <p className="blockr-graph-search-none">No block or stack matches.</p>
        ) : (
          <Tree aria-label="Matches" className="blockr-graph-outline" onAction={(key) => void pick(String(key))}>
            {found.stacks.map(({ stack, name, blocks }) => (
              <TreeItem key={stackNode(stack)} id={stackNode(stack)} title={`${name} (${String(blocks.length)})`} />
            ))}
            {found.blocks.map(({ block, name }) => (
              <TreeItem key={blockNode(block)} id={blockNode(block)} title={name} />
            ))}
          </Tree>
        )
      ) : (
        <>
          <h3 className="blockr-graph-search-heading">Board contents</h3>
          {outline.stacks.length + outline.loose.length === 0 ? (
            <p className="blockr-graph-search-none">The board holds no block.</p>
          ) : (
            <Tree
              aria-label="Board contents"
              className="blockr-graph-outline"
              expandedKeys={expanded}
              onExpandedChange={setExpanded}
              onAction={(key) => void pick(String(key))}
            >
              {outline.stacks.map(({ stack, name, blocks }) => (
                <TreeItem key={stackNode(stack)} id={stackNode(stack)} title={`${name} (${String(blocks.length)})`}>
                  {blocks.map(({ block, name: title }) => (
                    <TreeItem key={blockNode(block)} id={blockNode(block)} title={title} />
                  ))}
                </TreeItem>
              ))}
              {outline.loose.map(({ block, name }) => (
                <TreeItem key={blockNode(block)} id={blockNode(block)} title={name} />
              ))}
            </Tree>
          )}
        </>
      )}
    </div>
  );
}
