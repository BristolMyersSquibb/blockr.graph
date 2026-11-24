// What the DAG's commands share: how a command reads its args, and how its
// preflight refuses what fails it.

import type { Board, Command, CommandContext, Delta, Json, JsonSchema } from "@blockr/core";
import { graphState } from "../state/index.ts";

// A command of the DAG's, whose args are an A, as its schema has them, and
// which hands its run() what its prepare() gives, a P.
export interface GraphCommand<A, P = A> {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly args: JsonSchema;
  readonly undo?: false;
  preflight?(board: Board, args: A, context: CommandContext): boolean;
  prepare?(board: Board, args: A, context: CommandContext): Promise<P>;
  run(board: Board, args: P, context: CommandContext): Delta | readonly Delta[];
}

// A command of the DAG's, as core registers it.
// The command registry hands preflight(), prepare() and run() only args that
// the command's schema takes, so they read them as an A, which TypeScript
// cannot take for a Json where it has optional properties.
export function command<A, P = A>(definition: GraphCommand<A, P>): Command<Json, unknown> {
  return definition as unknown as Command<Json, unknown>;
}

// Passes a preflight where nothing fails, and otherwise refuses the command
// with a sentence for each failure, so that the refusal says why, as core's
// commands refuse.
// The command registry rejects with that refusal as it is, and logs no line
// of it.
export function passes(failures: readonly string[], context: Pick<CommandContext, "refusal">): true {
  if (failures.length > 0) throw context.refusal(failures);
  return true;
}

// The failure where the board holds no state of the DAG, as where the app
// does not run the DAG, in a sentence.
export function stateFailures(board: Board): string[] {
  return graphState(board) === undefined ? ["The board holds no state of the DAG, so the app does not run it."] : [];
}
