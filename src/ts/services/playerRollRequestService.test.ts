import { afterEach, describe, expect, it, vi } from "vitest";

import { asActorId, asRequestId, asRollTypeId, asUserId } from "../domain/ids";
import type { RollRequest } from "../domain/requests";
import type { Wfrp4eRollDescriptor } from "../domain/rolls";
import type { SystemRollAdapter } from "../systems/adapter";
import { PlayerRollRequestService } from "./playerRollRequestService";

const wpRoll: Wfrp4eRollDescriptor = {
  system: "wfrp4e",
  type: "characteristic",
  characteristic: "wp",
  labelKey: "askaroll.wfrp4e.characteristics.wp",
};

const request: RollRequest = {
  requestId: asRequestId("request-1"),
  status: "created",
  systemId: "wfrp4e",
  gmUserId: asUserId("gm"),
  createdAt: 1,
  recipients: {
    type: "users",
    userIds: [asUserId("player-1")],
    actorIds: [asActorId("actor-1")],
  },
  actorIds: [asActorId("actor-1")],
  rolls: [wpRoll],
  visibility: "publicroll",
  selectionMode: "all",
  reason: "Fear test",
};

function user(id: string): User {
  return { id, isGM: false } as unknown as User;
}

function actor(id: string, ownerUserIds: readonly string[]): Actor {
  return {
    id,
    testUserPermission: (candidate: User, permission: string) =>
      permission === "OWNER" && typeof candidate.id === "string" && ownerUserIds.includes(candidate.id),
  } as unknown as Actor;
}

function stubFoundryEnvironment(actorDocument: Actor): void {
  const currentUser = user("player-1");
  vi.stubGlobal("game", {
    user: currentUser,
    users: { get: (id: string) => (id === currentUser.id ? currentUser : undefined) },
    actors: { get: (id: string) => (id === actorDocument.id ? actorDocument : undefined) },
  });
  vi.stubGlobal("Hooks", { on: vi.fn(() => 1), off: vi.fn() });
}

describe("PlayerRollRequestService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects performRequestedRoll when current user lacks actor owner permission", async () => {
    stubFoundryEnvironment(actor("actor-1", []));
    const adapter: SystemRollAdapter<Wfrp4eRollDescriptor> = {
      systemId: "wfrp4e",
      isSupportedActor: () => true,
      getRollGroups: () => ({ ok: true, value: [] }),
      executeRoll: vi.fn(),
    };
    const service = new PlayerRollRequestService(adapter);
    service.registerRequest(request);

    const result = await service.performRequestedRoll(
      asRequestId("request-1"),
      asActorId("actor-1"),
      asRollTypeId("characteristic:wp"),
      null,
    );

    expect(result).toEqual({
      ok: false,
      reasonKey: "askaroll.player.error.actorPermissionDenied",
    });
    expect(adapter.executeRoll).not.toHaveBeenCalled();
  });

  it("rejects performRequestedRoll when current user is not targeted", async () => {
    const actorDocument = actor("actor-1", ["player-2"]);
    const currentUser = user("player-2");
    vi.stubGlobal("game", {
      user: currentUser,
      users: { get: (id: string) => (id === currentUser.id ? currentUser : undefined) },
      actors: { get: (id: string) => (id === actorDocument.id ? actorDocument : undefined) },
    });
    vi.stubGlobal("Hooks", { on: vi.fn(() => 1), off: vi.fn() });
    const adapter: SystemRollAdapter<Wfrp4eRollDescriptor> = {
      systemId: "wfrp4e",
      isSupportedActor: () => true,
      getRollGroups: () => ({ ok: true, value: [] }),
      executeRoll: vi.fn(),
    };
    const service = new PlayerRollRequestService(adapter);
    service.registerRequest(request);

    const result = await service.performRequestedRoll(
      asRequestId("request-1"),
      asActorId("actor-1"),
      asRollTypeId("characteristic:wp"),
      null,
    );

    expect(result).toEqual({
      ok: false,
      reasonKey: "askaroll.player.error.userNotTargeted",
    });
    expect(adapter.executeRoll).not.toHaveBeenCalled();
  });

  it("allows controlled-token requests when the current user owns the requested actor", async () => {
    const actorDocument = actor("actor-1", ["player-1"]);
    stubFoundryEnvironment(actorDocument);
    const controlledTokenRequest: RollRequest = {
      ...request,
      recipients: {
        type: "controlledTokens",
        actorIds: [asActorId("actor-1")],
        tokenIds: [],
        sceneId: null,
      },
    };
    const adapter: SystemRollAdapter<Wfrp4eRollDescriptor> = {
      systemId: "wfrp4e",
      isSupportedActor: () => true,
      getRollGroups: () => ({ ok: true, value: [] }),
      executeRoll: vi.fn(async () => ({
        ok: true as const,
        value: {
          actorId: asActorId("actor-1"),
          rollTypeId: asRollTypeId("characteristic:wp"),
          chatMessageIds: [],
          completedAt: 1,
        },
      })),
    };
    const service = new PlayerRollRequestService(adapter);
    service.registerRequest(controlledTokenRequest);

    const result = await service.performRequestedRoll(
      asRequestId("request-1"),
      asActorId("actor-1"),
      asRollTypeId("characteristic:wp"),
      null,
    );

    expect(result.ok).toBe(true);
    expect(adapter.executeRoll).toHaveBeenCalledOnce();
  });
});
