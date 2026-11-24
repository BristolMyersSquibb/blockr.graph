// Builds the DAG's client into inst/js, which the R package ships and git
// keeps, since R CMD check and CRAN run no Node. Run: npm run build
//
// - A module, srcts/modules/<name>/index.ts or, where it draws with React,
//   index.tsx, is bundled into <name>.js, as the module of the DAG plugin's
//   class is into graph.js.
// - Each takes the build preset that blockr.core ships as `@blockr/core/build`,
//   which leaves the imports that the page's import map names, such as React
//   and core's React SDK, imports. So no bundle holds any of them.
// - An index.css beside a module is its stylesheet, bundled, unminified, into
//   <name>.css, as the DAG's into graph.css. R serves it beside the module.
// - The builds of the modules and of their stylesheets take the vendor check
//   that blockr.core ships beside the preset. It fails the build where one of
//   those files would hold code from node_modules, so that it holds only the
//   DAG's own code, unminified, and a diff of inst/js shows what an edit of
//   srcts changed.
//   It fails where a file of the DAG imports dagre, WebCola or React Flow
//   other than through the files of VENDORED, below.
// - The packages that the DAG bundles from other projects are those that
//   package.json lists in `dependencies`: dagre, WebCola and React Flow. Each
//   file of VENDORED names the part of them that one part of the DAG uses, and
//   is bundled, minified, into a file of its own, named by the start of its
//   name in VENDORED and a hash of its content, so that no browser runs an old
//   copy from its cache:
//   - WebCola's solver of VPSC, through which the DAG makes room, from
//     srcts/room/vendor.ts into vpsc-<hash>.js, which the DAG's module imports
//     up front, since the class's afterStep makes room as a step ends.
//   - The layout library dagre, through which the DAG lays a board out, from
//     srcts/layout/vendor.ts into dagre-<hash>.js, which the DAG loads only
//     once it lays a board out, as core bundles the parts of OpenTelemetry's
//     SDK that it loads on demand into a file of their own.
//   - React Flow, which draws the DAG, from srcts/flow/vendor.ts into
//     xyflow-<hash>.js, which the DAG's module imports up front, and its
//     stylesheet, from srcts/flow/vendor.css into xyflow-<hash>.css, which the
//     DAG's stylesheet imports. React Flow's script keeps its imports of
//     React, which the preset leaves imports, and gets the preset's runtime
//     of the React Compiler in place of the one that it imports.
//   Each import of such a file, the dynamic one and a stylesheet's `@import`
//   included, becomes an import of its bundle, beside the module, where R
//   serves it too. The build fails where such a file imports a package that
//   package.json does not list in `dependencies`.
// - The licenses of what the files in inst/js hold from other projects go
//   into LICENSES beside them, as blockr.core's build writes its own, since
//   no bundled file keeps its license. It has a line for each package from
//   node_modules, with its version, its author where its package.json names
//   one, and the files that hold its code. The text of a license follows the
//   lines that share it. The build fails for a package without a license
//   file, so that no code ships without its license.
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
//   The module imports dagre's bundle only as it runs, so its list leaves that
//   out, and a bundle that imports others up front has a list of its own, as
//   React Flow's imports React.
//
// The build owns inst/js and empties it first, so that nothing is left of a
// file that it no longer writes.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { preset, staticImports, vendorCheck } from "@blockr/core/build";
import * as esbuild from "esbuild";
import { createGenerator } from "ts-json-schema-generator";

interface Entry {
  readonly name: string;
  readonly dir: string;
}

// The files that name the parts of other projects that the DAG uses, each
// with the start of the name of the file that bundles them. A script is
// bundled into a script, and a stylesheet into a stylesheet.
const VENDORED: readonly (readonly [string, string])[] = [
  ["vpsc", join("srcts", "room", "vendor.ts")],
  ["dagre", join("srcts", "layout", "vendor.ts")],
  ["xyflow", join("srcts", "flow", "vendor.ts")],
  ["xyflow", join("srcts", "flow", "vendor.css")],
];

// A bundle of vendored parts: its file's name, and the metafile of the build,
// which says what the file holds.
interface Vendored {
  readonly file: string;
  readonly metafile: esbuild.Metafile;
}

