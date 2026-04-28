import type { ActorId, RequestId, UserId } from "./ids";
import type { Wfrp4eRollDescriptor } from "./rolls";

export type RollResultStatus = "succeeded" | "failed";

export type RollResult = {
  readonly requestId: RequestId;
  readonly actorId: ActorId;
  readonly userId: UserId;
  readonly roll: Wfrp4eRollDescriptor;
  readonly status: RollResultStatus;
  readonly createdAt: number;
};
