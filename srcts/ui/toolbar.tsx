// The DAG's toolbar, which floats in a column at the canvas's top left, as
// today (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#the-toolbar).
// It holds, in this order:
//
// 1. The DAG's own controls: search, zoom in, zoom out and fit.
// 2. A button for each board action on the board, such as core's Add block,
//    Create link and Create stack, and the DAG's Paste and Layout.
// 3. While the user has selected something, a button for each board action on
//    the selection, such as core's Remove and Create stack and the DAG's Copy
//    and Cut.
//
// Each control is a button of core's React SDK with an icon, whose label is
// its tooltip. A button of a board action shows the board action's icon, or
// the first letter of its label where it has none, and has the board action's
// label as its tooltip. It opens the board action's quick action below
// itself, or its advanced action where it has no quick action on the target,
// as Create link on the board, or runs it where it asks nothing
// (./actions.ts). A board action that another package registers on the board
// or on a selection gets a button too, as it gets a row in the DAG's menus.
// The toolbar offers only what core.boardActions.on() gives, so that under
// the board lock it offers only what the lock leaves.

import type { BoardAction, Target } from "@blockr/core";
import { Button, Separator, Toolbar, Tooltip, TooltipTrigger, useBoard } from "@blockr/core/react";
import { useCallback, useSyncExternalStore } from "react";
import type { ReactElement, ReactNode } from "react";
import { useReactFlow } from "../flow/index.ts";
import { canvasOf } from "../geometry/index.ts";
import { defaultState, graphState } from "../state/index.ts";
import { useGraph } from "./context.ts";
import { DURATION, fittedView } from "./view.ts";

// How long the pointer rests on a button before its tooltip shows.
const DELAY = 600;

export interface ControlsProps {
  // Whether the panel of search and the outline is open.
  readonly searching: boolean;
  readonly onSearch: () => void;
  // The size of the canvas, into which Fit fits the board.
  readonly size: { readonly width: number; readonly height: number };
}

export function Controls({ searching, onSearch, size }: ControlsProps): ReactElement {
  const { core, plugin } = useGraph();
  const board = useBoard(core);
  const selection = useSyncExternalStore(
    useCallback((notify: () => void) => core.selection.subscribe(notify), [core]),
    () => core.selection.get(),
  );
  const flow = useReactFlow();
  const fit = () => {
    const view = fittedView(canvasOf(board, graphState(board, plugin) ?? defaultState), size);
    if (view !== undefined) void flow.setViewport(view, { duration: DURATION });
  };
  const onBoard: Target = { board: true };
  const onSelection: Target = { selection };
  const boardActions = core.boardActions.on(onBoard);
  const selectionActions = selection.length === 0 ? [] : core.boardActions.on(onSelection);
  return (
    <Toolbar orientation="vertical" aria-label="Workflow tools" className="blockr-graph-toolbar">
      <Control label="Search blocks" onPress={onSearch} pressed={searching}>
        <path d="M11 11 L14.5 14.5" />
        <circle cx={7} cy={7} r={4.5} />
      </Control>
      <Control label="Zoom in" onPress={() => void flow.zoomIn({ duration: DURATION })}>
        <path d="M8 3 V13 M3 8 H13" />
      </Control>
      <Control label="Zoom out" onPress={() => void flow.zoomOut({ duration: DURATION })}>
        <path d="M3 8 H13" />
      </Control>
      <Control label="Fit the view" onPress={fit}>
        <path d="M2 6 V2 H6 M10 2 H14 V6 M14 10 V14 H10 M6 14 H2 V10" />
      </Control>
      {boardActions.length === 0 ? null : <Separator orientation="horizontal" className="blockr-graph-separator" />}
      {boardActions.map((action) => (
        <ActionButton key={`board:${action.id}`} action={action} target={onBoard} />
      ))}
      {selectionActions.length === 0 ? null : <Separator orientation="horizontal" className="blockr-graph-separator" />}
      {selectionActions.map((action) => (
        <ActionButton key={`selection:${action.id}`} action={action} target={onSelection} />
      ))}
    </Toolbar>
  );
}

interface ControlProps {
  readonly label: string;
  readonly onPress: () => void;
  // Whether what the button opens is open.
  readonly pressed?: boolean;
  // The strokes of its icon, in a box of 16 by 16.
  readonly children: ReactNode;
}

function Control({ label, onPress, pressed, children }: ControlProps): ReactElement {
  return (
    <TooltipTrigger delay={DELAY}>
      <Button
        variant="quiet"
        className="blockr-graph-control"
        aria-label={label}
        {...(pressed === undefined ? {} : { "aria-expanded": pressed })}
        onPress={onPress}
      >
        <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true" className="blockr-graph-icon">
          {children}
        </svg>
      </Button>
      <Tooltip placement="right">{label}</Tooltip>
    </TooltipTrigger>
  );
}

function ActionButton({ action, target }: { action: BoardAction; target: Target }): ReactElement {
  const { actions } = useGraph();
  return (
    <TooltipTrigger delay={DELAY}>
      <Button
        variant="quiet"
        className="blockr-graph-control"
        aria-label={action.label}
        onPress={(event) => {
          if (event.target instanceof HTMLElement) void actions.trigger(action.id, target, { button: event.target });
        }}
      >
        {action.icon === undefined || action.icon === "" ? (
          <span className="blockr-graph-initial" aria-hidden="true">
            {action.label.charAt(0)}
          </span>
        ) : (
          <span className="blockr-graph-action-icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: action.icon }} />
        )}
      </Button>
      <Tooltip placement="right">{action.label}</Tooltip>
    </TooltipTrigger>
  );
}
