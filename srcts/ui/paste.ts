// How the DAG pastes as the user presses Cmd or Ctrl with V
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#keys).
// The DAG lets the browser run its own paste for the keys, rather than read
// the clipboard as it sees them: the browser hands the page the clipboard with
// its paste event without asking, since the user pasted, while it asks the
// user first where the page reads the clipboard of its own accord
// (../actions/clipboard.ts).
//
// While the keyboard's focus lies within the DAG's element, but not in a field
// or in one of its panels (./keys.ts), the DAG takes the paste event and
// triggers Paste on the board with its text. The browser may fire the event
// at the selection, or at the page's body where nothing is selected, rather
// than at the focus, as the clipboard events' specification has it, so the
// DAG listens on the whole document.

import { leavesKeys } from "./keys.ts";

// Has the DAG paste the text of each paste of the browser while the focus lies
// within its element, until the function that it returns runs.
export function onPaste(el: HTMLElement, paste: (text: string) => void): () => void {
  const doc = el.ownerDocument;
  const ours = (): boolean => {
    const focus = doc.activeElement;
    return focus !== null && el.contains(focus) && !leavesKeys(focus);
  };
  const pasted = (event: ClipboardEvent): void => {
    if (event.defaultPrevented || !ours()) return;
    event.preventDefault();
    paste(event.clipboardData?.getData("text/plain") ?? "");
  };
  doc.addEventListener("paste", pasted);
  return () => {
    doc.removeEventListener("paste", pasted);
  };
}
