import { describe, expect, it } from "vitest";

import { asActorId, asRequestId, asUserId } from "./ids";
import { createRollRequest } from "./requests";

describe("createRollRequest", () => {
  it("rejects a request with no actors", () => {
    const result = createRollRequest({
      requestId: asRequestId("request-1"),
      gmUserId: asUserId("gm-1"),
      actorIds: [],
      rolls: [
        {
          system: "wfrp4e",
          type: "characteristic",
          characteristic: "wp",
          labelKey: "askaroll.wfrp4e.characteristics.wp",
        },
      ],
      recipients: {
        type: "assignedCharacters",
        userIds: [asUserId("player-1")],
        actorIds: [],
      },
      visibility: "publicroll",
      selectionMode: "all",
      reason: "Test fear",
      createdAt: 100,
    });

    expect(result).toEqual({ ok: false, reason: "noActors" });
  });

  it("rejects a request with no rolls", () => {
    const result = createRollRequest({
      requestId: asRequestId("request-1"),
      gmUserId: asUserId("gm-1"),
      actorIds: [asActorId("actor-1")],
      rolls: [],
      recipients: {
        type: "assignedCharacters",
        userIds: [asUserId("player-1")],
        actorIds: [asActorId("actor-1")],
      },
      visibility: "publicroll",
      selectionMode: "all",
      reason: "Test fear",
      createdAt: 100,
    });

    expect(result).toEqual({ ok: false, reason: "noRolls" });
  });

  it("creates a valid WFRP4e request", () => {
    const result = createRollRequest({
      requestId: asRequestId("request-1"),
      gmUserId: asUserId("gm-1"),
      actorIds: [asActorId("actor-1")],
      rolls: [
        {
          system: "wfrp4e",
          type: "characteristic",
          characteristic: "wp",
          labelKey: "askaroll.wfrp4e.characteristics.wp",
        },
      ],
      recipients: {
        type: "assignedCharacters",
        userIds: [asUserId("player-1")],
        actorIds: [asActorId("actor-1")],
      },
      visibility: "publicroll",
      selectionMode: "all",
      reason: "Test fear",
      createdAt: 100,
    });

    expect(result).toMatchObject({
      ok: true,
      value: { status: "created", systemId: "wfrp4e" },
    });
  });

  it("copies roll descriptors into the created request", () => {
    const roll = {
      system: "wfrp4e" as const,
      type: "characteristic" as const,
      characteristic: "wp" as const,
      labelKey: "askaroll.wfrp4e.characteristics.wp",
    };

    const result = createRollRequest({
      requestId: asRequestId("request-1"),
      gmUserId: asUserId("gm-1"),
      actorIds: [asActorId("actor-1")],
      rolls: [roll],
      recipients: {
        type: "assignedCharacters",
        userIds: [asUserId("player-1")],
        actorIds: [asActorId("actor-1")],
      },
      visibility: "publicroll",
      selectionMode: "all",
      reason: "Test fear",
      createdAt: 100,
    });

    roll.labelKey = "mutated.label";

    expect(result).toMatchObject({
      ok: true,
      value: {
        rolls: [
          {
            system: "wfrp4e",
            type: "characteristic",
            characteristic: "wp",
            labelKey: "askaroll.wfrp4e.characteristics.wp",
          },
        ],
      },
    });
  });

  it("exposes created request arrays as readonly at compile time", () => {
    const result = createRollRequest({
      requestId: asRequestId("request-1"),
      gmUserId: asUserId("gm-1"),
      actorIds: [asActorId("actor-1")],
      rolls: [
        {
          system: "wfrp4e",
          type: "characteristic",
          characteristic: "wp",
          labelKey: "askaroll.wfrp4e.characteristics.wp",
        },
      ],
      recipients: {
        type: "assignedCharacters",
        userIds: [asUserId("player-1")],
        actorIds: [asActorId("actor-1")],
      },
      visibility: "publicroll",
      selectionMode: "all",
      reason: "Test fear",
      createdAt: 100,
    });

    if (!result.ok) {
      throw new Error(result.reason);
    }

    const request = result.value;

    if (false) {
      // @ts-expect-error Created requests must not expose mutable actor arrays.
      request.actorIds.push(asActorId("actor-2"));
      // @ts-expect-error Created requests must not expose mutable roll arrays.
      request.rolls.push(request.rolls[0]);

      if (request.recipients.type === "assignedCharacters") {
        // @ts-expect-error Created recipient targets must not expose mutable user arrays.
        request.recipients.userIds.push(asUserId("player-2"));
        // @ts-expect-error Created recipient targets must not expose mutable actor arrays.
        request.recipients.actorIds.push(asActorId("actor-2"));
      }
    }

    expect(request.actorIds).toEqual([asActorId("actor-1")]);
  });
});
