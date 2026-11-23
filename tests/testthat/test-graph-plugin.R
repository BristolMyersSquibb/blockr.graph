test_that("the DAG plugin is a plugin of its own class", {

  x <- new_graph_plugin()

  expect_s3_class(x, c("graph_plugin", "plugin"), exact = TRUE)
  expect_identical(plugin_class_id(x), "blockr.graph-graph_plugin")
})

test_that("the DAG's state has version 1 and a schema beside its module", {

  expect_identical(plugin_version(new_graph_plugin()), 1L)

  schema <- read_json_schema("js/graph.schema.json", package = "blockr.graph")

  expect_named(schema[["properties"]], c("positions", "stacks", "layout"))
})

test_that("the package lists the class with its name and module", {

  expect_identical(
    ._BLOCKR_MODULES_[["plugins"]],
    list(
      new_graph_plugin = list(
        id = "graph_plugin",
        name = "Workflow",
        module = "js/graph.js"
      )
    )
  )

  expect_true(nzchar(system.file("js/graph.js", package = "blockr.graph")))
})

test_that("core finds the DAG's plugin class in the package's listing", {

  plugins <- available_plugins()

  expect_identical(
    plugins[plugins[["package"]] == "blockr.graph", "id"],
    "graph_plugin"
  )
})

test_that("the default state holds no position and the default layout", {

  state <- plugin_state(new_graph_plugin())

  expect_named(state, c("positions", "stacks", "layout"))
  expect_length(state[["positions"]], 0L)
  expect_length(state[["stacks"]], 0L)
  expect_identical(state[["layout"]], unclass(graph_layout()))
})

test_that("R writes the empty parts of the default state as JSON objects", {

  board <- new_board(plugins = list(new_graph_plugin()))

  expect_identical(
    written_graph_plugin(board),
    read_json_strictly(
      '{
        "state": {
          "positions": {},
          "stacks": {},
          "layout": {
            "direction": "TB",
            "spacing": "normal",
            "placement": "repulsion",
            "snap": false,
            "snap_size": 20
          }
        },
        "version": 1
      }'
    )
  )
})

test_that("R writes the positions, the collapsed stacks and the layout", {

  board <- new_board(
    blocks = c(a = new_dataset_block(), b = new_head_block()),
    stacks = list(s1 = new_stack("b")),
    plugins = list(
      new_graph_plugin(
        positions = list(
          a = list(x = 120, y = 80),
          b = list(x = 120, y = 200)
        ),
        layout = graph_layout(
          direction = "LR",
          spacing = "compact",
          placement = "beside",
          snap = TRUE,
          snap_size = 10
        ),
        collapsed = "s1"
      )
    )
  )

  # What the collapse moved stays two JSON objects, though both are empty.
  expect_identical(
    written_graph_plugin(board),
    read_json_strictly(
      '{
        "state": {
          "positions": {
            "a": { "x": 120, "y": 80 },
            "b": { "x": 120, "y": 200 }
          },
          "stacks": {
            "s1": { "collapsed": 1, "moved": { "positions": {}, "stacks": {} } }
          },
          "layout": {
            "direction": "LR",
            "spacing": "compact",
            "placement": "beside",
            "snap": true,
            "snap_size": 10
          }
        },
        "version": 1
      }'
    )
  )
})

test_that("each collapsed stack gets its place in the order given", {

  state <- plugin_state(new_graph_plugin(collapsed = c("s2", "s1", "s3")))

  nothing_moved <- list(positions = list(), stacks = list())

  expect_identical(
    state[["stacks"]],
    list(
      s2 = list(collapsed = 1L, moved = nothing_moved),
      s1 = list(collapsed = 2L, moved = nothing_moved),
      s3 = list(collapsed = 3L, moved = nothing_moved)
    )
  )
})

test_that("a position is kept as x and y, whichever way it is given", {

  state <- plugin_state(
    new_graph_plugin(
      positions = list(a = c(y = 80, x = 120), b = list(y = 200L, x = 40L))
    )
  )

  expect_identical(
    state[["positions"]],
    list(a = list(x = 120, y = 80), b = list(x = 40L, y = 200L))
  )
})

test_that("the constructor refuses positions that are no list by block ID", {

  for (positions in list(
    NULL,
    data.frame(x = 1, y = 2),
    list(list(x = 1, y = 2)),
    list(a = list(x = 1, y = 2), a = list(x = 3, y = 4)),
    set_names(list(list(x = 1, y = 2)), "")
  )) {
    expect_error(
      new_graph_plugin(positions = positions),
      class = "graph_positions_invalid"
    )
  }
})

test_that("the constructor names each block whose position is no point", {

  expect_error(
    new_graph_plugin(
      positions = list(
        a = list(x = 1),
        b = list(x = 1, y = 2),
        c = list(x = "1", y = 2),
        d = list(x = 1, y = 2, z = 3),
        e = list(x = NA_real_, y = 2),
        f = list(x = c(1, 2), y = 2)
      )
    ),
    "`a`, `c`, `d`, `e` and `f`",
    class = "graph_positions_invalid"
  )
})

test_that("the constructor refuses a layout that graph_layout() did not make", {

  expect_error(
    new_graph_plugin(layout = list(direction = "LR")),
    class = "graph_layout_invalid"
  )
})

test_that("the constructor refuses collapsed stacks that are no stack IDs", {

  for (collapsed in list(NULL, 1, NA_character_, "", c("s1", "s1"))) {
    expect_error(
      new_graph_plugin(collapsed = collapsed),
      class = "graph_collapsed_invalid"
    )
  }
})
