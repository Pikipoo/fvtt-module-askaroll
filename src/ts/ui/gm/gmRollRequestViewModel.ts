import type { SystemRollDescriptor, SystemRollGroup } from "../../systems/adapter";

export type GmRollRequestViewModelInput = {
  actors: { id: string; name: string; img: string; tokenImg: string | null }[];
  users: { id: string; name: string; isGM: boolean }[];
  controlledActorIds: string[];
  useTokenImageForActors: boolean;
  rollGroups: SystemRollGroup<SystemRollDescriptor>[];
};

export type ActorViewModel = {
  id: string;
  name: string;
  image: string;
  selected: boolean;
};

export type RollViewModel = {
  id: string;
  labelKey?: string;
  label?: string;
};

export type RollGroupViewModel = {
  id: string;
  labelKey: string;
  rolls: RollViewModel[];
};

export type RecipientViewModel = {
  id: string;
  name: string;
};

export type GmRollRequestViewModel = {
  actors: ActorViewModel[];
  recipients: RecipientViewModel[];
  rollGroups: RollGroupViewModel[];
};

export function rollDescriptorToId(
  groupId: string,
  roll: SystemRollDescriptor,
): string {
  const key = roll.labelKey ?? roll.label ?? roll.type;
  return `${groupId}:${key}`;
}

export function buildGmRollRequestViewModel(
  input: GmRollRequestViewModelInput,
): GmRollRequestViewModel {
  const actors: ActorViewModel[] = input.actors.map((actor) => ({
    id: actor.id,
    name: actor.name,
    image:
      input.useTokenImageForActors && actor.tokenImg
        ? actor.tokenImg
        : actor.img,
    selected: input.controlledActorIds.includes(actor.id),
  }));

  const recipients: RecipientViewModel[] = input.users
    .filter((user) => !user.isGM)
    .map((user) => ({ id: user.id, name: user.name }));

  const rollGroups: RollGroupViewModel[] = input.rollGroups.map((group) => ({
    id: group.id,
    labelKey: group.labelKey,
    rolls: group.rolls.map((roll) => ({
      id: rollDescriptorToId(group.id, roll),
      labelKey: roll.labelKey,
      label: roll.label,
    })),
  }));

  return { actors, recipients, rollGroups };
}
