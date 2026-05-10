import type { ActorId, RequestId, RollTypeId } from "../domain/ids";
import { asUserId } from "../domain/ids";
import type { RollRequest } from "../domain/requests";
import type { Wfrp4eRollDescriptor } from "../domain/rolls";
import type { SystemRollAdapter } from "../systems/adapter";
import { rollDescriptorToRollTypeId } from "../ui/player/playerRollPromptViewModel";
import { createAskARollChatFlags } from "./chatResultService";
import { filterActorsOwnedByUser, isRequestTargetingUser } from "./recipientResolver";

const rollFailedReasonKey = "askaroll.player.error.rollFailed";
const invalidActorReasonKey = "askaroll.player.error.invalidActor";
const actorPermissionDeniedReasonKey = "askaroll.player.error.actorPermissionDenied";
const userNotTargetedReasonKey = "askaroll.player.error.userNotTargeted";

export type RollResultSummary = {
  readonly actorId: ActorId;
  readonly rollTypeId: RollTypeId;
  readonly chatMessageIds: readonly string[];
  readonly completedAt: number;
};

export type PlayerRollContext = {
  readonly request: RollRequest;
  readonly actor: Actor;
  readonly roll: Wfrp4eRollDescriptor;
  readonly event: Event | null;
};

export type PlayerRollRequestServiceResult =
  | { readonly ok: true; readonly result: RollResultSummary }
  | { readonly ok: false; readonly reasonKey: string };

type AdapterFailure = {
  readonly ok: false;
  readonly messageKey?: string;
};

type AdapterSuccess = {
  readonly ok: true;
  readonly value: unknown;
};

type ChatMessagePreCreateDocument = {
  readonly id?: string | null;
  updateSource(data: ReturnType<typeof createAskARollChatFlags>): unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAdapterSuccess(value: unknown): value is AdapterSuccess {
  return isRecord(value) && value.ok === true && "value" in value;
}

function isAdapterFailure(value: unknown): value is AdapterFailure {
  return isRecord(value) && value.ok === false;
}

function isRollResultSummary(value: unknown): value is RollResultSummary {
  return (
    isRecord(value) &&
    typeof value.actorId === "string" &&
    typeof value.rollTypeId === "string" &&
    Array.isArray(value.chatMessageIds) &&
    value.chatMessageIds.every((id) => typeof id === "string") &&
    typeof value.completedAt === "number"
  );
}

function createFallbackResultSummary(
  actorId: ActorId,
  rollTypeId: RollTypeId,
): RollResultSummary {
  return {
    actorId,
    rollTypeId,
    chatMessageIds: [],
    completedAt: Date.now(),
  };
}

function addStringId(ids: Set<string>, value: unknown): void {
  if (typeof value === "string" && value.length > 0) {
    ids.add(value);
  }
}

export class PlayerRollRequestService {
  readonly #adapter: SystemRollAdapter<Wfrp4eRollDescriptor>;
  readonly #requests = new Map<RequestId, RollRequest>();

  constructor(adapter: SystemRollAdapter<Wfrp4eRollDescriptor>) {
    this.#adapter = adapter;
  }

  registerRequest(request: RollRequest): void {
    this.#requests.set(request.requestId, request);
  }

  unregisterRequest(requestId: RequestId): void {
    this.#requests.delete(requestId);
  }

  async performRequestedRoll(
    requestId: RequestId,
    actorId: ActorId,
    rollTypeId: RollTypeId,
    event: Event | null,
  ): Promise<PlayerRollRequestServiceResult> {
    void event;
    const request = this.#requests.get(requestId);
    const roll = request?.rolls.find(
      (requestedRoll) => rollDescriptorToRollTypeId(requestedRoll) === rollTypeId,
    );
    const actorBelongsToRequest =
      request?.actorIds.some((requestActorId) => requestActorId === actorId) ?? false;
    const actor = game.actors?.get(actorId);

    if (request == null || roll == null) {
      return { ok: false, reasonKey: rollFailedReasonKey };
    }

    if (!actorBelongsToRequest || actor == null) {
      return { ok: false, reasonKey: invalidActorReasonKey };
    }

    const currentUserId = game.user?.id;
    if (currentUserId == null || !isRequestTargetingUser(request, asUserId(currentUserId))) {
      return { ok: false, reasonKey: userNotTargetedReasonKey };
    }

    const userOwnedActorIds = currentUserId == null
      ? []
      : filterActorsOwnedByUser(asUserId(currentUserId), [actorId]);
    if (userOwnedActorIds.length === 0) {
      return { ok: false, reasonKey: actorPermissionDeniedReasonKey };
    }

    const capturedChatMessageIds = new Set<string>();
    const hookId = Hooks.on(
      "preCreateChatMessage",
      (
        document: unknown,
        source: unknown,
        _options: unknown,
        userId: unknown,
      ) => {
        const currentUserId = game.user?.id;
        if (currentUserId == null || userId !== currentUserId) {
          return;
        }

        const chatMessage = document as ChatMessagePreCreateDocument;
        chatMessage.updateSource(
          createAskARollChatFlags({
            requestId,
            rollTypeId,
            actorId,
            gmUserId: request.gmUserId,
            playerUserId: asUserId(currentUserId),
          }),
        );

        addStringId(capturedChatMessageIds, chatMessage.id);
        if (isRecord(source)) {
          addStringId(capturedChatMessageIds, source._id);
        }
      },
    );

    try {
      const adapterResult = await this.#adapter.executeRoll(actor, roll, {
        rollMode: request.visibility,
      });

      if (isAdapterFailure(adapterResult)) {
        return {
          ok: false,
          reasonKey:
            typeof adapterResult.messageKey === "string"
              ? adapterResult.messageKey
              : rollFailedReasonKey,
        };
      }

      const rollResult = isAdapterSuccess(adapterResult)
        ? adapterResult.value
        : adapterResult;

      const result = isRollResultSummary(rollResult)
        ? rollResult
        : createFallbackResultSummary(actorId, rollTypeId);
      const chatMessageIds = new Set<string>(result.chatMessageIds);
      for (const id of capturedChatMessageIds) {
        chatMessageIds.add(id);
      }

      return {
        ok: true,
        result: {
          ...result,
          chatMessageIds: [...chatMessageIds],
        },
      };
    } catch {
      return { ok: false, reasonKey: rollFailedReasonKey };
    } finally {
      Hooks.off("preCreateChatMessage", hookId);
    }
  }
}
