export type RollRequestValidationFailure = "noActors" | "noRolls";

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: RollRequestValidationFailure };

export const validateRollRequestInput = (input: {
  actorIds: readonly unknown[];
  rolls: readonly unknown[];
}): ValidationResult => {
  if (input.actorIds.length === 0) {
    return { ok: false, reason: "noActors" };
  }

  if (input.rolls.length === 0) {
    return { ok: false, reason: "noRolls" };
  }

  return { ok: true };
};