// The file that a module's directory starts from, index.ts or, where it draws
// with React, index.tsx.
function entryFile(dir: string): string {
  const tsx = join(dir, "index.tsx");
  return existsSync(tsx) ? tsx : join(dir, "index.ts");
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
  const vendored = new Map<string, Vendored>();
  for (const [name, vendor] of VENDORED) {
    if (existsSync(join(root, vendor))) vendored.set(join(root, vendor), await vendorBundle(root, out, name, join(root, vendor)));
  }
  const licensed = await licenses(root, out, new Map([...vendored.values()].map(({ file, metafile }) => [file, metafile])));

  const options = {
    absWorkingDir: root,
    outdir: out,
    logLevel: "warning",
    metafile: true,
  } satisfies esbuild.BuildOptions;

  const stylesheets = entries
    .map((entry) => ({ in: join(entry.dir, "index.css"), out: entry.name }))
    .filter((entry) => existsSync(entry.in));

  const results = [
    ...(entries.length === 0
      ? []
      : [
          await esbuild.build({
            ...preset,
            ...options,
            plugins: [vendoredImports(vendored), ...preset.plugins, vendorCheck],
            entryPoints: entries.map((entry) => ({ in: entryFile(entry.dir), out: entry.name })),
          }),
        ]),
    ...(stylesheets.length === 0
      ? []
      : [
          await esbuild.build({
            ...options,
            bundle: true,
            plugins: [vendoredImports(vendored), vendorCheck],
            entryPoints: stylesheets,
          }),
        ]),
  ];

  if (results.some((result) => result.warnings.length > 0)) {
    throw new Error("esbuild warned, as printed above");
  }

  return [
    ...results.flatMap((result) => Object.keys(result.metafile.outputs)),
    ...[...vendored.values()].map(({ file }) => relative(root, join(out, file))),
    ...(licensed === undefined ? [] : [licensed]),
    ...schemas,
    await preloadList(root, out, results.map((result) => result.metafile), vendored.values()),
  ].sort();
}

// Writes what the files in `out` import up front into `out`, as preload.json,
// and gives its path from `root`: the static imports of the files that the
// builds of `metafiles` wrote, and those of each bundle of `vendored`, under
// the name of its file, since its build wrote none.
async function preloadList(
  root: string,
  out: string,
  metafiles: readonly esbuild.Metafile[],
  vendored: Iterable<Vendored>,
): Promise<string> {
  const lists = Object.entries(staticImports(metafiles));
  for (const { file, metafile } of vendored) {
    const imports = Object.values(staticImports([metafile])).flat();
    if (imports.length > 0) lists.push([file, imports]);
  }
  const file = join(out, "preload.json");
  const sorted = lists.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  await writeFile(file, `${JSON.stringify(Object.fromEntries(sorted), null, 2)}\n`);
  return relative(root, file);
}

// Bundles the parts that the file `vendor` names, minified, into one file in
// `out`, named by `name` and a hash of its content, as dagre-3f2a9c1d.js, or
// xyflow-5b0e7d21.css for a stylesheet. A script takes the build preset, so
// that React Flow's imports of React stay imports. The build fails where the
// file imports a package that package.json does not list in `dependencies`.
async function vendorBundle(root: string, out: string, name: string, vendor: string): Promise<Vendored> {
  const css = vendor.endsWith(".css");
  const result = await esbuild.build({
    ...(css ? { bundle: true } : preset),
    absWorkingDir: root,
    entryPoints: [vendor],
    write: false,
    metafile: true,
    minify: true,
    logLevel: "warning",
  });
  if (result.warnings.length > 0) {
    throw new Error("esbuild warned, as printed above");
  }

  const packages = await vendorPackages(root);
  const imported = result.metafile.inputs[relative(root, vendor)]?.imports ?? [];
  const strays = [...new Set(imported.flatMap((entry) => packageOf(entry.path) ?? []))].filter(
    (stray) => !packages.includes(stray),
  );
  if (strays.length > 0) {
    throw new Error(
      `The file ${relative(root, vendor)} imports ${strays.join(", ")}, which package.json does not list in dependencies.`,
    );
  }

  const text = result.outputFiles[0]?.text ?? "";
  const file = `${name}-${createHash("sha256").update(text).digest("hex").slice(0, 8)}.${css ? "css" : "js"}`;
  await writeFile(join(out, file), text);
  return { file, metafile: result.metafile };
}

// The packages that the build bundles from other projects, by their names:
// those that package.json lists in `dependencies`, which the files of
// VENDORED import between them.
async function vendorPackages(root: string): Promise<string[]> {
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
    readonly dependencies?: Readonly<Record<string, string>>;
  };
  return Object.keys(manifest.dependencies ?? {});
}

