// The DAG's toolbar, which floats in a column at the canvas's top left, as
// today (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#the-toolbar).
// It holds, in this order:
//
// 1. The DAG's own controls: search, zoom in, zoom out and fit.
// 2. The board actions of its list on the board (./tools.ts): a + that pops
//    out Add block, Create link and Create stack, then Paste and Layout.
// 3. While the user has selected something, those on the selection: a + that
//    pops out Create stack and Add to stack, then Copy, Cut and Remove.
//
// Each control is blockr.ui's Button with an icon, whose label is its
// tooltip. A button of a board action shows the board action's icon, or
// the DAG's own where it has none, and has the board action's label as its
// tooltip. It opens the board action's quick action, or its advanced action
// where it has no quick action on the target, as Create link on the board, or
// runs it where it asks nothing (./actions.ts).
// A + pops out a menu of the board actions that it holds, which the DAG draws
// with blockr.ui's Menu. Picking one triggers it at the +, as its own button
// would.
// Whatever a button opens, opens to the right of the toolbar, level with the
// button, as the panel of search does: the + its menu, and a board action its
// quick action (./actions.ts).

import type { BoardAction, Target } from "@blockr/core";
import { useBoard } from "@blockr/core/react";
import { Button, Menu, MenuItem, MenuTrigger, Separator, Toolbar, Tooltip, TooltipTrigger } from "@blockr/ui";
import { useCallback, useRef, useSyncExternalStore } from "react";
import type { ReactElement, ReactNode } from "react";
import { useReactFlow } from "../flow/index.ts";
import { canvasOf } from "../geometry/index.ts";
import { defaultState, graphState } from "../state/index.ts";
import { useGraph } from "./context.ts";
import { BOARD_TOOLS, SELECTION_TOOLS, shownTools } from "./tools.ts";
import type { ShownTool } from "./tools.ts";
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
  const boardTools = shownTools(BOARD_TOOLS, core.boardActions.on(onBoard));
  const selectionTools = selection.length === 0 ? [] : shownTools(SELECTION_TOOLS, core.boardActions.on(onSelection));
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
      {boardTools.length === 0 ? null : <Separator orientation="horizontal" className="blockr-graph-separator" />}
      {boardTools.map((tool) => (
        <ToolView key={`board:${keyOf(tool)}`} tool={tool} target={onBoard} />
      ))}
      {selectionTools.length === 0 ? null : <Separator orientation="horizontal" className="blockr-graph-separator" />}
      {selectionTools.map((tool) => (
        <ToolView key={`selection:${keyOf(tool)}`} tool={tool} target={onSelection} />
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

// What tells a tool apart from the others of its group.
function keyOf(tool: ShownTool): string {
  return tool.kind === "add" ? "add" : tool.action.id;
}

function ToolView({ tool, target }: { tool: ShownTool; target: Target }): ReactElement {
  return tool.kind === "add" ? (
    <AddButton label={tool.label} actions={tool.actions} target={target} />
  ) : (
    <ActionButton action={tool.action} icon={tool.icon} target={target} />
  );
}

function ActionButton({ action, icon, target }: { action: BoardAction; icon: string; target: Target }): ReactElement {
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
        <span className="blockr-graph-action-icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon }} />
      </Button>
      <Tooltip placement="right">{action.label}</Tooltip>
    </TooltipTrigger>
  );
}

// A + that pops out a menu of the board actions that it holds, to its right,
// and triggers the one that the user picks at the +. The DAG's stylesheet
// moves the menu out to the gap that the panel of search keeps from the
// toolbar, which blockr.ui's menu takes no offset for.
function AddButton({ label, actions, target }: { label: string; actions: readonly BoardAction[]; target: Target }): ReactElement {
  const { actions: graph } = useGraph();
  const button = useRef<HTMLButtonElement>(null);
  return (
    <MenuTrigger placement="right top">
      <TooltipTrigger delay={DELAY}>
        <Button ref={button} variant="quiet" className="blockr-graph-control" aria-label={label}>
          <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true" className="blockr-graph-icon">
            <path d="M8 3 V13 M3 8 H13" />
          </svg>
        </Button>
        <Tooltip placement="right">{label}</Tooltip>
      </TooltipTrigger>
      <Menu
        aria-label={label}
        className="blockr-graph-add-menu"
        onAction={(key) => {
          const picked = actions.find((action) => action.id === key);
          const el = button.current;
          if (picked !== undefined && el !== null) void graph.trigger(picked.id, target, { button: el });
        }}
      >
        {actions.map((action) => (
          <MenuItem key={action.id} id={action.id}>
            {action.label}
          </MenuItem>
        ))}
      </Menu>
    </MenuTrigger>
  );
}
