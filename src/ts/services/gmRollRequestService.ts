import type { ActorId, RequestId, RollTypeId, UserId } from "../domain/ids";
import { asRequestId, asUserId } from "../domain/ids";
import type { RecipientTargetInput } from "../domain/recipients";
import { createRollRequest, type RollRequest, type RollVisibility, type SelectionMode } from "../domain/requests";
import type { Wfrp4eRollDescriptor } from "../domain/rolls";
import { askARollSocketChannel } from "../socket/channel";
import { createRequestCreateMessage, type RollFailedPayload, type RollSubmittedPayload } from "../socket/messages";
import { notifyInfo, notifyWarn } from "./notifications";
import { filterActorsOwnedByUser } from "./recipientResolver";
import { requestChatCardService } from "./requestChatCardService";

export type CreateGmRollRequestServiceInput = {
  readonly actorIds: readonly ActorId[];
  readonly rolls: readonly Wfrp4eRollDescriptor[];
  readonly recipients: RecipientTargetInput;
  readonly visibility: RollVisibility;
  readonly selectionMode: SelectionMode;
  readonly reason: string;
};

export type StoredRollResult = {
  readonly actorId: ActorId;
  readonly rollTypeId: RollTypeId;
  readonly playerUserId: UserId;
  readonly chatMessageIds: readonly string[];
  readonly status: "submitted" | "failed";
  readonly completedAt: number;
  readonly reasonKey?: string;
};

export type StoredGmRollRequestState = {
  readonly request: RollRequest;
  readonly deliveredToUserIds: readonly UserId[];
  readonly results: readonly StoredRollResult[];
};

type MutableGmRollRequestState = {
  request: RollRequest;
  deliveredToUserIds: Set<UserId>;
  results: StoredRollResult[];
};

function uniqueActorIds(actorIds: readonly ActorId[]): readonly ActorId[] {
  return [...new Set(actorIds)];
}

function rollDescriptorToRollTypeIdString(roll: Wfrp4eRollDescriptor): string {
  switch (roll.type) {
    case "characteristic":
      return `${roll.type}:${roll.characteristic}`;
    case "skill":
      return `${roll.type}:${roll.skillId}`;
    case "customFormula":
      return `${roll.type}:${roll.formula}`;
  }
}

function requestContainsRollResult(
  request: RollRequest,
  actorId: ActorId,
  rollTypeId: RollTypeId,
): boolean {
  return (
    request.actorIds.some((requestActorId) => requestActorId === actorId) &&
    request.rolls.some(
      (roll) => rollDescriptorToRollTypeIdString(roll) === rollTypeId,
    )
  );
}

function resultMatches(
  result: StoredRollResult,
  actorId: ActorId,
  rollTypeId: RollTypeId,
  playerUserId: UserId,
): boolean {
  return (
    result.actorId === actorId &&
    result.rollTypeId === rollTypeId &&
    result.playerUserId === playerUserId
  );
}

function hasCompletedSelectionForPlayer(
  state: MutableGmRollRequestState,
  playerUserId: UserId,
): boolean {
  return state.results.some(
    (result) => result.status === "submitted" && result.playerUserId === playerUserId,
  );
}

function normalizeRecipientTargets(
  recipients: RecipientTargetInput,
  actorIds: readonly ActorId[],
): { readonly recipients: RecipientTargetInput; readonly actorIds: readonly ActorId[] } | null {
  if (recipients.type === "controlledTokens") {
    const recipientActorIds = new Set(recipients.actorIds);
    const normalizedActorIds = uniqueActorIds(
      actorIds.filter((actorId) => recipientActorIds.has(actorId)),
    );
    return normalizedActorIds.length === 0 || recipients.tokenIds.length === 0 || recipients.sceneId == null
      ? null
      : {
          actorIds: normalizedActorIds,
          recipients: {
            ...recipients,
            actorIds: normalizedActorIds,
          },
        };
  }

  const ownedActorIdsByUser = recipients.userIds.map((userId) => ({
    userId,
    actorIds: filterActorsOwnedByUser(userId, actorIds),
  }));
  const validUserTargets = ownedActorIdsByUser.filter(
    (target) => target.actorIds.length > 0,
  );
  const normalizedActorIds = uniqueActorIds(
    validUserTargets.flatMap((target) => target.actorIds),
  );

  if (validUserTargets.length === 0 || normalizedActorIds.length === 0) {
    return null;
  }

  return {
    actorIds: normalizedActorIds,
    recipients: {
      type: recipients.type,
      userIds: validUserTargets.map((target) => target.userId),
      actorIds: normalizedActorIds,
    },
  };
}

