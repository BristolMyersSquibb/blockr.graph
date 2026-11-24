# What the end-to-end tests use.
# They drive Chrome through shinytest2, and act on the page as a user does,
# with the mouse input, the drags and the keys that they send through Chrome's
# DevTools protocol.
# They read what core gives end-to-end tests through `blockrTest` on the page:
# the board, with the DAG's state.

# Starts an example app from `inst/examples`, by its name, with shinytest2, and
# stops it as the test ends.
# The window is 1400 pixels wide and 900 high, so that core's basic frontend
# lays out each example at the same size, and the DAG's canvas takes half the
# window's height.
# The example's script attaches blockr.graph with `library()`.
# The tests may run from the package's source, as `devtools::test()` runs
# them.
# Then shinytest2 has that call load the source with `pkgload::load_all()`.
# So the app runs the DAG under test, and not an older install.
# Under `R CMD check`, the app runs the package that the check installed.
local_example_app <- function(name, frame = parent.frame()) {

  testthat::skip_on_cran()
  testthat::skip_if_not_installed("shinytest2")

  chrome <- try(chromote::default_chromote_object(), silent = TRUE)
  testthat::skip_if(inherits(chrome, "try-error"), "Chrome does not start.")

  app <- shinytest2::AppDriver$new(
    system.file("examples", name, "app.R", package = "blockr.graph"),
    load_timeout = 30 * 1000,
    timeout = 30 * 1000,
    width = 1400,
    height = 900
  )

  withr::defer(app$stop(), envir = frame)

  app
}

# Waits until the DAG has drawn the board's blocks and fitted its view to
# them, which moves the view from where React Flow starts it, and fails with
# the page's text after `timeout` seconds without them.
wait_for_dag <- function(app, timeout = 30) {

  drawn <- try(
    app$wait_for_js(
      paste0(
        "window.blockrTest !== undefined && blockrTest.board() !== null && ",
        "document.querySelectorAll('.blockr-graph .react-flow__node')",
        ".length > 0 && ",
        "document.querySelector('.react-flow__viewport').style.transform !== ",
        "'translate(0px, 0px) scale(1)'"
      ),
      timeout = timeout * 1000
    ),
    silent = TRUE
  )

  if (inherits(drawn, "try-error")) {
    stop(
      "The DAG drew no board within ", timeout, " seconds. The page shows:\n",
      app$get_js("document.body.innerText"),
      call. = FALSE
    )
  }

  invisible(app)
}

# The board that the client holds, as the page gives it.
app_board <- function(app) {
  app$get_js("blockrTest.board()")
}

# The DAG's state on the board that the client holds.
app_dag <- function(app) {
  app_board(app)[["plugins"]][["blockr.graph-graph_plugin"]]
}

# The position of a block, as the DAG's state holds it, as a named vector.
app_position <- function(app, block) {
  unlist(app_dag(app)[["positions"]][[block]])
}

# The blocks of a stack of the board that the client holds.
app_stack_blocks <- function(app, stack) {
  unlist(app_board(app)[["stacks"]][[stack]][["blocks"]])
}

# The links of the board, as a data frame of their blocks and inputs.
app_links <- function(app) {
  links <- app_board(app)[["links"]]
  data.frame(
    from = chr_xtr(links, "from"),
    to = chr_xtr(links, "to"),
    input = chr_xtr(links, "input")
  )
}

# The ids of the nodes that the DAG draws, sorted: "b:" and a block's id for a
# block, and "s:" and a stack's id for a stack.
app_nodes <- function(app) {
  sort(
    unlist(
      app$get_js(
        paste0(
          "[...document.querySelectorAll('.blockr-graph .react-flow__node')]",
          ".map(n => n.dataset.id)"
        )
      )
    )
  )
}

# The zoom of the DAG's view, as the scale of the canvas.
app_zoom <- function(app) {
  as.numeric(
    sub(
      ".*scale\\(([0-9.]+)\\).*", "\\1",
      app$get_js(
        "document.querySelector('.react-flow__viewport').style.transform"
      )
    )
  )
}

# Waits until `check()` gives `TRUE`, and fails with what `what()` says once
# `timeout` seconds have passed.
wait_until <- function(check, what, timeout = 30) {

  deadline <- Sys.time() + timeout

  repeat {

    if (isTRUE(check())) {
      return(invisible())
    }

    if (Sys.time() > deadline) {
      stop("Waited ", timeout, " seconds for ", what(), call. = FALSE)
    }

    Sys.sleep(0.1)
  }
}

# The JS that finds the mark of a block's node.
mark_js <- function(block) {
  paste0(
    "document.querySelector(",
    "\".react-flow__node[data-id='b:", block, "'] .blockr-graph-mark\"",
    ")"
  )
}

