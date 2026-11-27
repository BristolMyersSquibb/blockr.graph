// The tooltips of the DAG's handles and status dots: blockr.ui's
// TooltipTrigger and Tooltip, which show the tooltip after the pointer rests on
// the element for a moment, and hide it as the pointer leaves the element or
// presses on it.
// React Aria's Focusable passes the trigger's handlers to the element, beside
// the element's own, as a handle keeps React Flow's, which start a link as the
// user presses on it.
// Focusable also lets the element take the keyboard's focus, so that the
// tooltip shows as the focus reaches the element.
// React Aria warns where such an element has no role with which a screen
// reader names the tooltip.
// So the status dot has the role "img", and a handle the role "button", since
// a press on a handle starts a link.
// No tooltip shows for a touch, which has no hover.

import { Focusable, Tooltip, TooltipTrigger } from "@blockr/ui";
import type { ComponentProps, ReactElement } from "react";

// How long the pointer rests on an element before its tooltip shows.
const DELAY = 600;

// What Focusable takes: an element of the page, by its types. React Flow's
// Handle is a component, which passes the props and the ref that Focusable
// gives it to its element, as an element of the page takes them.
type Trigger = ComponentProps<typeof Focusable>["children"];

export function Tip({ label, children }: { label: string; children: ReactElement }): ReactElement {
  return (
    <TooltipTrigger delay={DELAY} closeDelay={0}>
      <Focusable>{children as Trigger}</Focusable>
      <Tooltip placement="top">{label}</Tooltip>
    </TooltipTrigger>
  );
}
