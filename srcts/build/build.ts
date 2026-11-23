// Builds the DAG's client into inst/js, which the R package ships and git
// keeps, since R CMD check and CRAN run no Node. Run: npm run build
//
// - A module, srcts/modules/<name>/index.ts, is bundled into <name>.js, as the
//   module of the DAG plugin's class is into graph.js.
// - Each takes the build preset that blockr.core ships as `@blockr/core/build`,
//   which leaves the imports that the page's import map names, such as React
//   and core's React SDK, imports. So no bundle holds any of them.
// - The builds of the modules take the vendor check that blockr.core ships
//   beside the preset. It fails the build where a module's bundle would hold
//   code from node_modules, so that a bundle holds only the DAG's own code,
//   unminified, and a diff of inst/js shows what an edit of srcts changed.
// - The build generates the JSON Schema of the DAG plugin's state from the
//   type GraphState in srcts/state/types.ts, as core's build generates the
//   schema of a block's state. It writes it beside the DAG's module, as
//   graph.schema.json, where R finds it. The DAG's module imports the file as
//   the schema of its class's state, so the build writes it before it
//   bundles.
// - What each file that the build writes imports up front goes into
//   preload.json, by staticImports() from `@blockr/core/build`, as core's
//   build writes its own.
//   R names those files in the head of the page that it serves.
//   So the browser fetches them as the page loads, rather than each once the
//   file that imports it has loaded.
//
// The build owns inst/js and empties it first, so that nothing is left of a
// module that is gone.

import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { preset, staticImports, vendorCheck } from "@blockr/core/build";
import * as esbuild from "esbuild";
import { createGenerator } from "ts-json-schema-generator";

interface Entry {
  readonly name: string;
  readonly dir: string;
}

// The modules, each by the name of the file that it is bundled into and its
// directory.
async function modules(src: string): Promise<Entry[]> {
  const dir = join(src, "modules");
  const dirs = existsSync(dir) ? await readdir(dir, { withFileTypes: true }) : [];
  return dirs
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ name: entry.name, dir: join(dir, entry.name) }));
}

// Builds the client of the package at `root` and gives the files it wrote,
// relative to `root`.
export async function build(root: string): Promise<string[]> {
  const out = join(root, "inst", "js");
  const entries = await modules(join(root, "srcts"));

  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const schemas = await stateSchema(root, out);

  const results =
    entries.length === 0
      ? []
      : [
          await esbuild.build({
            ...preset,
            absWorkingDir: root,
            outdir: out,
            logLevel: "warning",
            metafile: true,
            plugins: [...preset.plugins, vendorCheck],
            entryPoints: entries.map((entry) => ({ in: join(entry.dir, "index.ts"), out: entry.name })),
          }),
        ];

  if (results.some((result) => result.warnings.length > 0)) {
    throw new Error("esbuild warned, as printed above");
  }

  return [
    ...results.flatMap((result) => Object.keys(result.metafile.outputs)),
    ...schemas,
    await preloadList(root, out, results.map((result) => result.metafile)),
  ].sort();
}

// Writes what the files in `out` import up front into `out`, as preload.json,
// and gives its path from `root`.
// The file holds the static imports of the files that the builds of
// `metafiles` wrote.
async function preloadList(root: string, out: string, metafiles: readonly esbuild.Metafile[]): Promise<string> {
  const file = join(out, "preload.json");
  await writeFile(file, `${JSON.stringify(staticImports(metafiles), null, 2)}\n`);
  return relative(root, file);
}

// Writes the JSON Schema of the DAG plugin's state, from the type GraphState
// that srcts/state/types.ts exports, into `out` as graph.schema.json, beside
// the module of the DAG plugin's class, and gives the file it wrote, relative
// to `root`.
// The schema allows no property that the types do not declare, and each type
// that the file exports is a definition of its own, as in core's schemas.
async function stateSchema(root: string, out: string): Promise<string[]> {
  const source = join(root, "srcts", "state", "types.ts");
  if (!existsSync(source)) return [];

  const schema = createGenerator({
    path: source,
    tsconfig: join(root, "tsconfig.client.json"),
    expose: "export",
    topRef: false,
    additionalProperties: false,
    skipTypeCheck: true,
  }).createSchema("GraphState");

  const file = join(out, "graph.schema.json");
  await writeFile(file, `${JSON.stringify(schema, null, 2)}\n`);
  return [relative(root, file)];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const file of await build(resolve(dirname(fileURLToPath(import.meta.url)), "../.."))) {
    console.log(file);
  }
}