export class GmRollRequestService {
  readonly #requests = new Map<RequestId, MutableGmRollRequestState>();

  async createAndDispatchRequest(
    input: CreateGmRollRequestServiceInput,
  ): Promise<RollRequest | null> {
    if (!game.user?.isGM) {
      return null;
    }

    if (input.actorIds.length === 0) {
      notifyWarn("askaroll.gm.validation.noActors");
      return null;
    }

    if (input.rolls.length === 0) {
      notifyWarn("askaroll.gm.validation.noRolls");
      return null;
    }

    const normalizedTargets = normalizeRecipientTargets(input.recipients, input.actorIds);
    if (normalizedTargets == null) {
      notifyWarn("askaroll.gm.validation.noValidRecipients");
      return null;
    }

    const result = createRollRequest({
      requestId: asRequestId(foundry.utils.randomID()),
      gmUserId: asUserId(game.user.id),
      actorIds: normalizedTargets.actorIds,
      rolls: input.rolls,
      recipients: normalizedTargets.recipients,
      visibility: input.visibility,
      selectionMode: input.selectionMode,
      reason: input.reason,
      createdAt: Date.now(),
    });

    if (!result.ok) {
      notifyWarn(
        result.reason === "noActors"
          ? "askaroll.gm.validation.noActors"
          : "askaroll.gm.validation.noRolls",
      );
      return null;
    }

    this.trackRequest(result.value);
    await requestChatCardService.createRequestPrompt(result.value);
    game.socket?.emit(
      askARollSocketChannel,
      createRequestCreateMessage(result.value),
    );
    notifyInfo("askaroll.notifications.sent");

    return result.value;
  }

  trackRequest(request: RollRequest): void {
    this.#requests.set(request.requestId, {
      request,
      deliveredToUserIds: new Set(),
      results: [],
    });
  }

  markDelivered(requestId: RequestId, playerUserId: UserId): void {
    this.#requests.get(requestId)?.deliveredToUserIds.add(playerUserId);
  }

  markSubmitted(requestId: RequestId, payload: RollSubmittedPayload): boolean {
    const state = this.#requests.get(requestId);
    if (state == null) {
      return false;
    }

    if (!requestContainsRollResult(state.request, payload.actorId, payload.rollTypeId)) {
      return false;
    }

    if (
      state.results.some((result) =>
        resultMatches(result, payload.actorId, payload.rollTypeId, payload.playerUserId),
      )
    ) {
      return false;
    }

    if (
      state.request.selectionMode === "one" &&
      hasCompletedSelectionForPlayer(state, payload.playerUserId)
    ) {
      return false;
    }

    state.results.push({
      actorId: payload.actorId,
      rollTypeId: payload.rollTypeId,
      playerUserId: payload.playerUserId,
      chatMessageIds: [...payload.chatMessageIds],
      status: "submitted",
      completedAt: payload.completedAt,
    });
    return true;
  }

  markFailed(requestId: RequestId, payload: RollFailedPayload): void {
    const state = this.#requests.get(requestId);
    if (state == null) {
      return;
    }

    if (!requestContainsRollResult(state.request, payload.actorId, payload.rollTypeId)) {
      return;
    }

    if (
      state.results.some((result) =>
        resultMatches(result, payload.actorId, payload.rollTypeId, payload.playerUserId),
      )
    ) {
      return;
    }

    state.results.push({
      actorId: payload.actorId,
      rollTypeId: payload.rollTypeId,
      playerUserId: payload.playerUserId,
      chatMessageIds: [],
      status: "failed",
      completedAt: payload.failedAt,
      reasonKey: payload.reasonKey,
    });
  }

  getState(requestId: RequestId): StoredGmRollRequestState | null {
    const state = this.#requests.get(requestId);
    if (state == null) {
      return null;
    }

    return {
      request: state.request,
      deliveredToUserIds: [...state.deliveredToUserIds],
      results: [...state.results],
    };
  }
}

export const gmRollRequestService = new GmRollRequestService();
