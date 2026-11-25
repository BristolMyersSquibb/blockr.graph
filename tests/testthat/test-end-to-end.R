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

test_that("the DAG takes core's dark mode in a container of the light mode", {

  app <- local_example_app("stacks")
  wait_for_dag(app)

  # The dock's shell holds the DAG in the light mode of dockview's theme while
  # core's mode is dark.
  # The canvas then paints the dark mode's Canvas, and the toolbar is of the
  # dark mode as well.
  modes <- app$get_js(
    "(() => {
      document.documentElement.setAttribute('data-bc-theme', 'dark');
      const graph = document.querySelector('.blockr-graph');
      graph.parentElement.style.colorScheme = 'light';
      const probe = document.createElement('div');
      probe.style.cssText = 'color-scheme: dark; background: Canvas';
      document.body.append(probe);
      const dark = getComputedStyle(probe).backgroundColor;
      probe.remove();
      const toolbar = document.querySelector('.blockr-graph-toolbar');
      return {
        graph: getComputedStyle(graph).colorScheme,
        toolbar: getComputedStyle(toolbar).colorScheme,
        painted: getComputedStyle(graph).backgroundColor === dark
      };
    })()"
  )

  expect_identical(modes[["graph"]], "dark")
  expect_identical(modes[["toolbar"]], "dark")
  expect_true(modes[["painted"]])
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

test_that("a link dropped on the canvas appends a block at the drop", {

  app <- local_example_app("stacks")
  wait_for_dag(app)

  # A spot at the canvas's lower left, which no node covers.
  dag <- box_of(app, "document.querySelector('.blockr-graph')")
  to <- c(x = dag[["x"]] + 60, y = dag[["y"]] + dag[["height"]] - 40)
  expect_identical(
    app$get_js(
      paste0(
        "document.elementFromPoint(", to[["x"]], ", ", to[["y"]], ")",
        ".closest('.react-flow__node') === null"
      )
    ),
    TRUE
  )
  drop <- canvas_point(app, to)

  before <- app_blocks(app)
  drag_mouse(app, center_of(app, handle_js("iris", "out-bottom")), to)

  # Append block's quick action opens at the drop, with the block classes.
  app$wait_for_js("document.querySelector('[role=menu]') !== null")
  click_row(app, "head/tail block")

  wait_until(
    function() length(app_blocks(app)) == length(before) + 1L,
    function() "the board to gain the appended block"
  )

  added <- setdiff(app_blocks(app), before)
  links <- app_links(app)
  expect_identical(links[links$to == added, "from"], "iris")
  expect_lte(max(abs(app_position(app, added) - drop)), 1)
})

test_that("Ctrl+C and Ctrl+V paste the block near the middle, on nothing", {

  app <- local_example_app("stacks")
  wait_for_dag(app)

  click_at(app, center_of(app, mark_js("bod")))
  press_key(app, "c", "KeyC", 67L, CTRL)

  dag <- box_of(app, "document.querySelector('.blockr-graph')")
  middle <- canvas_point(
    app,
    c(
      x = dag[["x"]] + dag[["width"]] / 2,
      y = dag[["y"]] + dag[["height"]] / 2
    )
  )

  before <- app_blocks(app)
  press_key(app, "v", "KeyV", 86L, CTRL)

  wait_until(
    function() length(app_blocks(app)) == length(before) + 1L,
    function() "the board to gain the pasted block"
  )

  added <- setdiff(app_blocks(app), before)
  expect_identical(app_board(app)[["blocks"]][[added]][["name"]], "Dataset")

  # The view's middle lies in the box of the stack Joins, so the block lands
  # at the free spot nearest the middle, whose node meets no other node, the
  # box of a stack included.
  expect_lte(sqrt(sum((app_position(app, added) - middle)^2)), 250)
  met <- app$get_js(
    sprintf(
      "(() => {
        const nodes = [
          ...document.querySelectorAll('.blockr-graph .react-flow__node')
        ];
        const box = (n) => n.getBoundingClientRect();
        const pasted = box(nodes.find((n) => n.dataset.id === 'b:%s'));
        return nodes.filter((n) => n.dataset.id !== 'b:%s').filter((n) => {
          const r = box(n);
          return r.left < pasted.right && pasted.left < r.right &&
            r.top < pasted.bottom && pasted.top < r.bottom;
        }).map((n) => n.dataset.id);
      })()",
      added,
      added
    )
  )
  expect_length(met, 0L)
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