// The npm package of a file in node_modules, as @dagrejs/dagre for
// node_modules/@dagrejs/dagre/dist/dagre.esm.js, or undefined for a file from
// elsewhere.
function packageOf(path: string): string | undefined {
  const at = path.lastIndexOf("node_modules/");
  if (at === -1) return undefined;
  const [first = "", second = ""] = path.slice(at + "node_modules/".length).split("/");
  return first.startsWith("@") ? `${first}/${second}` : first;
}

// Leaves each import of a file of VENDORED, as the layout's dynamic import of
// srcts/layout/vendor.ts or the DAG's stylesheet's `@import` of
// srcts/flow/vendor.css, an import of the bundle that vendorBundle() wrote of
// it, by its name beside the module.
function vendoredImports(vendored: ReadonlyMap<string, Vendored>): esbuild.Plugin {
  return {
    name: "blockr.graph-vendored",
    setup(build) {
      build.onResolve({ filter: /^\.\.?\// }, (args) => {
        const bundle = vendored.get(resolve(args.resolveDir, args.path));
        return bundle === undefined ? undefined : { path: `./${bundle.file}`, external: true };
      });
    },
  };
}

// The parts of a package's package.json that LICENSES names.
interface Manifest {
  readonly name: string;
  readonly version: string;
  readonly author?: string | { readonly name?: string };
}

// Writes the licenses of what the files in `out` hold from other projects
// into `out`, as LICENSES, and gives its path from `root`, or undefined where
// they hold nothing from other projects.
// For each file, `held` gives the metafile of the build that wrote it, which
// names the packages from node_modules whose code the file holds.
async function licenses(root: string, out: string, held: ReadonlyMap<string, esbuild.Metafile>): Promise<string | undefined> {
  const holders = new Map<string, string[]>();
  for (const [file, metafile] of held) {
    for (const dir of packageDirs(metafile)) holders.set(dir, [...(holders.get(dir) ?? []), file]);
  }
  if (holders.size === 0) return undefined;

  const entries = await Promise.all(
    [...holders].map(async ([dir, files]) => {
      const where = listing(files.sort());
      const manifest = JSON.parse(await readFile(join(root, dir, "package.json"), "utf8")) as Manifest;
      const texts = await licenseTexts(join(root, dir));
      if (texts.length === 0) {
        throw new Error(`The code of ${manifest.name} in ${where} comes with no license: its directory in node_modules holds no license file.`);
      }
      const author = authorName(manifest);
      return { line: `${manifest.name} ${manifest.version}${author === undefined ? "" : `, by ${author}`}, in ${where}`, text: texts.join("\n\n") };
    }),
  );

  // Each license once, after the lines of the packages that share it, in the
  // order of the packages' names.
  const byLicense = new Map<string, string[]>();
  for (const { line, text } of entries.sort((a, b) => (a.line < b.line ? -1 : 1))) {
    byLicense.set(text, [...(byLicense.get(text) ?? []), line]);
  }
  const file = join(out, "LICENSES");
  await writeFile(file, [...byLicense].map(([text, lines]) => `${lines.join("\n")}\n\n${text}\n`).join(`\n${"-".repeat(78)}\n\n`));
  return relative(root, file);
}

// The directory of each package from node_modules whose code the build that
// gave the metafile bundled, from the root of the package.
function packageDirs(metafile: esbuild.Metafile): Set<string> {
  return new Set(
    Object.keys(metafile.inputs).flatMap((input) => {
      const dir = /^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//.exec(input)?.[1];
      return dir === undefined ? [] : [dir];
    }),
  );
}

// The text of each license file in a package's directory, such as LICENSE or
// LICENSE.md, or none where the directory holds none.
async function licenseTexts(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((file) => /^(licen[cs]e|copying)/i.test(file)).sort();
  return Promise.all(files.map(async (file) => (await readFile(join(dir, file), "utf8")).replace(/\r\n/g, "\n").trimEnd()));
}

// The author that a package's package.json names, without an email or a URL.
function authorName(manifest: Manifest): string | undefined {
  const name = typeof manifest.author === "string" ? manifest.author.replace(/\s*[<(].*$/, "") : manifest.author?.name;
  return name === undefined || name === "" ? undefined : name;
}

// The items as a list in prose, as "a, b and c".
function listing(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1) ?? ""}`;
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
