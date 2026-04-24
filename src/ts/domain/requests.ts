import type { ActorId, RequestId, UserId } from "./ids";
import {
  copyRecipientTarget,
  type RecipientTarget,
  type RecipientTargetInput,
} from "./recipients";
import {
  copyWfrp4eRollDescriptor,
  type Wfrp4eRollDescriptor,
} from "./rolls";
import {
  validateRollRequestInput,
  type RollRequestValidationFailure,
} from "./validation";

export type RollVisibility = "publicroll" | "gmroll" | "blindroll" | "selfroll";

export type SelectionMode = "all" | "one";

export type RequestStatus =
  | "created"
  | "delivered"
  | "rolled"
  | "cancelled"
  | "expired"
  | "failed";

export type RollRequest = {
  readonly requestId: RequestId;
  readonly status: RequestStatus;
  readonly systemId: "wfrp4e";
  readonly gmUserId: UserId;
  readonly createdAt: number;
  readonly recipients: RecipientTarget;
  readonly actorIds: readonly ActorId[];
  readonly rolls: readonly Wfrp4eRollDescriptor[];
  readonly visibility: RollVisibility;
  readonly selectionMode: SelectionMode;
  readonly reason: string;
};

export type CreateRollRequestInput = {
  requestId: RequestId;
  gmUserId: UserId;
  actorIds: readonly ActorId[];
  rolls: readonly Wfrp4eRollDescriptor[];
  recipients: RecipientTargetInput;
  visibility: RollVisibility;
  selectionMode: SelectionMode;
  reason: string;
  createdAt: number;
};

export type CreateRollRequestResult =
  | { ok: true; value: RollRequest }
  | { ok: false; reason: RollRequestValidationFailure };

export const createRollRequest = (
  input: CreateRollRequestInput,
): CreateRollRequestResult => {
  const validation = validateRollRequestInput(input);

  if (!validation.ok) {
    return validation;
  }

  return {
    ok: true,
    value: {
      requestId: input.requestId,
      status: "created",
      systemId: "wfrp4e",
      gmUserId: input.gmUserId,
      createdAt: input.createdAt,
      recipients: copyRecipientTarget(input.recipients),
      actorIds: [...input.actorIds],
      rolls: input.rolls.map(copyWfrp4eRollDescriptor),
      visibility: input.visibility,
      selectionMode: input.selectionMode,
      reason: input.reason,
    },
  };
};
