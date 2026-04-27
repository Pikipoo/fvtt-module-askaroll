import type { ActorId, RollTypeId } from "../domain/ids";
import type { RollRequest } from "../domain/requests";
import type { Wfrp4eRollDescriptor } from "../domain/rolls";
import type { SystemRollAdapter } from "../systems/adapter";
import { rollDescriptorToRollTypeId } from "../ui/player/playerRollPromptViewModel";

const rollFailedReasonKey = "askaroll.player.error.rollFailed";

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
};

type AdapterSuccess = {
  readonly ok: true;
  readonly value: unknown;
};

type OneArgumentRollExecutor = (
  context: PlayerRollContext,
) => Promise<unknown>;

type TwoArgumentRollExecutor = (
  actor: unknown,
  roll: Wfrp4eRollDescriptor,
) => Promise<unknown>;

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

  constructor(adapter: SystemRollAdapter<Wfrp4eRollDescriptor>) {
    this.#adapter = adapter;
  }

  async performRequestedRoll(
    request: RollRequest,
    actorId: ActorId,
    roll: Wfrp4eRollDescriptor,
    event: Event | null,
  ): Promise<PlayerRollRequestServiceResult> {
    const rollTypeId = rollDescriptorToRollTypeId(roll);

    try {
      const adapterResult = await this.#executeAdapter(request, actorId, roll, event);

      if (isAdapterFailure(adapterResult)) {
        return { ok: false, reasonKey: rollFailedReasonKey };
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
      return { ok: false, reasonKey: rollFailedReasonKey };
    }
  }

  async #executeAdapter(
    request: RollRequest,
    actorId: ActorId,
    roll: Wfrp4eRollDescriptor,
    event: Event | null,
  ): Promise<unknown> {
    if (this.#adapter.executeRoll.length <= 1) {
      const executeRoll = this.#adapter.executeRoll as unknown as OneArgumentRollExecutor;

      return executeRoll({
        request,
        actor: actorId as unknown as Actor,
        roll,
        event,
      });
    }

    const executeRoll = this.#adapter.executeRoll as unknown as TwoArgumentRollExecutor;

    return executeRoll(actorId, roll);
  }
}
