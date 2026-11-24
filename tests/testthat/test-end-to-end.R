# End-to-end tests of the example apps, through shinytest2.
# Core's client and the DAG's run on the page in Chrome, under core's basic
# frontend, and the app runs in another R process.
# Each test acts on the page as a user does, and reads what the page gives:
# the board, with the DAG's state.
# They check what the tests of the DAG's UI on happy-dom cannot check, since
# happy-dom lays nothing out: the gestures that drag, the keys and the height
# that the canvas takes of its own.

test_that("the DAG draws the board in core's basic frontend", {

  app <- local_example_app("stacks")
  wait_for_dag(app)

  expect_identical(
    app_nodes(app),
    c(
      "b:bod", "b:bound", "b:cw", "b:head", "b:iris", "b:joined",
      "s:joins", "s:spare"
    )
  )

  # Core's basic frontend gives a plugin's section no height, so the canvas
  # takes half of the window's 900 pixels.
  dag <- box_of(app, "document.querySelector('.blockr-graph')")
  expect_equal(dag[["height"]], 450)

  # The view fits the board, at most at 100%.
  expect_lte(app_zoom(app), 1)
})

test_that("the DAG keeps where a drag moves a block once the drag ends", {

  app <- local_example_app("stacks")
  wait_for_dag(app)

  before <- app_position(app, "iris")
  zoom <- app_zoom(app)
  from <- center_of(app, mark_js("iris"))

  drag_mouse(
    app,
    from,
    from + c(x = 60, y = 40),
    held = function() {
      # The DAG keeps the moves in its component while the drag lasts.
      expect_equal(app_position(app, "iris"), before)
    }
  )

  wait_until(
    function() !identical(app_position(app, "iris"), before),
    function() "the DAG to keep the new position of iris"
  )

  # The block moves as far as the pointer did once the drag started, on the
  # canvas's scale, give or take the rounding of the pointer's pixels.
  expect_lte(
    max(
      abs(app_position(app, "iris") - before - c(x = 60 - NUDGE, y = 40) / zoom)
    ),
    1
  )
})

test_that("a block dropped on another stack's box joins it in one step", {

  app <- local_example_app("stacks")
  wait_for_dag(app)

  before <- app_position(app, "head")

  drag_mouse(
    app,
    center_of(app, mark_js("head")),
    center_of(app, stack_js("joins"))
  )

  wait_until(
    function() "head" %in% app_stack_blocks(app, "joins"),
    function() "head to join the stack Joins"
  )

  expect_false(isTRUE(all.equal(app_position(app, "head"), before)))

  # One undo takes back both the stack and the move.
  click_at(
    app,
    center_of(
      app,
      paste0(
        "[...document.querySelectorAll('button')]",
        ".find(b => b.textContent.trim() === 'Undo')"
      )
    )
  )

  wait_until(
    function() !"head" %in% app_stack_blocks(app, "joins"),
    function() "the undo to take head out of the stack Joins"
  )

  expect_equal(app_position(app, "head"), before)
})

test_that("a link drawn to a variadic block's placeholder takes a place", {

  app <- local_example_app("stacks")
  wait_for_dag(app)

  drag_mouse(
    app,
    center_of(app, handle_js("iris", "out-bottom")),
    center_of(app, handle_js("bound", "next"))
  )

  wait_until(
    function() nrow(app_links(app)) == 5L,
    function() "the board to gain a link"
  )

  links <- app_links(app)
  expect_identical(
    links[links$to == "bound", c("from", "input")],
    data.frame(from = c("head", "iris"), input = c("", "")),
    ignore_attr = TRUE
  )
})

test_that("a link dropped on an input that is fed says why it adds none", {

  app <- local_example_app("stacks")
  wait_for_dag(app)

  # The handle of the input y, which a link feeds, is named after the link.
  to <- center_of(
    app,
    paste0(
      "document.querySelector(\".react-flow__node[data-id='b:joined'] ",
      ".react-flow__handle[data-handleid^='in:y#']\")"
    )
  )
  drag_mouse(app, center_of(app, handle_js("iris", "out-bottom")), to)

  app$wait_for_js("document.querySelector('.blockr-graph-refusal') !== null")

  expect_match(
    app$get_js("document.querySelector('.blockr-graph-refusal').textContent"),
    "feeds the input \"y\" of block \"joined\" already",
    fixed = TRUE
  )
  expect_identical(nrow(app_links(app)), 4L)

  # The message shows where the user dropped the link.
  refusal <- box_of(app, "document.querySelector('.blockr-graph-refusal')")
  expect_lte(abs(refusal[["x"]] - (to[["x"]] + 8)), 2)
  expect_lte(abs(refusal[["y"]] - (to[["y"]] + 8)), 2)
})

test_that("the arrow keys move the selected block, in one step", {

  app <- local_example_app("stacks")
  wait_for_dag(app)

  before <- app_position(app, "iris")
  click_at(app, center_of(app, mark_js("iris")))

  for (i in 1:3) {
    press_key(app, "ArrowRight", key_code = 39L)
  }

  # The DAG runs the presses as one step only once the user pauses.
  expect_equal(app_position(app, "iris"), before)

  wait_until(
    function() !identical(app_position(app, "iris"), before),
    function() "the DAG to keep the moves of the arrow keys"
  )

  expect_equal(app_position(app, "iris") - before, c(x = 15, y = 0))
})

test_that("under the board lock, a drag moves blocks and changes no more", {

  app <- local_example_app("locked")
  wait_for_dag(app)

  expect_identical(
    app$get_js(
      "document.querySelectorAll('.react-flow__handle.connectable').length"
    ),
    0L
  )

  drag_mouse(
    app,
    center_of(app, handle_js("iris", "out-bottom")),
    center_of(app, handle_js("joined", "in:y"))
  )

  before <- app_position(app, "head")
  drag_mouse(
    app,
    center_of(app, mark_js("head")),
    center_of(app, stack_js("joins"))
  )

  wait_until(
    function() !identical(app_position(app, "head"), before),
    function() "the DAG to keep the new position of head"
  )

  expect_identical(nrow(app_links(app)), 2L)
  expect_identical(app_stack_blocks(app, "joins"), c("bod", "cw", "joined"))
})
