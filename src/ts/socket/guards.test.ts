import { describe, expect, it } from "vitest";
import { asActorId, asRequestId, asRollTypeId, asUserId } from "../domain/ids";
import type { RollRequest } from "../domain/requests";
import { isAskARollSocketMessage } from "./guards";
import {
  createRequestCreateMessage,
  createRequestDeliveredMessage,
  createRollSubmittedMessage,
} from "./messages";

const validRequest: RollRequest = {
  requestId: asRequestId("r1"),
  status: "created",
  systemId: "wfrp4e",
  gmUserId: asUserId("gm1"),
  createdAt: 1,
  recipients: {
    type: "users",
    userIds: [asUserId("u1")],
    actorIds: [asActorId("a1")],
  },
  actorIds: [asActorId("a1")],
  rolls: [
    {
      system: "wfrp4e",
      type: "characteristic",
      characteristic: "wp",
      labelKey: "askaroll.wfrp4e.characteristics.wp",
    },
  ],
  visibility: "publicroll",
  selectionMode: "all",
  reason: "Test",
};

describe("isAskARollSocketMessage", () => {
  it("rejects foreign module messages", () => {
    expect(
      isAskARollSocketMessage({
        moduleId: "other",
        protocol: 1,
        type: "request:create",
        requestId: "r1",
        senderUserId: "u1",
        createdAt: 1,
        payload: {},
      }),
    ).toBe(false);
  });

  it("rejects unsupported protocol versions", () => {
    expect(
      isAskARollSocketMessage({
        moduleId: "askaroll",
        protocol: 2,
        type: "request:create",
        requestId: "r1",
        senderUserId: "u1",
        createdAt: 1,
        payload: {},
      }),
    ).toBe(false);
  });

  it("accepts a protocol 1 Ask A Roll cancel message with a valid payload", () => {
    expect(
      isAskARollSocketMessage({
        moduleId: "askaroll",
        protocol: 1,
        type: "request:cancel",
        requestId: "r1",
        senderUserId: "u1",
        createdAt: 1,
        payload: { reasonKey: "askaroll.request.cancelled" },
      }),
    ).toBe(true);
  });

  it("rejects request:create with an invalid payload", () => {
    expect(
      isAskARollSocketMessage({
        ...createRequestCreateMessage(validRequest),
        payload: { request: { requestId: "r1" } },
      }),
    ).toBe(false);
  });

  it("rejects request:create with no actors", () => {
    expect(
      isAskARollSocketMessage(
        createRequestCreateMessage({
          ...validRequest,
          actorIds: [],
          recipients: { ...validRequest.recipients, actorIds: [] },
        }),
      ),
    ).toBe(false);
  });

  it("rejects request:create with no rolls", () => {
    expect(
      isAskARollSocketMessage(
        createRequestCreateMessage({
          ...validRequest,
          rolls: [],
        }),
      ),
    ).toBe(false);
  });

  it("rejects unsupported WFRP4e skill descriptors until implemented", () => {
    expect(
      isAskARollSocketMessage(
        createRequestCreateMessage({
          ...validRequest,
          rolls: [
            {
              system: "wfrp4e",
              type: "skill",
              skillId: "perception",
              label: "Perception",
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it("rejects player payloads whose player id differs from the sender", () => {
    expect(
      isAskARollSocketMessage({
        ...createRequestDeliveredMessage({
          requestId: asRequestId("r1"),
          senderUserId: asUserId("u1"),
          playerUserId: asUserId("u1"),
          actorIds: [asActorId("a1")],
        }),
        payload: { playerUserId: "u2", actorIds: ["a1"] },
      }),
    ).toBe(false);

    expect(
      isAskARollSocketMessage({
        ...createRollSubmittedMessage({
          requestId: asRequestId("r1"),
          senderUserId: asUserId("u1"),
          actorId: asActorId("a1"),
          rollTypeId: asRollTypeId("characteristic:wp"),
          playerUserId: asUserId("u1"),
          chatMessageIds: [],
          completedAt: 1,
        }),
        payload: {
          actorId: "a1",
          rollTypeId: "characteristic:wp",
          playerUserId: "u2",
          chatMessageIds: [],
          completedAt: 1,
        },
      }),
    ).toBe(false);
  });
});
