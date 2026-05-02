import { afterEach, describe, expect, it, vi } from "vitest";

import { asActorId, asRollTypeId, asUserId } from "../domain/ids";
import type { Wfrp4eRollDescriptor } from "../domain/rolls";
import { GmRollRequestService } from "./gmRollRequestService";

const wpRoll: Wfrp4eRollDescriptor = {
  system: "wfrp4e",
  type: "characteristic",
  characteristic: "wp",
  labelKey: "askaroll.wfrp4e.characteristics.wp",
};

function user(id: string, isGM = false): User {
  return { id, isGM } as unknown as User;
}

function actor(id: string, ownerUserIds: readonly string[]): Actor {
  return {
    id,
    testUserPermission: (candidate: User, permission: string) =>
      permission === "OWNER" && typeof candidate.id === "string" && ownerUserIds.includes(candidate.id),
  } as unknown as Actor;
}

function stubFoundryEnvironment(input: {
  readonly users: readonly User[];
  readonly actors: readonly Actor[];
  readonly emit: ReturnType<typeof vi.fn>;
  readonly warn: ReturnType<typeof vi.fn>;
  readonly chatCreate?: ReturnType<typeof vi.fn>;
}): void {
  vi.stubGlobal("foundry", {
    utils: { randomID: () => "request-1" },
  });
  vi.stubGlobal("game", {
    user: user("gm", true),
    users: {
      contents: input.users,
      get: (id: string) => input.users.find((candidate) => candidate.id === id),
    },
    actors: {
      get: (id: string) => input.actors.find((candidate) => candidate.id === id),
    },
    socket: { emit: input.emit },
    i18n: { localize: (key: string) => key },
  });
  vi.stubGlobal("ui", { notifications: { warn: input.warn, info: vi.fn() } });
  vi.stubGlobal("ChatMessage", { create: input.chatCreate ?? vi.fn() });
}

