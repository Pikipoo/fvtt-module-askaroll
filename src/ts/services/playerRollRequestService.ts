import type { ActorId, RequestId, RollTypeId } from "../domain/ids";
import type { RollRequest } from "../domain/requests";
import type { Wfrp4eRollDescriptor } from "../domain/rolls";
import type { SystemRollAdapter } from "../systems/adapter";
import { rollDescriptorToRollTypeId } from "../ui/player/playerRollPromptViewModel";

const rollFailedReasonKey = "askaroll.player.error.rollFailed";
const requestMissingReasonKey = "askaroll.player.error.requestMissing";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
  readonly #requestsById = new Map<RequestId, RollRequest>();

  constructor(adapter: SystemRollAdapter<Wfrp4eRollDescriptor>) {
    this.#adapter = adapter;
  }

  trackRequest(request: RollRequest): void {
    this.#requestsById.set(request.requestId, request);
  }

  untrackRequest(requestId: RequestId): void {
    this.#requestsById.delete(requestId);
  }

  async performRequestedRoll(
    requestId: RequestId,
    actorId: ActorId,
    rollTypeId: RollTypeId,
    event: Event | null,
  ): Promise<PlayerRollRequestServiceResult> {
    const request = this.#requestsById.get(requestId);
    if (request == null) {
      return { ok: false, reasonKey: requestMissingReasonKey };
    }

    const roll = request.rolls.find(
      (candidate) => rollDescriptorToRollTypeId(candidate) === rollTypeId,
    );
    if (roll == null) {
      return { ok: false, reasonKey: rollFailedReasonKey };
    }

    const actor = game.actors?.get(actorId as string);
    if (actor == null) {
      return { ok: false, reasonKey: rollFailedReasonKey };
    }

    try {
      const adapterResult = await this.#adapter.executeRoll(actor, roll);
      if (!adapterResult.ok) {
        return { ok: false, reasonKey: adapterResult.messageKey };
      }

      const rollResult = adapterResult.value;
      void event;

      return {
        ok: true,
        result: isRollResultSummary(rollResult)
          ? rollResult
          : createFallbackResultSummary(actorId, rollTypeId),
      };
    } catch {
      return { ok: false, reasonKey: rollFailedReasonKey };
    }
  }
}
