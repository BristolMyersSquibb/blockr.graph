# blockr.graph

<!-- badges: start -->
[![lifecycle](https://img.shields.io/badge/lifecycle-experimental-orange.svg)](https://lifecycle.r-lib.org/articles/stages.html#experimental)
<!-- badges: end -->

This package holds a plugin that draws a [blockr](https://github.com/BristolMyersSquibb/blockr) board as a directed acyclic graph (DAG) in the browser.
The DAG shows the blocks of the board, the links between them and the stacks that group them.

The plugin is written for the next version of blockr.
In that version, the browser holds the state of a board, and R evaluates its blocks.
Until that version is released, the package is developed on the [`js-state`](https://github.com/BristolMyersSquibb/blockr.graph/tree/js-state) branch.
The main branch holds only this README and the licence.
For the current version of blockr, [blockr.dag](https://github.com/BristolMyersSquibb/blockr.dag) draws the DAG.
