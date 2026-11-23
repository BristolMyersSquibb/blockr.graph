#' The DAG plugin
#'
#' The DAG draws the board as a directed acyclic graph: a node for each block,
#' an edge for each link and a box for each stack.
#' The constructor `new_graph_plugin()` makes the DAG plugin, of class
#' `c("graph_plugin", "plugin")`, whose plugin class has the id
#' `blockr.graph-graph_plugin` (see [blockr.core::new_plugin()]).
#' The DAG keeps its state in the board, in three parts:
#'
#' * The positions, in `positions`: where the node of each block sits on the
#'   canvas, by the block's id, as a point with `x` to the right and `y`
#'   downwards, in pixels of the canvas.
#' * The stacks, in `stacks`: what the DAG keeps about a stack, by the stack's
#'   id, where it keeps anything.
#'   That is the position of a stack that holds no block, or the place among
#'   the collapses of a stack that the DAG shows collapsed, with what its
#'   collapse moved.
#' * The layout, in `layout`, as [graph_layout()] makes it.
#'
#' An app script gives the DAG its state as it builds the board, and passes the
#' plugin to [blockr.core::new_board()] in `plugins`, as in
#' `new_board(blocks, plugins = list(new_graph_plugin(positions = pos)))`.
#' A board without the DAG's state gets the default state as it opens, which
#' holds no position, so the DAG lays the whole board out.
#' A board that gives some blocks no position opens with those placed beside
#' the others.
#'
#' The constructor turns `collapsed`, a vector of stack ids such as `"s1"`,
#' into an entry in `stacks` for each stack.
#' Each entry holds the stack's place among the collapses, in the order of
#' `collapsed`, and nothing moved.
#' So expanding such a stack makes room around its box alone.
#' The constructor takes no position for a stack, since the DAG places each
#' stack that holds no block as the board opens.
#' It knows nothing of the board that holds the plugin.
#' So a position or a collapsed stack that names what the board lacks reaches
#' the client, which drops it with a warning as the board opens.
#'
#' The schema of the state ships beside the class's module, as
#' `js/graph.schema.json`, and R writes the state by it.
#' So an empty `positions` or `stacks`, and an empty part of what a collapse
#' moved, stay JSON objects, where R would otherwise write an empty list as an
#' array.
#' The class has no method of [blockr.core::plugin_version()], so its state is
#' at version 1.
#'
#' The package lists the class in the `._BLOCKR_MODULES_` that it exports,
#' with its name, "Workflow", and its module, `js/graph.js` (see
#' [blockr.core::read_blocks_yml()]).
#' So [blockr.core::available_plugins()] gives the class wherever blockr.graph
#' is available, and [blockr.core::serve()] runs the DAG on every board that
#' the app opens.
#'
#' @param positions Where the node of each block sits on the canvas, by the
#'   block's id, each a list or a named vector of the numbers `x` and `y`, as
#'   `list(a = list(x = 120, y = 80))`.
#' @param layout The layout, as [graph_layout()] makes it.
#' @param collapsed The ids of the stacks that the DAG shows collapsed, in the
#'   order in which they collapse.
#'
#' @return A `plugin` object, as [blockr.core::new_plugin()] returns it.
#'
#' @examples
#' new_graph_plugin()
#'
#' dag <- new_graph_plugin(
#'   positions = list(a = list(x = 120, y = 80), b = list(x = 120, y = 200)),
#'   layout = graph_layout(direction = "LR", spacing = "compact"),
#'   collapsed = "s1"
#' )
#'
#' str(blockr.core::plugin_state(dag))
#'
#' @export
new_graph_plugin <- function(positions = list(), layout = graph_layout(),
                             collapsed = character()) {

  if (!inherits(layout, "graph_layout")) {
    blockr_abort(
      "The layout of the DAG is expected to be made by `graph_layout()`.",
      class = "graph_layout_invalid"
    )
  }

  new_plugin(
    list(
      positions = graph_positions(positions),
      stacks = collapsed_stacks(collapsed),
      layout = unclass(layout)
    ),
    "graph_plugin"
  )
}

# The positions of blocks, by the block's id, each as a list of `x` and `y`.
# A position may come as a list or as a named vector, in either order of its
# coordinates.
graph_positions <- function(positions) {

  if (!is.list(positions) || is.object(positions) ||
        (length(positions) && !are_ids(names(positions)))) {
    blockr_abort(
      "The positions of the DAG are expected to be a list by block ID, each ",
      "ID given once.",
      class = "graph_positions_invalid"
    )
  }

  points <- lgl_ply(positions, is_point)

  if (!all(points)) {
    blockr_abort(
      "Each position of the DAG is expected to be made of two numbers, `x` ",
      "and `y`, which does not hold for ",
      "{paste_enum(names(positions)[!points])}.",
      class = "graph_positions_invalid"
    )
  }

  lapply(positions, function(x) list(x = x[["x"]], y = x[["y"]]))
}

# Whether `x` holds IDs, each given once, none of them missing or empty.
are_ids <- function(x) {
  is.character(x) && !anyNA(x) && all(nzchar(x)) && !anyDuplicated(x)
}

# Whether `x` is a point, a list or a vector of the numbers `x` and `y`.
is_point <- function(x) {
  (is.list(x) || is.numeric(x)) && !is.object(x) && length(x) == 2L &&
    setequal(names(x), c("x", "y")) &&
    is_number(x[["x"]]) && is_number(x[["y"]])
}

# An entry in `stacks` for each stack that `collapsed` names, by its id, which
# holds the stack's place among the collapses, in the order of `collapsed`,
# and nothing moved.
collapsed_stacks <- function(collapsed) {

  if (!are_ids(collapsed)) {
    blockr_abort(
      "The collapsed stacks of the DAG are expected to be a character vector ",
      "of stack IDs, each given once.",
      class = "graph_collapsed_invalid"
    )
  }

  set_names(
    lapply(
      seq_along(collapsed),
      function(i) {
        list(collapsed = i, moved = list(positions = list(), stacks = list()))
      }
    ),
    collapsed
  )
}

#' @rdname new_graph_plugin
#' @format NULL
#' @usage NULL
#' @export
._BLOCKR_MODULES_ <- list(
  plugins = list(
    new_graph_plugin = list(
      id = "graph_plugin",
      name = "Workflow",
      module = "js/graph.js"
    )
  )
)
