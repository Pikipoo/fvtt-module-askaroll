import { moduleId } from "../constants";
import type { ActorId, RequestId, RollTypeId, UserId } from "../domain/ids";
import type { RollRequest } from "../domain/requests";
import { askARollSocketProtocol } from "./channel";

export type AskARollSocketMessageType =
  | "request:create"
  | "request:cancel"
  | "request:delivered"
  | "roll:submitted"
  | "roll:failed";

export type RequestCreatePayload = {
  readonly request: RollRequest;
};

export type RequestCancelPayload = {
  readonly reasonKey: string;
};

export type RequestDeliveredPayload = {
  readonly playerUserId: UserId;
  readonly actorIds: readonly ActorId[];
};

export type RollSubmittedPayload = {
  readonly actorId: ActorId;
  readonly rollTypeId: RollTypeId;
  readonly playerUserId: UserId;
  readonly chatMessageIds: readonly string[];
  readonly completedAt: number;
};

export type RollFailedPayload = {
  readonly actorId: ActorId;
  readonly rollTypeId: RollTypeId;
  readonly playerUserId: UserId;
  readonly reasonKey: string;
  readonly failedAt: number;
};

export type AskARollSocketMessageByType = {
  readonly "request:create": RequestCreatePayload;
  readonly "request:cancel": RequestCancelPayload;
  readonly "request:delivered": RequestDeliveredPayload;
  readonly "roll:submitted": RollSubmittedPayload;
  readonly "roll:failed": RollFailedPayload;
};

export type AskARollSocketMessage<
  TType extends AskARollSocketMessageType = AskARollSocketMessageType,
> = {
  readonly moduleId: typeof moduleId;
  readonly protocol: typeof askARollSocketProtocol;
  readonly type: TType;
  readonly requestId: RequestId;
  readonly senderUserId: UserId;
  readonly createdAt: number;
  readonly payload: AskARollSocketMessageByType[TType];
};

function createSocketMessage<TType extends AskARollSocketMessageType>(input: {
  readonly type: TType;
  readonly requestId: RequestId;
  readonly senderUserId: UserId;
  readonly payload: AskARollSocketMessageByType[TType];
}): AskARollSocketMessage<TType> {
  return {
    moduleId,
    protocol: askARollSocketProtocol,
    type: input.type,
    requestId: input.requestId,
    senderUserId: input.senderUserId,
    createdAt: Date.now(),
    payload: input.payload,
  };
}

export function createRequestCreateMessage(
  request: RollRequest,
): AskARollSocketMessage<"request:create"> {
  return createSocketMessage({
    type: "request:create",
    requestId: request.requestId,
    senderUserId: request.gmUserId,
    payload: { request },
  });
}

export function createRequestCancelMessage(input: {
  readonly requestId: RequestId;
  readonly senderUserId: UserId;
  readonly reasonKey: string;
}): AskARollSocketMessage<"request:cancel"> {
  return createSocketMessage({
    type: "request:cancel",
    requestId: input.requestId,
    senderUserId: input.senderUserId,
    payload: { reasonKey: input.reasonKey },
  });
}

export function createRequestDeliveredMessage(input: {
  readonly requestId: RequestId;
  readonly senderUserId: UserId;
  readonly playerUserId: UserId;
  readonly actorIds: readonly ActorId[];
}): AskARollSocketMessage<"request:delivered"> {
  return createSocketMessage({
    type: "request:delivered",
    requestId: input.requestId,
    senderUserId: input.senderUserId,
    payload: {
      playerUserId: input.playerUserId,
      actorIds: [...input.actorIds],
    },
  });
}

export function createRollSubmittedMessage(input: {
  readonly requestId: RequestId;
  readonly senderUserId: UserId;
  readonly actorId: ActorId;
  readonly rollTypeId: RollTypeId;
  readonly playerUserId: UserId;
  readonly chatMessageIds: readonly string[];
  readonly completedAt: number;
}): AskARollSocketMessage<"roll:submitted"> {
  return createSocketMessage({
    type: "roll:submitted",
    requestId: input.requestId,
    senderUserId: input.senderUserId,
    payload: {
      actorId: input.actorId,
      rollTypeId: input.rollTypeId,
      playerUserId: input.playerUserId,
      chatMessageIds: [...input.chatMessageIds],
      completedAt: input.completedAt,
    },
  });
}

export function createRollFailedMessage(input: {
  readonly requestId: RequestId;
  readonly senderUserId: UserId;
  readonly actorId: ActorId;
  readonly rollTypeId: RollTypeId;
  readonly playerUserId: UserId;
  readonly reasonKey: string;
  readonly failedAt: number;
}): AskARollSocketMessage<"roll:failed"> {
  return createSocketMessage({
    type: "roll:failed",
    requestId: input.requestId,
    senderUserId: input.senderUserId,
    payload: {
      actorId: input.actorId,
      rollTypeId: input.rollTypeId,
      playerUserId: input.playerUserId,
      reasonKey: input.reasonKey,
      failedAt: input.failedAt,
    },
  });
}
