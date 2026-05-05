import type { ActorId, RequestId, RollTypeId, UserId } from "../domain/ids";
import { asActorId, asRollTypeId, asUserId } from "../domain/ids";
import type { RollRequest } from "../domain/requests";
import type { Wfrp4eRollDescriptor } from "../domain/rolls";
import { askARollSocketProtocol } from "../socket/channel";
import { askARollSocketChannel } from "../socket/channel";
import { isRollRequest } from "../socket/guards";
import {
  createRollFailedMessage,
  createRollSubmittedMessage,
} from "../socket/messages";
import { getSystemRollAdapter } from "../systems/registry";
import type { SystemRollAdapter } from "../systems/adapter";
import { rollDescriptorToRollTypeId } from "../ui/player/playerRollPromptViewModel";
import { PlayerRollRequestService } from "./playerRollRequestService";
import { notifyError, notifyWarn } from "./notifications";
import { resolveCurrentUserRequestTargets } from "./recipientResolver";

type ChatMessageCreator = {
  create(data: {
    readonly user?: string;
    readonly whisper?: readonly string[];
    readonly content: string;
    readonly flags: { readonly askaroll: AskARollRequestChatFlags };
  }): Promise<unknown>;
};

type RenderedChatMessage = {
  readonly id?: string | null;
  readonly flags?: { readonly askaroll?: unknown };
  update(data: {
    readonly content: string;
    readonly flags: { readonly askaroll: AskARollRequestChatFlags };
  }): Promise<unknown>;
};

export type CompletedRequestChatAction = {
  readonly actorId: ActorId;
  readonly rollTypeId: RollTypeId;
  readonly playerUserId: UserId;
};

export type AskARollRequestChatFlags = {
  readonly protocol: typeof askARollSocketProtocol;
  readonly type: "request";
  readonly request: RollRequest;
  readonly completedActions: readonly CompletedRequestChatAction[];
};

const pendingChatActions = new Set<string>();
const completedChatActions = new Set<string>();
const completedChooseOneRequests = new Set<string>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function localize(label: string): string {
  return label.startsWith("askaroll.") ? game.i18n!.localize(label) : label;
}

function rollDescriptorToLabel(roll: Wfrp4eRollDescriptor): string {
  switch (roll.type) {
    case "characteristic":
    case "customFormula":
      return localize(roll.labelKey);
    case "skill":
      return roll.label;
  }
}

function isCompletedAction(value: unknown): value is CompletedRequestChatAction {
  return (
    isRecord(value) &&
    typeof value.actorId === "string" &&
    typeof value.rollTypeId === "string" &&
    typeof value.playerUserId === "string"
  );
}

function isAskARollRequestChatFlags(
  value: unknown,
): value is AskARollRequestChatFlags {
  return (
    isRecord(value) &&
    value.protocol === askARollSocketProtocol &&
    value.type === "request" &&
    isRollRequest(value.request) &&
    Array.isArray(value.completedActions) &&
    value.completedActions.every(isCompletedAction)
  );
}

function getRequestChatFlags(
  message: unknown,
): AskARollRequestChatFlags | null {
  if (!isRecord(message)) {
    return null;
  }

  const flags = (message as RenderedChatMessage).flags?.askaroll;
  return isAskARollRequestChatFlags(flags) ? flags : null;
}

function getHtmlElement(html: unknown): HTMLElement | null {
  if (typeof HTMLElement === "undefined") {
    return null;
  }

  if (html instanceof HTMLElement) {
    return html;
  }

  if (isRecord(html) && html[0] instanceof HTMLElement) {
    return html[0];
  }

  return null;
}

function actionKey(input: {
  readonly requestId: RequestId;
  readonly actorId: ActorId;
  readonly rollTypeId: RollTypeId;
  readonly playerUserId: UserId;
}): string {
  return `${input.requestId}:${input.actorId}:${input.rollTypeId}:${input.playerUserId}`;
}

function chooseOneKey(requestId: RequestId, playerUserId: UserId): string {
  return `${requestId}:${playerUserId}`;
}

