import { asUserId } from "../domain/ids";
import { gmRollRequestService } from "../services/gmRollRequestService";
import { PlayerRollRequestService } from "../services/playerRollRequestService";
import { resolveCurrentUserRequestTargets } from "../services/recipientResolver";
import { getSystemRollAdapter } from "../systems/registry";
import type { Wfrp4eRollDescriptor } from "../domain/rolls";
import type { SystemRollAdapter } from "../systems/adapter";
import { PlayerRollPromptApp } from "../ui/player/PlayerRollPromptApp";
import { chatResultService } from "../services/chatResultService";
import {
  isAskARollSocketMessage,
  isRequestCreateMessage,
  isRequestDeliveredPayload,
  isRollFailedPayload,
  isRollSubmittedPayload,
} from "./guards";
import { askARollSocketChannel } from "./channel";
import { createRequestDeliveredMessage } from "./messages";
import type { AskARollSocketMessage } from "./messages";

const openPlayerPrompts = new Map<string, PlayerRollPromptApp>();

function getSender(message: AskARollSocketMessage): User | null {
  return game.users?.get(message.senderUserId) ?? null;
}

function isMessageFromGm(message: AskARollSocketMessage): boolean {
  return getSender(message)?.isGM === true;
}

function routeGmSocketMessage(message: AskARollSocketMessage): void {
  if (message.type === "request:create" && !isMessageFromGm(message)) {
    return;
  }

  if (!game.user?.isGM) {
    return;
  }

  if (message.type === "request:delivered") {
    if (isRequestDeliveredPayload(message.payload)) {
      gmRollRequestService.markDelivered(
        message.requestId,
        message.payload.playerUserId,
      );
    }
    return;
  }

  if (message.type === "roll:submitted") {
    if (!isRollSubmittedPayload(message.payload)) {
      return;
    }

    const trackedState = gmRollRequestService.getState(message.requestId);
    if (trackedState == null || trackedState.request.gmUserId !== game.user.id) {
      return;
    }

    gmRollRequestService.markSubmitted(message.requestId, message.payload);
    void chatResultService.tagChatMessages(message.payload.chatMessageIds, {
      requestId: message.requestId,
      rollTypeId: message.payload.rollTypeId,
      actorId: message.payload.actorId,
      gmUserId: trackedState.request.gmUserId,
      playerUserId: message.payload.playerUserId,
    });
    return;
  }

  if (message.type === "roll:failed" && isRollFailedPayload(message.payload)) {
    gmRollRequestService.markFailed(message.requestId, message.payload);
  }
}

function routePlayerSocketMessage(message: AskARollSocketMessage): void {
  if (!isRequestCreateMessage(message) || !isMessageFromGm(message)) {
    return;
  }

  const currentUser = game.user;
  if (currentUser == null) {
    return;
  }

  const targets = resolveCurrentUserRequestTargets(
    message.payload.request,
    currentUser,
  );
  if (targets.length === 0) {
    return;
  }

  if (openPlayerPrompts.has(message.requestId)) {
    return;
  }

  const adapterResult = getSystemRollAdapter(game);
  if (!adapterResult.ok) {
    return;
  }

  const service = new PlayerRollRequestService(
    adapterResult.value as SystemRollAdapter<Wfrp4eRollDescriptor>,
  );
  const prompt = new PlayerRollPromptApp(
    message.payload.request,
    targets.map((target) => ({
      id: target.id,
      name: target.name,
      img: target.img,
    })),
    service,
    (requestId) => openPlayerPrompts.delete(requestId),
  );
  openPlayerPrompts.set(message.requestId, prompt);

  void prompt.render({ force: true });

  const deliveredMessage = createRequestDeliveredMessage({
    requestId: message.requestId,
    senderUserId: asUserId(currentUser.id),
    playerUserId: asUserId(currentUser.id),
    actorIds: targets.map((target) => target.id),
  });
  game.socket?.emit(askARollSocketChannel, deliveredMessage);
  routeGmSocketMessage(deliveredMessage);
}

export function routeSocketMessage(value: unknown): void {
  if (!isAskARollSocketMessage(value)) {
    return;
  }

  routeGmSocketMessage(value);
  routePlayerSocketMessage(value);
}
