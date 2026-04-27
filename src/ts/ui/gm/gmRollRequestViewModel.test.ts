import { describe, expect, it } from "vitest";

import type { SystemRollDescriptor, SystemRollGroup } from "../../systems/adapter";
import {
  buildGmRollRequestViewModel,
  rollDescriptorToId,
  type GmRollRequestViewModelInput,
} from "./gmRollRequestViewModel";

function makeInput(
  overrides: Partial<GmRollRequestViewModelInput> = {},
): GmRollRequestViewModelInput {
  return {
    actors: [],
    users: [],
    controlledActorIds: [],
    useTokenImageForActors: false,
    rollGroups: [],
    ...overrides,
  };
}

describe("buildGmRollRequestViewModel", () => {
  it("marks controlled actors as selected", () => {
    const input = makeInput({
      actors: [
        { id: "a1", name: "Alice", img: "alice.png", tokenImg: null },
        { id: "a2", name: "Bob", img: "bob.png", tokenImg: null },
      ],
      controlledActorIds: ["a1"],
    });

    const result = buildGmRollRequestViewModel(input);

    expect(result.actors[0].selected).toBe(true);
    expect(result.actors[1].selected).toBe(false);
  });

  it("uses token image when useTokenImageForActors is true and tokenImg exists", () => {
    const input = makeInput({
      actors: [
        { id: "a1", name: "Alice", img: "actor.png", tokenImg: "token.png" },
      ],
      useTokenImageForActors: true,
    });

    const result = buildGmRollRequestViewModel(input);

    expect(result.actors[0].image).toBe("token.png");
  });

  it("falls back to actor image when tokenImg is null", () => {
    const input = makeInput({
      actors: [
        { id: "a1", name: "Alice", img: "actor.png", tokenImg: null },
      ],
      useTokenImageForActors: true,
    });

    const result = buildGmRollRequestViewModel(input);

    expect(result.actors[0].image).toBe("actor.png");
  });

  it("uses actor image when useTokenImageForActors is false", () => {
    const input = makeInput({
      actors: [
        { id: "a1", name: "Alice", img: "actor.png", tokenImg: "token.png" },
      ],
      useTokenImageForActors: false,
    });

    const result = buildGmRollRequestViewModel(input);

    expect(result.actors[0].image).toBe("actor.png");
  });

  it("excludes GM users from recipients", () => {
    const input = makeInput({
      users: [
        { id: "u1", name: "Player", isGM: false },
        { id: "u2", name: "GameMaster", isGM: true },
      ],
    });

    const result = buildGmRollRequestViewModel(input);

    expect(result.recipients).toEqual([{ id: "u1", name: "Player" }]);
  });

  it("returns empty actors array for empty input", () => {
    const input = makeInput({ actors: [] });

    const result = buildGmRollRequestViewModel(input);

    expect(result.actors).toEqual([]);
  });

  it("produces stable roll descriptor IDs", () => {
    const rolls: SystemRollDescriptor[] = [
      {
        system: "wfrp4e",
        type: "characteristic",
        labelKey: "askaroll.wfrp4e.characteristics.ws",
      },
      {
        system: "wfrp4e",
        type: "characteristic",
        labelKey: "askaroll.wfrp4e.characteristics.bs",
      },
    ];
    const group: SystemRollGroup<SystemRollDescriptor> = {
      id: "chars",
      labelKey: "askaroll.wfrp4e.characteristics",
      rolls,
    };
    const input = makeInput({ rollGroups: [group] });

    const result = buildGmRollRequestViewModel(input);

    expect(result.rollGroups[0].rolls[0].id).toBe(
      "chars:askaroll.wfrp4e.characteristics.ws",
    );
    expect(result.rollGroups[0].rolls[1].id).toBe(
      "chars:askaroll.wfrp4e.characteristics.bs",
    );
    expect(result.rollGroups[0].rolls[0].id).toBe(
      rollDescriptorToId("chars", rolls[0]),
    );
  });
});