describe("GmRollRequestService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not emit when selected recipients own no requested actors", async () => {
    const emit = vi.fn();
    const warn = vi.fn();
    stubFoundryEnvironment({
      users: [user("player-1")],
      actors: [actor("actor-1", [])],
      emit,
      warn,
    });

    const service = new GmRollRequestService();

    const result = await service.createAndDispatchRequest({
      actorIds: [asActorId("actor-1")],
      rolls: [wpRoll],
      recipients: {
        type: "users",
        userIds: [asUserId("player-1")],
        actorIds: [asActorId("actor-1")],
      },
      visibility: "publicroll",
      selectionMode: "all",
      reason: "Fear test",
    });

    expect(result).toBeNull();
    expect(emit).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      "askaroll.gm.validation.noValidRecipients",
    );
  });

  it("does not emit controlled-token requests with no controlled token target", async () => {
    const emit = vi.fn();
    const warn = vi.fn();
    stubFoundryEnvironment({
      users: [user("player-1")],
      actors: [actor("actor-1", ["player-1"])],
      emit,
      warn,
    });

    const service = new GmRollRequestService();

    const result = await service.createAndDispatchRequest({
      actorIds: [asActorId("actor-1")],
      rolls: [wpRoll],
      recipients: {
        type: "controlledTokens",
        actorIds: [asActorId("actor-1")],
        tokenIds: [],
        sceneId: null,
      },
      visibility: "publicroll",
      selectionMode: "all",
      reason: "Fear test",
    });

    expect(result).toBeNull();
    expect(emit).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      "askaroll.gm.validation.noValidRecipients",
    );
  });

  it("reports no actors before recipient pairing validation", async () => {
    const emit = vi.fn();
    const warn = vi.fn();
    stubFoundryEnvironment({
      users: [user("player-1")],
      actors: [],
      emit,
      warn,
    });

    const service = new GmRollRequestService();

    const result = await service.createAndDispatchRequest({
      actorIds: [],
      rolls: [wpRoll],
      recipients: {
        type: "users",
        userIds: [asUserId("player-1")],
        actorIds: [],
      },
      visibility: "publicroll",
      selectionMode: "all",
      reason: "Fear test",
    });

    expect(result).toBeNull();
    expect(emit).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("askaroll.gm.validation.noActors");
  });

  it("filters specific-user targets to actors owned by that user", async () => {
    const emit = vi.fn();
    const warn = vi.fn();
    const chatCreate = vi.fn();
    stubFoundryEnvironment({
      users: [user("player-1")],
      actors: [actor("actor-1", ["player-1"]), actor("actor-2", [])],
      emit,
      warn,
      chatCreate,
    });

    const service = new GmRollRequestService();

    const result = await service.createAndDispatchRequest({
      actorIds: [asActorId("actor-1"), asActorId("actor-2")],
      rolls: [wpRoll],
      recipients: {
        type: "users",
        userIds: [asUserId("player-1")],
        actorIds: [asActorId("actor-1"), asActorId("actor-2")],
      },
      visibility: "publicroll",
      selectionMode: "all",
      reason: "Fear test",
    });

    expect(result).toMatchObject({
      actorIds: ["actor-1"],
      recipients: { type: "users", userIds: ["player-1"], actorIds: ["actor-1"] },
    });
    expect(emit).toHaveBeenCalledOnce();
    expect(chatCreate).toHaveBeenCalledOnce();
    expect(warn).not.toHaveBeenCalled();
  });

  it("ignores submitted results outside the tracked actor and roll", async () => {
    const emit = vi.fn();
    const warn = vi.fn();
    stubFoundryEnvironment({
      users: [user("player-1")],
      actors: [actor("actor-1", ["player-1"])],
      emit,
      warn,
    });

    const service = new GmRollRequestService();
    const request = await service.createAndDispatchRequest({
      actorIds: [asActorId("actor-1")],
      rolls: [wpRoll],
      recipients: {
        type: "users",
        userIds: [asUserId("player-1")],
        actorIds: [asActorId("actor-1")],
      },
      visibility: "publicroll",
      selectionMode: "all",
      reason: "Fear test",
    });

    expect(request).not.toBeNull();
    if (request == null) return;

    service.markSubmitted(request.requestId, {
      actorId: asActorId("actor-2"),
      rollTypeId: asRollTypeId("characteristic:wp"),
      playerUserId: asUserId("player-1"),
      chatMessageIds: [],
      completedAt: 1,
    });
    service.markSubmitted(request.requestId, {
      actorId: asActorId("actor-1"),
      rollTypeId: asRollTypeId("characteristic:bs"),
      playerUserId: asUserId("player-1"),
      chatMessageIds: [],
      completedAt: 1,
    });

    expect(service.getState(request.requestId)?.results).toEqual([]);
  });

  it("deduplicates submitted results for the same player actor and roll", async () => {
    const emit = vi.fn();
    const warn = vi.fn();
    stubFoundryEnvironment({
      users: [user("player-1")],
      actors: [actor("actor-1", ["player-1"])],
      emit,
      warn,
    });

    const service = new GmRollRequestService();
    const request = await service.createAndDispatchRequest({
      actorIds: [asActorId("actor-1")],
      rolls: [wpRoll],
      recipients: {
        type: "users",
        userIds: [asUserId("player-1")],
        actorIds: [asActorId("actor-1")],
      },
      visibility: "publicroll",
      selectionMode: "all",
      reason: "Fear test",
    });

    expect(request).not.toBeNull();
    if (request == null) return;

    const submitted = {
      actorId: asActorId("actor-1"),
      rollTypeId: asRollTypeId("characteristic:wp"),
      playerUserId: asUserId("player-1"),
      chatMessageIds: [],
      completedAt: 1,
    };
    service.markSubmitted(request.requestId, submitted);
    service.markSubmitted(request.requestId, { ...submitted, completedAt: 2 });

    expect(service.getState(request.requestId)?.results).toHaveLength(1);
  });

  it("allows only one submitted result per player for choose-one requests", async () => {
    const emit = vi.fn();
    const warn = vi.fn();
    const felRoll: Wfrp4eRollDescriptor = {
      system: "wfrp4e",
      type: "characteristic",
      characteristic: "fel",
      labelKey: "askaroll.wfrp4e.characteristics.fel",
    };
    stubFoundryEnvironment({
      users: [user("player-1")],
      actors: [actor("actor-1", ["player-1"])],
      emit,
      warn,
    });

    const service = new GmRollRequestService();
    const request = await service.createAndDispatchRequest({
      actorIds: [asActorId("actor-1")],
      rolls: [wpRoll, felRoll],
      recipients: {
        type: "users",
        userIds: [asUserId("player-1")],
        actorIds: [asActorId("actor-1")],
      },
      visibility: "publicroll",
      selectionMode: "one",
      reason: "Fear test",
    });

    expect(request).not.toBeNull();
    if (request == null) return;

    service.markSubmitted(request.requestId, {
      actorId: asActorId("actor-1"),
      rollTypeId: asRollTypeId("characteristic:wp"),
      playerUserId: asUserId("player-1"),
      chatMessageIds: [],
      completedAt: 1,
    });
    service.markSubmitted(request.requestId, {
      actorId: asActorId("actor-1"),
      rollTypeId: asRollTypeId("characteristic:fel"),
      playerUserId: asUserId("player-1"),
      chatMessageIds: [],
      completedAt: 2,
    });

    expect(service.getState(request.requestId)?.results).toHaveLength(1);
  });
});
