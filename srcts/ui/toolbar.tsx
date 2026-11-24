// The DAG's toolbar, which floats in a column at the canvas's top left, as
// today, with the DAG's own controls: search, zoom in, zoom out and fit
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#the-toolbar).
// Each control is a button of core's React SDK with an icon, whose label is
// its tooltip.
// The buttons of the board actions follow them, once the DAG offers board
// actions.

import { Button, Toolbar, Tooltip, TooltipTrigger, useBoard } from "@blockr/core/react";
import type { ReactElement, ReactNode } from "react";
import { useReactFlow } from "../flow/index.ts";
import { canvasOf } from "../geometry/index.ts";
import { defaultState, graphState } from "../state/index.ts";
import { useGraph } from "./context.ts";
import { fittedView } from "./view.ts";

// How long zooming and fitting take on the screen.
const DURATION = 200;

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
  const flow = useReactFlow();
  const fit = () => {
    const view = fittedView(canvasOf(board, graphState(board, plugin) ?? defaultState), size);
    if (view !== undefined) void flow.setViewport(view, { duration: DURATION });
  };
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
    <TooltipTrigger delay={600}>
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
