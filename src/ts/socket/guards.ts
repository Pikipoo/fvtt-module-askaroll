import { moduleId } from "../constants";
import type { ActorId, RequestId, RollTypeId, UserId } from "../domain/ids";
import type { RecipientTarget } from "../domain/recipients";
import type { RollRequest, RollVisibility, SelectionMode } from "../domain/requests";
import type { Wfrp4eCharacteristic, Wfrp4eRollDescriptor } from "../domain/rolls";
import { askARollSocketProtocol } from "./channel";
import type {
  AskARollSocketMessage,
  AskARollSocketMessageType,
  RequestCancelPayload,
  RequestCreatePayload,
  RequestDeliveredPayload,
  RollFailedPayload,
  RollSubmittedPayload,
} from "./messages";

const socketMessageTypes = new Set<AskARollSocketMessageType>([
  "request:create",
  "request:cancel",
  "request:delivered",
  "roll:submitted",
  "roll:failed",
]);

const rollVisibilities = new Set<RollVisibility>([
  "publicroll",
  "gmroll",
  "blindroll",
  "selfroll",
]);

const selectionModes = new Set<SelectionMode>(["all", "one"]);

const wfrp4eCharacteristics = new Set<Wfrp4eCharacteristic>([
  "ws",
  "bs",
  "s",
  "t",
  "i",
  "ag",
  "dex",
  "int",
  "wp",
  "fel",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isSocketMessageType(value: unknown): value is AskARollSocketMessageType {
  return typeof value === "string" && socketMessageTypes.has(value as AskARollSocketMessageType);
}

function isRollVisibility(value: unknown): value is RollVisibility {
  return typeof value === "string" && rollVisibilities.has(value as RollVisibility);
}

function isSelectionMode(value: unknown): value is SelectionMode {
  return typeof value === "string" && selectionModes.has(value as SelectionMode);
}

function isWfrp4eRollDescriptor(value: unknown): value is Wfrp4eRollDescriptor {
  if (!isRecord(value) || value.system !== "wfrp4e") {
    return false;
  }

  if (value.type === "characteristic") {
    return (
      typeof value.characteristic === "string" &&
      wfrp4eCharacteristics.has(value.characteristic as Wfrp4eCharacteristic) &&
      typeof value.labelKey === "string"
    );
  }

  return false;
}

function isRecipientTarget(value: unknown): value is RecipientTarget {
  if (!isRecord(value)) {
    return false;
  }

  switch (value.type) {
    case "controlledTokens":
      return (
        isStringArray(value.actorIds) &&
        isStringArray(value.tokenIds) &&
        (typeof value.sceneId === "string" || value.sceneId === null)
      );
    case "assignedCharacters":
    case "users":
      return isStringArray(value.userIds) && isStringArray(value.actorIds);
    default:
      return false;
  }
}

export function isRollRequest(value: unknown): value is RollRequest {
  return (
    isRecord(value) &&
    typeof value.requestId === "string" &&
    value.status === "created" &&
    value.systemId === "wfrp4e" &&
    typeof value.gmUserId === "string" &&
    typeof value.createdAt === "number" &&
    isRecipientTarget(value.recipients) &&
    isStringArray(value.actorIds) &&
    value.actorIds.length > 0 &&
    Array.isArray(value.rolls) &&
    value.rolls.length > 0 &&
    value.rolls.every(isWfrp4eRollDescriptor) &&
    isRollVisibility(value.visibility) &&
    isSelectionMode(value.selectionMode) &&
    typeof value.reason === "string"
  );
}

export function isRequestCreateMessage(
  message: AskARollSocketMessage,
): message is AskARollSocketMessage<"request:create"> {
  const payload: unknown = message.payload;
  return (
    message.type === "request:create" &&
    isRecord(payload) &&
    isRollRequest(payload.request) &&
    payload.request.requestId === message.requestId &&
    payload.request.gmUserId === message.senderUserId
  );
}

export function isRequestCreatePayload(value: unknown): value is RequestCreatePayload {
  return isRecord(value) && isRollRequest(value.request);
}

export function isRequestCancelPayload(value: unknown): value is RequestCancelPayload {
  return isRecord(value) && typeof value.reasonKey === "string";
}

export function isRequestDeliveredPayload(value: unknown): value is RequestDeliveredPayload {
  return (
    isRecord(value) &&
    typeof value.playerUserId === "string" &&
    isStringArray(value.actorIds)
  );
}

export function isRollSubmittedPayload(value: unknown): value is RollSubmittedPayload {
  return (
    isRecord(value) &&
    typeof value.actorId === "string" &&
    typeof value.rollTypeId === "string" &&
    typeof value.playerUserId === "string" &&
    isStringArray(value.chatMessageIds) &&
    typeof value.completedAt === "number"
  );
}

export function isRollFailedPayload(value: unknown): value is RollFailedPayload {
  return (
    isRecord(value) &&
    typeof value.actorId === "string" &&
    typeof value.rollTypeId === "string" &&
    typeof value.playerUserId === "string" &&
    typeof value.reasonKey === "string" &&
    typeof value.failedAt === "number"
  );
}

export function isAskARollSocketMessage(value: unknown): value is AskARollSocketMessage {
  if (
    !isRecord(value) ||
    value.moduleId !== moduleId ||
    value.protocol !== askARollSocketProtocol ||
    !isSocketMessageType(value.type) ||
    typeof value.requestId !== "string" ||
    typeof value.senderUserId !== "string" ||
    typeof value.createdAt !== "number"
  ) {
    return false;
  }

  switch (value.type) {
    case "request:create":
      return isRequestCreateMessage(value as AskARollSocketMessage);
    case "request:cancel":
      return isRequestCancelPayload(value.payload);
    case "request:delivered":
      return (
        isRequestDeliveredPayload(value.payload) &&
        value.payload.playerUserId === value.senderUserId
      );
    case "roll:submitted":
      return (
        isRollSubmittedPayload(value.payload) &&
        value.payload.playerUserId === value.senderUserId
      );
    case "roll:failed":
      return (
        isRollFailedPayload(value.payload) &&
        value.payload.playerUserId === value.senderUserId
      );
  }
}

export function asRequestIdFromMessage(value: string): RequestId {
  return value as RequestId;
}

export function asUserIdFromMessage(value: string): UserId {
  return value as UserId;
}

export function asActorIdFromMessage(value: string): ActorId {
  return value as ActorId;
}

export function asRollTypeIdFromMessage(value: string): RollTypeId {
  return value as RollTypeId;
}