function isActionCompletedForUser(
  flags: AskARollRequestChatFlags,
  actorId: ActorId,
  rollTypeId: RollTypeId,
  playerUserId: UserId,
): boolean {
  return flags.completedActions.some(
    (action) =>
      action.actorId === actorId &&
      action.rollTypeId === rollTypeId &&
      action.playerUserId === playerUserId,
  );
}

function hasCompletedActionForUser(
  flags: AskARollRequestChatFlags,
  playerUserId: UserId,
): boolean {
  return flags.completedActions.some(
    (action) => action.playerUserId === playerUserId,
  );
}

function getActorDisplay(actorId: ActorId): { readonly name: string; readonly img: string } {
  const actor = game.actors?.get(actorId);
  return {
    name: actor?.name ?? game.i18n!.localize("askaroll.common.unknown"),
    img: actor?.img ?? "",
  };
}

function buildRollButtons(request: RollRequest, actorId: ActorId): string {
  return request.rolls
    .map((roll) => {
      const rollTypeId = rollDescriptorToRollTypeId(roll);
      const label = rollDescriptorToLabel(roll);

      return `<button type="button" class="ask-a-roll-chat-request__roll-button" data-askaroll-request-roll="true" data-request-id="${escapeHtml(request.requestId)}" data-actor-id="${escapeHtml(actorId)}" data-roll-type-id="${escapeHtml(rollTypeId)}"><span class="ask-a-roll-chat-request__roll-prefix">${escapeHtml(game.i18n!.localize("askaroll.player.roll"))}</span> <span class="ask-a-roll-chat-request__roll-label">${escapeHtml(label)}</span></button>`;
    })
    .join("");
}

export function buildRequestChatCardContent(request: RollRequest): string {
  const reason = request.reason.trim();
  const reasonSection = reason
    ? `<section class="ask-a-roll-chat-request__section"><p><strong>Reason:</strong> <em>${escapeHtml(reason)}</em></p></section>`
    : "";
  const chooseOneNote = request.selectionMode === "one"
    ? `<p class="ask-a-roll-chat-request__note">${escapeHtml(game.i18n!.localize("askaroll.player.chooseOne"))}</p>`
    : "";
  const actorImages = request.actorIds
    .map((actorId) => {
      const actor = getActorDisplay(actorId);
      return actor.img.length > 0
        ? `<img class="ask-a-roll-chat-request__actor-img" src="${escapeHtml(actor.img)}" alt="${escapeHtml(actor.name)}" />`
        : "";
    })
    .join("");
  const actorImageSection = actorImages
    ? `<div class="ask-a-roll-chat-request__actor-images">${actorImages}</div>`
    : "";
  const actorSections = request.actorIds
    .map((actorId) => {
      const actor = getActorDisplay(actorId);

      return `<section class="ask-a-roll-chat-request__actor"><h4 class="ask-a-roll-chat-request__actor-name">${escapeHtml(actor.name)}</h4><div class="ask-a-roll-chat-request__rolls">${buildRollButtons(request, actorId)}</div></section>`;
    })
    .join("");

  return `<section class="ask-a-roll-chat-request" data-request-id="${escapeHtml(request.requestId)}"><h3>${escapeHtml(game.i18n!.localize("askaroll.player.intro"))}</h3>${actorImageSection}${reasonSection}<section class="ask-a-roll-chat-request__section"><h4>${escapeHtml(game.i18n!.localize("askaroll.player.visibility.label"))}</h4><p>${escapeHtml(game.i18n!.localize(`askaroll.player.visibility.${request.visibility}`))}</p></section>${chooseOneNote}<div class="ask-a-roll-chat-request__actors">${actorSections}</div></section>`;
}

export function createAskARollRequestChatFlags(
  request: RollRequest,
  completedActions: readonly CompletedRequestChatAction[] = [],
): AskARollRequestChatFlags {
  return {
    protocol: askARollSocketProtocol,
    type: "request",
    request,
    completedActions: [...completedActions],
  };
}

