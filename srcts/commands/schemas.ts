// The schemas of the args of the DAG's commands, which describe them to menus
// and to the assistant's tools
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.1.2#commands).
// A point and the settings of the layout take the definitions of the schema
// of the DAG's state, which the build generates from the state's types.

import type { Json, JsonSchema } from "@blockr/core";
// The schema of the DAG's state is the file that the build writes for R,
// beside the bundle.
// eslint-disable-next-line no-restricted-imports
import schema from "../../inst/js/graph.schema.json" with { type: "json" };
import { isObject } from "../state/index.ts";

// The schema of an object with the properties given, which takes no other.
// It holds, under $defs, each definition of the state's schema that the
// properties refer to.
export function object(properties: Readonly<Record<string, JsonSchema>>, required: readonly string[] = []): JsonSchema {
  const used = Object.keys(DEFINITIONS).filter((name) => JSON.stringify(properties).includes(`"#/$defs/${name}"`));
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
    ...(used.length === 0 ? {} : { $defs: Object.fromEntries(used.map((name) => [name, DEFINITIONS[name] ?? {}])) }),
  };
}

// The definitions of the state's schema, with each reference pointing under
// $defs, where object() puts them.
// The build writes the schema in the draft 7 of JSON Schema, whose keywords
// these definitions share with the draft 2020-12, which core reads a
// command's args by.
const DEFINITIONS = JSON.parse(
  JSON.stringify(schema.definitions).replaceAll('"#/definitions/', '"#/$defs/'),
) as Readonly<Record<string, Json>>;

// Points by the ids of blocks or of stacks.
export function points(description: string): JsonSchema {
  return { type: "object", additionalProperties: { $ref: "#/$defs/Point" }, description };
}

// A setting of the layout, as the state's schema has it, with a description
// of its own.
export function setting(name: "direction" | "spacing" | "placement" | "snap" | "snap_size", description: string): JsonSchema {
  const layout = DEFINITIONS.Layout;
  const properties = isObject(layout) ? layout.properties : undefined;
  const property = isObject(properties) ? properties[name] : undefined;
  return { ...(isObject(property) ? property : {}), description };
}

export const stack: JsonSchema = { type: "string", description: "The id of a stack of the board." };
