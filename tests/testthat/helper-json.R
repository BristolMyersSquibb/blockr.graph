# The JSON that R writes for a value, as core's `encode_message()` writes it:
# every vector of length one bare, unless `I()` marks it as an array.
write_json <- function(x) {
  yyjsonr::write_json_str(
    x,
    opts = yyjsonr::opts_write_json(auto_unbox = TRUE)
  )
}

# Reads JSON keeping every array an array, as a length-one vector marked with
# `I()`, and every number a double, since JSON tells no integer from a double.
# An empty object reads as a named empty list and an empty array as an empty
# list, so two texts read identically only where they hold the same JSON.
read_json_strictly <- function(x) {

  as_double <- function(x) {

    if (is.list(x)) {
      x[] <- lapply(x, as_double)
    } else if (is.integer(x)) {
      storage.mode(x) <- "double"
    }

    x
  }

  as_double(
    yyjsonr::read_json_str(
      x,
      opts = yyjsonr::opts_read_json(
        obj_of_arrs_to_df = FALSE,
        arr_of_objs_to_df = FALSE,
        arr_of_arrs_to_matrix = FALSE,
        length1_array_asis = TRUE,
        int64 = "double",
        num_specials = "string"
      )
    )
  )
}

# What R writes for the DAG's plugin into the JSON board of `board`, its state
# and its version, read back from the JSON.
written_graph_plugin <- function(board) {
  plugins <- blockr_ser(board)[["board"]][["plugins"]]
  read_json_strictly(write_json(plugins[["blockr.graph"]][["graph_plugin"]]))
}