async function markActionCompleted(
  message: RenderedChatMessage,
  flags: AskARollRequestChatFlags,
  action: CompletedRequestChatAction,
): Promise<void> {
  if (isActionCompletedForUser(flags, action.actorId, action.rollTypeId, action.playerUserId)) {
    return;
  }

  const updatedFlags = createAskARollRequestChatFlags(flags.request, [
    ...flags.completedActions,
    action,
  ]);
  await message.update({
    content: buildRequestChatCardContent(flags.request),
    flags: { askaroll: updatedFlags },
  });
}

function getWhisperUserIds(request: RollRequest): readonly string[] {
  const userIds = new Set<string>();
  userIds.add(request.gmUserId);

  if (request.recipients.type === "users" || request.recipients.type === "assignedCharacters") {
    for (const userId of request.recipients.userIds) {
      userIds.add(userId);
    }
    return [...userIds];
  }

  for (const user of game.users?.contents ?? []) {
    if (user.isGM || user.id == null) {
      continue;
    }

    if (resolveCurrentUserRequestTargets(request, user).length > 0) {
      userIds.add(user.id);
    }
  }

  return [...userIds];
}

async function createRequestChatCard(request: RollRequest): Promise<void> {
  const create = (ChatMessage as unknown as ChatMessageCreator).create;
  await create.call(ChatMessage, {
    user: game.user?.id,
    whisper: getWhisperUserIds(request),
    content: buildRequestChatCardContent(request),
    flags: { askaroll: createAskARollRequestChatFlags(request) },
  });
}

function getKnownMessages(): readonly RenderedChatMessage[] {
  const messages = game.messages as unknown as
    | { readonly contents?: readonly RenderedChatMessage[] }
    | undefined;
  return messages?.contents ?? [];
}

function emitRollFailed(input: {
  readonly requestId: RequestId;
  readonly actorId: ActorId;
  readonly rollTypeId: RollTypeId;
  readonly playerUserId: UserId;
  readonly reasonKey: string;
}): void {
  game.socket?.emit(
    askARollSocketChannel,
    createRollFailedMessage({
      requestId: input.requestId,
      senderUserId: input.playerUserId,
      actorId: input.actorId,
      rollTypeId: input.rollTypeId,
      playerUserId: input.playerUserId,
      reasonKey: input.reasonKey,
      failedAt: Date.now(),
    }),
  );
}

function emitRollSubmitted(input: {
  readonly requestId: RequestId;
  readonly actorId: ActorId;
  readonly rollTypeId: RollTypeId;
  readonly playerUserId: UserId;
  readonly chatMessageIds: readonly string[];
  readonly completedAt: number;
}): void {
  game.socket?.emit(
    askARollSocketChannel,
    createRollSubmittedMessage({
      requestId: input.requestId,
      senderUserId: input.playerUserId,
      actorId: input.actorId,
      rollTypeId: input.rollTypeId,
      playerUserId: input.playerUserId,
      chatMessageIds: input.chatMessageIds,
      completedAt: input.completedAt,
    }),
  );
}

function getCurrentUserEligibleActorIds(request: RollRequest): Set<ActorId> {
  const currentUser = game.user;
  if (currentUser == null) {
    return new Set();
  }

  return new Set(
    resolveCurrentUserRequestTargets(request, currentUser).map((target) => target.id),
  );
}

function prepareButtonForCurrentUser(
  button: HTMLButtonElement,
  flags: AskARollRequestChatFlags,
): void {
  const currentUserId = game.user?.id;
  const actorId = button.dataset.actorId;
  const rollTypeId = button.dataset.rollTypeId;
  if (currentUserId == null || actorId == null || rollTypeId == null) {
    button.disabled = true;
    return;
  }

  const allowedActorIds = getCurrentUserEligibleActorIds(flags.request);
  if (!allowedActorIds.has(asActorId(actorId))) {
    button.disabled = true;
    button.title = game.i18n!.localize("askaroll.player.error.actorPermissionDenied");
    return;
  }

  if (
    flags.request.selectionMode === "one" &&
    hasCompletedActionForUser(flags, asUserId(currentUserId))
  ) {
    button.disabled = true;
    return;
  }

  if (
    isActionCompletedForUser(
      flags,
      asActorId(actorId),
      asRollTypeId(rollTypeId),
      asUserId(currentUserId),
    )
  ) {
    button.disabled = true;
  }
}

