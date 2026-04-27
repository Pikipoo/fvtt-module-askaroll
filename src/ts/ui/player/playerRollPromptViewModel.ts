import type { ActorId, RequestId, RollTypeId } from "../../domain/ids";
import { asRollTypeId } from "../../domain/ids";
import type { RollRequest, RollVisibility, SelectionMode } from "../../domain/requests";
import type { Wfrp4eRollDescriptor } from "../../domain/rolls";

export type PlayerRollPromptOwnedActor = {
  readonly id: ActorId;
  readonly name: string;
  readonly img: string;
  readonly completedRollTypeIds?: readonly RollTypeId[];
};

export type PlayerRollPromptRollViewModel = {
  readonly rollTypeId: RollTypeId;
  readonly label: string;
  readonly completed: boolean;
};

export type PlayerRollPromptActorViewModel = {
  readonly id: ActorId;
  readonly name: string;
  readonly img: string;
  readonly rolls: readonly PlayerRollPromptRollViewModel[];
};

export type PlayerRollPromptViewModel = {
  readonly requestId: RequestId;
  readonly reason: string;
  readonly selectionMode: SelectionMode;
  readonly visibility: RollVisibility;
  readonly isChooseOne: boolean;
  readonly actors: readonly PlayerRollPromptActorViewModel[];
  readonly totalActions: number;
  readonly completedActions: number;
};

export type ShouldClosePromptInput = {
  readonly selectionMode: SelectionMode;
  readonly totalActions: number;
  readonly completedActions: number;
};

export function rollDescriptorToRollTypeId(roll: Wfrp4eRollDescriptor): RollTypeId {
  switch (roll.type) {
    case "characteristic":
      return asRollTypeId(`${roll.type}:${roll.characteristic}`);
    case "skill":
      return asRollTypeId(`${roll.type}:${roll.skillId}`);
    case "customFormula":
      return asRollTypeId(`${roll.type}:${roll.formula}`);
  }
}

function rollDescriptorToLabel(roll: Wfrp4eRollDescriptor): string {
  switch (roll.type) {
    case "characteristic":
    case "customFormula":
      return roll.labelKey;
    case "skill":
      return roll.label;
  }
}

export function shouldClosePrompt(input: ShouldClosePromptInput): boolean {
  if (input.selectionMode === "one") {
    return input.completedActions >= 1;
  }

  return input.completedActions >= input.totalActions;
}

export function buildPlayerRollPromptViewModel(
  request: RollRequest,
  ownedActors: readonly PlayerRollPromptOwnedActor[],
): PlayerRollPromptViewModel {
  const actors = ownedActors.map((actor) => {
    const completedRollTypeIds = new Set(actor.completedRollTypeIds ?? []);

    return {
      id: actor.id,
      name: actor.name,
      img: actor.img,
      rolls: request.rolls.map((roll) => {
        const rollTypeId = rollDescriptorToRollTypeId(roll);

        return {
          rollTypeId,
          label: rollDescriptorToLabel(roll),
          completed: completedRollTypeIds.has(rollTypeId),
        };
      }),
    };
  });

  const totalActions = actors.reduce(
    (sum, actor) => sum + actor.rolls.length,
    0,
  );
  const completedActions = actors.reduce(
    (sum, actor) => sum + actor.rolls.filter((roll) => roll.completed).length,
    0,
  );

  return {
    requestId: request.requestId,
    reason: request.reason,
    selectionMode: request.selectionMode,
    visibility: request.visibility,
    isChooseOne: request.selectionMode === "one",
    actors,
    totalActions,
    completedActions,
  };
}
