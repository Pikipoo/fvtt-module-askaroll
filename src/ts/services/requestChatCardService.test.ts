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

const coolRoll: Wfrp4eRollDescriptor = {
  system: "wfrp4e",
  type: "characteristic",
  characteristic: "fel",
  labelKey: "askaroll.wfrp4e.characteristics.fel",
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
      get: (id: string) => {
        if (id === "actor-1") return { id, name: "Bruno <Rat>", img: "actor.png" };
        if (id === "actor-2") return { id, name: "Elsa", img: "" };
        return undefined;
      },
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
    expect(content).not.toContain("ask-a-roll-chat-request__roll-row");
    expect(content).not.toContain("ask-a-roll-chat-request__rolls--stacked");
  });

  it("stacks multiple roll options into separate centered rows", () => {
    stubFoundryEnvironment();

    const content = buildRequestChatCardContent({
      ...request,
      rolls: [wpRoll, coolRoll],
    });

    const rowCount = content.match(/ask-a-roll-chat-request__roll-row/g)?.length ?? 0;
    expect(rowCount).toBe(2);
    expect(content).toContain("ask-a-roll-chat-request__rolls--stacked");
    expect(content).toContain('data-roll-type-id="characteristic:wp"');
    expect(content).toContain('data-roll-type-id="characteristic:fel"');
  });

  it("stacks actor roll options when multiple actors are requested", () => {
    stubFoundryEnvironment();

    const content = buildRequestChatCardContent({
      ...request,
      recipients: {
        type: "users",
        userIds: [asUserId("player-1")],
        actorIds: [asActorId("actor-1"), asActorId("actor-2")],
      },
      actorIds: [asActorId("actor-1"), asActorId("actor-2")],
    });

    const rowCount = content.match(/ask-a-roll-chat-request__roll-row/g)?.length ?? 0;
    expect(rowCount).toBe(2);
    expect(content).toContain("ask-a-roll-chat-request__actors--stacked");
    expect(content).toContain('data-actor-id="actor-1"');
    expect(content).toContain('data-actor-id="actor-2"');
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