async function performChatRoll(
  message: RenderedChatMessage,
  flags: AskARollRequestChatFlags,
  actorId: ActorId,
  rollTypeId: RollTypeId,
  event: Event,
): Promise<void> {
  const currentUserId = game.user?.id;
  if (currentUserId == null) {
    return;
  }

  const playerUserId = asUserId(currentUserId);
  const key = actionKey({
    requestId: flags.request.requestId,
    actorId,
    rollTypeId,
    playerUserId,
  });

  if (pendingChatActions.has(key) || completedChatActions.has(key)) {
    return;
  }

  if (
    flags.request.selectionMode === "one" &&
    completedChooseOneRequests.has(chooseOneKey(flags.request.requestId, playerUserId))
  ) {
    return;
  }

  if (!getCurrentUserEligibleActorIds(flags.request).has(actorId)) {
    notifyError("askaroll.player.error.actorPermissionDenied");
    return;
  }

  const adapterResult = getSystemRollAdapter(game);
  if (!adapterResult.ok) {
    notifyError("askaroll.systems.unsupportedSystem");
    return;
  }

  pendingChatActions.add(key);
  const service = new PlayerRollRequestService(
    adapterResult.value as SystemRollAdapter<Wfrp4eRollDescriptor>,
  );
  service.registerRequest(flags.request);

  try {
    const result = await service.performRequestedRoll(
      flags.request.requestId,
      actorId,
      rollTypeId,
      event,
    );

    if (!result.ok) {
      emitRollFailed({
        requestId: flags.request.requestId,
        actorId,
        rollTypeId,
        playerUserId,
        reasonKey: result.reasonKey,
      });
      notifyError(result.reasonKey);
      return;
    }

    completedChatActions.add(key);
    if (flags.request.selectionMode === "one") {
      completedChooseOneRequests.add(chooseOneKey(flags.request.requestId, playerUserId));
    }
    emitRollSubmitted({
      requestId: flags.request.requestId,
      actorId: result.result.actorId,
      rollTypeId: result.result.rollTypeId,
      playerUserId,
      chatMessageIds: result.result.chatMessageIds,
      completedAt: result.result.completedAt,
    });
    void message;
  } finally {
    pendingChatActions.delete(key);
    service.unregisterRequest(flags.request.requestId);
  }
}

function registerRenderedButton(
  message: RenderedChatMessage,
  flags: AskARollRequestChatFlags,
  button: HTMLButtonElement,
): void {
  prepareButtonForCurrentUser(button, flags);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    button.disabled = true;
    const actorId = button.dataset.actorId;
    const rollTypeId = button.dataset.rollTypeId;
    if (actorId == null || rollTypeId == null) {
      return;
    }

    void performChatRoll(
      message,
      flags,
      asActorId(actorId),
      asRollTypeId(rollTypeId),
      event,
    );
  });
}

function onRenderChatMessageHtml(
  message: unknown,
  html: unknown,
  _context: unknown,
): void {
  const flags = getRequestChatFlags(message);
  const element = getHtmlElement(html);
  if (flags == null || element == null) {
    return;
  }

  element
    .querySelectorAll<HTMLButtonElement>("[data-askaroll-request-roll='true']")
    .forEach((button) => registerRenderedButton(message as RenderedChatMessage, flags, button));
}

export class RequestChatCardService {
  async createRequestPrompt(request: RollRequest): Promise<void> {
    try {
      await createRequestChatCard(request);
    } catch {
      notifyWarn("askaroll.chat.error.requestCreateFailed");
    }
  }

  registerHooks(): void {
    Hooks.on("renderChatMessageHTML", onRenderChatMessageHtml);
  }

  async markCompletedAction(
    requestId: RequestId,
    action: CompletedRequestChatAction,
  ): Promise<void> {
    const message = getKnownMessages().find((candidate) => {
      const flags = getRequestChatFlags(candidate);
      return flags?.request.requestId === requestId;
    });
    const flags = getRequestChatFlags(message);
    if (message == null || flags == null) {
      return;
    }

    try {
      await markActionCompleted(message, flags, action);
    } catch {
      return;
    }
  }
}

export const requestChatCardService = new RequestChatCardService();
