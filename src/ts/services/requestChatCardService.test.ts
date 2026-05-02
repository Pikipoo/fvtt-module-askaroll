import { afterEach, describe, expect, it, vi } from "vitest";

import { asActorId, asRequestId, asUserId } from "../domain/ids";
import type { RollRequest } from "../domain/requests";
import type { Wfrp4eRollDescriptor } from "../domain/rolls";
import {
  buildRequestChatCardContent,
  createAskARollRequestChatFlags,
  RequestChatCardService,
} from "./requestChatCardService";

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
  reason: "Fear <test>",
};

function stubFoundryEnvironment(chatCreate = vi.fn()): void {
  vi.stubGlobal("game", {
    user: { id: "gm", isGM: true },
    actors: {
      get: (id: string) =>
        id === "actor-1" ? { id, name: "Bruno <Rat>", img: "actor.png" } : undefined,
    },
    i18n: { localize: (key: string) => key },
  });
  vi.stubGlobal("ui", { notifications: { warn: vi.fn(), error: vi.fn() } });
  vi.stubGlobal("ChatMessage", { create: chatCreate });
}

describe("RequestChatCardService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds an escaped request chat card with actionable roll buttons", () => {
    stubFoundryEnvironment();

    const content = buildRequestChatCardContent(request);

    expect(content).toContain("Fear &lt;test&gt;");
    expect(content).toContain("Bruno &lt;Rat&gt;");
    expect(content).toContain('data-askaroll-request-roll="true"');
    expect(content).toContain('data-request-id="request-1"');
    expect(content).toContain('data-actor-id="actor-1"');
    expect(content).toContain('data-roll-type-id="characteristic:wp"');
  });

  it("creates a chat message containing request flags", async () => {
    const chatCreate = vi.fn();
    stubFoundryEnvironment(chatCreate);

    await new RequestChatCardService().createRequestPrompt(request);

    expect(chatCreate).toHaveBeenCalledOnce();
    expect(chatCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        user: "gm",
        flags: { askaroll: createAskARollRequestChatFlags(request) },
      }),
    );
  });
});