# The JS that finds the box of a stack's node.
stack_js <- function(stack) {
  paste0(
    "document.querySelector(\".react-flow__node[data-id='s:", stack, "']\")"
  )
}

# The JS that finds a handle of a block's node, by the handle's id.
handle_js <- function(block, handle) {
  paste0(
    "document.querySelector(",
    "\".react-flow__node[data-id='b:", block, "'] ",
    ".react-flow__handle[data-handleid='", handle, "']\"",
    ")"
  )
}

# The box of the element that the JS given finds, as its left, top, width
# and height in CSS pixels.
box_of <- function(app, js) {

  box <- app$get_js(
    paste0(
      "(() => {\n",
      "  const el = ", js, ";\n",
      "  if (!el) return null;\n",
      "  const box = el.getBoundingClientRect();\n",
      "  return [box.x, box.y, box.width, box.height];\n",
      "})()"
    )
  )

  if (is.null(box)) {
    stop("The page holds no element for ", js, call. = FALSE)
  }

  set_names(as.numeric(unlist(box)), c("x", "y", "width", "height"))
}

# The point at the middle of the element that the JS given finds.
center_of <- function(app, js) {
  box <- box_of(app, js)
  c(
    x = box[["x"]] + box[["width"]] / 2,
    y = box[["y"]] + box[["height"]] / 2
  )
}

# Sends the mouse event of the type given at the point given, with the left
# button down where `buttons` is 1.
mouse <- function(app, type, at, buttons = 0L, ...) {
  invisible(
    app$get_chromote_session()$Input$dispatchMouseEvent(
      type = type,
      x = at[["x"]],
      y = at[["y"]],
      button = "left",
      buttons = buttons,
      ...
    )
  )
}

# Clicks at the point given, as a user does: the pointer moves there, and the
# left button goes down and up.
click_at <- function(app, at) {
  mouse(app, "mouseMoved", at)
  mouse(app, "mousePressed", at, 1L, clickCount = 1L)
  mouse(app, "mouseReleased", at, 0L, clickCount = 1L)
}

# Drags with the left button from one point to another, in steps, and rests
# there before the button goes up, as a user does.
# React Flow starts to drag a node only once the pointer has moved past its
# drag threshold, and the node follows the pointer from there, so the pointer
# first moves NUDGE pixels to the right, which the node does not follow.
# React Flow applies each move of the pointer as the next frame is drawn, so a
# button that goes up at once would lose the last move.
# The function `held()` runs once the pointer rests at `to`, before the
# button goes up.
drag_mouse <- function(app, from, to, held = function() NULL, steps = 20L) {

  mouse(app, "mouseMoved", from)
  mouse(app, "mousePressed", from, 1L, clickCount = 1L)

  start <- from + c(x = NUDGE, y = 0)
  mouse(app, "mouseMoved", start, 1L)
  Sys.sleep(0.05)

  for (i in seq_len(steps)) {
    mouse(app, "mouseMoved", start + (to - start) * i / steps, 1L)
    Sys.sleep(0.02)
  }

  Sys.sleep(0.2)
  held()

  mouse(app, "mouseReleased", to, 0L, clickCount = 1L)
}

NUDGE <- 2

# Presses a key, as the element that has the keyboard's focus takes it, with
# the modifiers that DevTools' bit field gives, as 2 for Ctrl.
press_key <- function(app, key, code = key, key_code = 0L, modifiers = 0L) {
  page <- app$get_chromote_session()
  page$Input$dispatchKeyEvent(
    type = "rawKeyDown", key = key, code = code,
    windowsVirtualKeyCode = key_code, modifiers = modifiers
  )
  page$Input$dispatchKeyEvent(
    type = "keyUp", key = key, code = code,
    windowsVirtualKeyCode = key_code, modifiers = modifiers
  )
}

CTRL <- 2L

# The point on the canvas under a point on the page, from the view's pan and
# zoom.
canvas_point <- function(app, at) {
  view <- app$get_js(
    "document.querySelector('.react-flow__viewport').style.transform"
  )
  numbers <- as.numeric(regmatches(view, gregexpr("-?[0-9.]+", view))[[1]])
  dag <- box_of(app, "document.querySelector('.blockr-graph')")
  c(
    x = (at[["x"]] - dag[["x"]] - numbers[[1]]) / numbers[[3]],
    y = (at[["y"]] - dag[["y"]] - numbers[[2]]) / numbers[[3]]
  )
}

# The ids of the blocks of the board that the client holds.
app_blocks <- function(app) {
  names(app_board(app)[["blocks"]])
}

# Clicks the row of the menu of board actions that is open, by the start of
# its text.
click_row <- function(app, text) {
  click_at(
    app,
    center_of(
      app,
      paste0(
        "[...document.querySelectorAll('[role=menu] [role^=menuitem]')]",
        ".find(row => row.textContent.trim().startsWith('", text, "'))"
      )
    )
  )
}
