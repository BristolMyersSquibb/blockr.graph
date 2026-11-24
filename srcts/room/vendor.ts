// The part of WebCola that making room uses: its solver of VPSC, which finds
// along one axis the places nearest the nodes' targets that keep the
// constraints, and solves that exactly (Dwyer, Marriott and Stuckey, "Fast
// Node Overlap Removal", Graph Drawing 2005).
// The build bundles it, minified, into vpsc-<hash>.js, which the DAG's module
// imports in place of this file. WebCola's module of VPSC imports nothing,
// so the bundle holds none of the rest of WebCola.

export { Constraint, Solver, Variable } from "webcola/dist/src/vpsc.js";
