import type { ActorId, RequestId, RollTypeId, UserId } from "../domain/ids";
import { asRequestId, asUserId } from "../domain/ids";
import type { RecipientTargetInput } from "../domain/recipients";
import { createRollRequest, type RollRequest, type RollVisibility, type SelectionMode } from "../domain/requests";
import type { Wfrp4eRollDescriptor } from "../domain/rolls";
import { askARollSocketChannel } from "../socket/channel";
import { createRequestCreateMessage, type RollFailedPayload, type RollSubmittedPayload } from "../socket/messages";
import { notifyInfo, notifyWarn } from "./notifications";

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

export class GmRollRequestService {
  readonly #requests = new Map<RequestId, MutableGmRollRequestState>();

  async createAndDispatchRequest(
    input: CreateGmRollRequestServiceInput,
  ): Promise<RollRequest | null> {
    if (!game.user?.isGM) {
      return null;
    }

    const result = createRollRequest({
      requestId: asRequestId(foundry.utils.randomID()),
      gmUserId: asUserId(game.user.id),
      actorIds: input.actorIds,
      rolls: input.rolls,
      recipients: input.recipients,
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

  markSubmitted(requestId: RequestId, payload: RollSubmittedPayload): void {
    const state = this.#requests.get(requestId);
    if (state == null) {
      return;
    }

    state.results.push({
      actorId: payload.actorId,
      rollTypeId: payload.rollTypeId,
      playerUserId: payload.playerUserId,
      chatMessageIds: [...payload.chatMessageIds],
      status: "submitted",
      completedAt: payload.completedAt,
    });
  }

  markFailed(requestId: RequestId, payload: RollFailedPayload): void {
    const state = this.#requests.get(requestId);
    if (state == null) {
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
