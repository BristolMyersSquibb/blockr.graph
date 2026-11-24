// A check of whether a value is an object, which TypeScript takes to narrow
// the value's type.

import type { Json } from "@blockr/core";

// Whether a value is an object, which an array is not.
export function isObject(value: Json | undefined): value is Readonly<Record<string, Json>>;
export function isObject(value: unknown): value is Readonly<Record<string, unknown>>;
export function isObject(value: unknown): boolean {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
