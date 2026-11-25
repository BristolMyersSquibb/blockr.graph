// The clipboard of the DAG's Copy, Cut and Paste
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#the-dags-board-actions):
//
// - Copy writes to the system's clipboard within the user's gesture, as Safari
//   requires: it starts the write before it waits for anything. A page that is
//   not served over HTTPS or from the local machine has no clipboard API, and
//   a browser may refuse the API's write, so the text then goes on the
//   clipboard through the document's copy command, as core's Copy block ID
//   does.
// - Copy also keeps its last copy for the page.
// - Paste takes the text of the browser's paste where the user pressed Cmd or
//   Ctrl with V, which the DAG's UI notes as it triggers Paste
//   (../ui/paste.ts). The browser hands the page the clipboard with its paste
//   event without asking, since the user pasted.
// - Otherwise, as from a menu or the toolbar, Paste reads the system's
//   clipboard, which carries a copy from another tab or app. A page that
//   reads the clipboard of its own accord gets it only once the user agrees:
//   Safari and Firefox show a button "Paste" for the user to press, and
//   Chrome asks the user for a permission. Where the browser refuses to read
//   it, as it does where the user declines and as headless browsers do, Paste
//   takes the page's last copy instead.

// The page's last copy.
let last: string | undefined;

// The text of the browser's paste, for the next read alone.
let pasted: string | undefined;

// Notes the text of the browser's paste for the next read, or forgets it.
export function notePasted(text: string | undefined): void {
  pasted = text;
}

// Puts the text on the clipboard and keeps it as the page's last copy, and
// resolves whether the system's clipboard took it.
export function writeClipboard(doc: Document, text: string): Promise<boolean> {
  last = text;
  const clipboard = clipboardOf(doc);
  if (clipboard === undefined) return Promise.resolve(copyCommand(doc, text));
  return clipboard.writeText(text).then(
    () => true,
    () => copyCommand(doc, text),
  );
}

// The text of the browser's paste that the UI noted, or else the text that the
// system's clipboard holds, or the page's last copy where the browser refuses
// to read the clipboard, or undefined where the page has copied nothing
// either.
export async function readClipboard(doc: Document): Promise<string | undefined> {
  if (pasted !== undefined) {
    const text = pasted;
    pasted = undefined;
    return text;
  }
  const clipboard = clipboardOf(doc);
  if (clipboard === undefined) return last;
  try {
    return await clipboard.readText();
  } catch {
    return last;
  }
}

function clipboardOf(doc: Document): Clipboard | undefined {
  const { clipboard } = (doc.defaultView?.navigator ?? {}) as Partial<Pick<Navigator, "clipboard">>;
  return clipboard;
}

// Puts the text on the clipboard through the document's copy command, from a
// field that it selects for the command and removes again, and gives the
// focus back to what had it.
function copyCommand(doc: Document, text: string): boolean {
  const before = doc.activeElement;
  const field = doc.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.cssText = "position: fixed; inset-block-start: 0; opacity: 0;";
  doc.body.append(field);
  field.select();
  try {
    // The copy command is the last resort where the page has no clipboard
    // API, which a page served over HTTP lacks.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return doc.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
    if (before instanceof HTMLElement) before.focus({ preventScroll: true });
  }
}
