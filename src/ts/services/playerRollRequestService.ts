import type { ActorId, RequestId, RollTypeId } from "../domain/ids";
import type { RollRequest } from "../domain/requests";
import type { Wfrp4eRollDescriptor } from "../domain/rolls";
import type { SystemRollAdapter } from "../systems/adapter";
import { rollDescriptorToRollTypeId } from "../ui/player/playerRollPromptViewModel";

const rollFailedReasonKey = "askaroll.player.error.rollFailed";
const invalidActorReasonKey = "askaroll.player.error.invalidActor";

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

    try {
      const adapterResult = await this.#adapter.executeRoll(actor, roll);

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

      return {
        ok: true,
        result: isRollResultSummary(rollResult)
          ? rollResult
          : createFallbackResultSummary(actorId, rollTypeId),
      };
    } catch {
      void event;
      return { ok: false, reasonKey: rollFailedReasonKey };
    }
  }
}
