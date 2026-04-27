import { describe, expect, it } from "vitest";

import { asActorId, asRequestId, asRollTypeId, asUserId } from "../../domain/ids";
import type { RollRequest } from "../../domain/requests";
import {
  buildPlayerRollPromptViewModel,
  shouldClosePrompt,
} from "./playerRollPromptViewModel";

const request: RollRequest = {
  requestId: asRequestId("request-1"),
  status: "delivered",
  systemId: "wfrp4e",
  gmUserId: asUserId("gm-1"),
  createdAt: 1,
  recipients: {
    type: "users",
    userIds: [asUserId("user-1")],
    actorIds: [asActorId("actor-1")],
  },
  actorIds: [asActorId("actor-1")],
  rolls: [
    {
      system: "wfrp4e",
      type: "characteristic",
      characteristic: "ws",
      labelKey: "askaroll.wfrp4e.characteristics.ws",
    },
  ],
  visibility: "gmroll",
  selectionMode: "all",
  reason: "",
};

describe("shouldClosePrompt", () => {
  it("closes after one completed roll in one-selection mode", () => {
    expect(
      shouldClosePrompt({
        selectionMode: "one",
        totalActions: 3,
        completedActions: 1,
      }),
    ).toBe(true);
  });

  it("keeps open until every action is completed in all-selection mode", () => {
    expect(
      shouldClosePrompt({
        selectionMode: "all",
        totalActions: 3,
        completedActions: 2,
      }),
    ).toBe(false);
    expect(
      shouldClosePrompt({
        selectionMode: "all",
        totalActions: 3,
        completedActions: 3,
      }),
    ).toBe(true);
  });
});

describe("buildPlayerRollPromptViewModel", () => {
  it("includes localized-key labels and completed roll state", () => {
    const viewModel = buildPlayerRollPromptViewModel(request, [
      {
        id: asActorId("actor-1"),
        name: "Actor One",
        img: "actor.webp",
        completedRollTypeIds: [asRollTypeId("characteristic:ws")],
      },
    ]);

    expect(viewModel.visibilityLabel).toBe("askaroll.player.visibility.gmroll");
    expect(viewModel.completedActions).toBe(1);
    expect(viewModel.actors[0]?.rolls[0]).toMatchObject({
      label: "askaroll.wfrp4e.characteristics.ws",
      completed: true,
    });
  });
});
