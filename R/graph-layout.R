#' The layout of the DAG
#'
#' The layout holds how the DAG arranges the board: the way that the board
#' runs and its gaps, which laying the board out again follows, how a block
#' that a step adds gets its place, and whether the DAG snaps the positions
#' that it sets.
#' The constructor [new_graph_plugin()] takes the layout that a board starts
#' with.
#'
#' Under `"repulsion"`, the default, the DAG keeps what a step adds where it
#' starts, such as between the two blocks of a link that a block is inserted
#' into.
#' It then moves the blocks around it, the nearest the most, to make room.
#' Under `"beside"`, it moves what a step adds to the nearest free spot
#' instead, and moves no other block.
#'
#' @param direction `"TB"`, from top to bottom, or `"LR"`, from left to right.
#' @param spacing `"normal"`, `"compact"` or `"loose"`: the gaps between
#'   blocks and between ranks.
#' @param placement `"repulsion"` or `"beside"`: how what a step adds gets its
#'   place.
#' @param snap Whether every position that the DAG sets snaps to a multiple of
#'   `snap_size`.
#' @param snap_size The size that positions snap to, in pixels of the canvas.
#'
#' @return An object of class `graph_layout`, a list of the five settings.
#'
#' @examples
#' graph_layout()
#'
#' graph_layout(direction = "LR", placement = "beside", snap = TRUE)
#'
#' @export
graph_layout <- function(direction = c("TB", "LR"),
                         spacing = c("normal", "compact", "loose"),
                         placement = c("repulsion", "beside"),
                         snap = FALSE, snap_size = 20) {

  if (!is_bool(snap)) {
    blockr_abort(
      "Whether the DAG snaps positions is expected to be `TRUE` or `FALSE`.",
      class = "graph_layout_invalid"
    )
  }

  if (!is_number(snap_size) || snap_size <= 0) {
    blockr_abort(
      "The size that the DAG snaps positions to is expected to be a number ",
      "above 0.",
      class = "graph_layout_invalid"
    )
  }

  structure(
    list(
      direction = match.arg(direction),
      spacing = match.arg(spacing),
      placement = match.arg(placement),
      snap = snap,
      snap_size = snap_size
    ),
    class = "graph_layout"
  )
}
