import type { ActorId, RequestId, RollTypeId } from "../../domain/ids";
import { asActorId, asRollTypeId, asUserId } from "../../domain/ids";
import type { RollRequest } from "../../domain/requests";
import type { Wfrp4eRollDescriptor } from "../../domain/rolls";
import type { PlayerRollRequestService } from "../../services/playerRollRequestService";
import { askARollSocketChannel } from "../../socket/channel";
import {
  createRollFailedMessage,
  createRollSubmittedMessage,
} from "../../socket/messages";
import {
  buildPlayerRollPromptViewModel,
  rollDescriptorToRollTypeId,
  shouldClosePrompt,
  type PlayerRollPromptOwnedActor,
  type PlayerRollPromptViewModel,
} from "./playerRollPromptViewModel";

const { ApplicationV2, HandlebarsApplicationMixin } =
  foundry.applications.api;

function requestScopedPromptId(requestId: RequestId): string {
  const safeRequestId = requestId.replaceAll(/[^A-Za-z0-9_-]/g, "-");

  return `ask-a-roll-player-prompt-${safeRequestId}`;
}

export type PlayerRollPromptAppOwnedActor = {
  readonly id: ActorId;
  readonly name: string;
  readonly img: string;
};

type PlayerRollPromptCloseCallback = (requestId: RequestId) => void;

export class PlayerRollPromptApp extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  static override DEFAULT_OPTIONS = {
    id: "ask-a-roll-player-prompt",
    window: {
      title: "askaroll.player.title",
      resizable: true,
    },
    position: { width: 420 },
    actions: {
      roll: PlayerRollPromptApp.rollAction,
    },
    classes: ["askaroll", "ask-a-roll-player-prompt"],
  };

  static override PARTS = {
    prompt: {
      template: "modules/askaroll/templates/player-roll-prompt.hbs",
    },
  };

  readonly #request: RollRequest;
  readonly #ownedActors: readonly PlayerRollPromptAppOwnedActor[];
  readonly #service: PlayerRollRequestService;
  readonly #onClose: PlayerRollPromptCloseCallback | null;
  readonly #completedRollActions = new Set<string>();
  readonly #pendingRollActions = new Set<string>();

  constructor(
    request: RollRequest,
    ownedActors: readonly PlayerRollPromptAppOwnedActor[],
    service: PlayerRollRequestService,
    onClose: PlayerRollPromptCloseCallback | null = null,
  ) {
    super({ id: requestScopedPromptId(request.requestId) });
    this.#request = request;
    this.#ownedActors = ownedActors;
    this.#service = service;
    this.#onClose = onClose;
    this.#service.registerRequest(request);
  }

  override async _prepareContext(
    _options: object,
  ): Promise<PlayerRollPromptViewModel & foundry.applications.api.ApplicationV2.RenderContext> {
    const viewModel = buildPlayerRollPromptViewModel(
      this.#request,
      this.#ownedActors.map((actor) => this.#buildOwnedActorContext(actor)),
    );

    return this.#localizeViewModelLabels(viewModel);
  }

  override async close(
    options?: Parameters<foundry.applications.api.ApplicationV2["close"]>[0],
  ): Promise<this> {
    try {
      return await super.close(options);
    } finally {
      this.#service.unregisterRequest(this.#request.requestId);
      this.#onClose?.(this.#request.requestId);
    }
  }

  static async rollAction(
    this: PlayerRollPromptApp,
    event: PointerEvent,
    target: HTMLElement,
  ): Promise<void> {
    const rollButton = target.closest<HTMLButtonElement>("[data-action='roll']");
    const actorId = rollButton?.dataset.actorId;
    const rollTypeId = rollButton?.dataset.rollTypeId;

    if (actorId == null || rollTypeId == null) {
      return;
    }

    await this.#performRoll(asActorId(actorId), asRollTypeId(rollTypeId), event);
  }

  async #performRoll(
    actorId: ActorId,
    rollTypeId: RollTypeId,
    event: Event | null,
  ): Promise<void> {
    if (this.#isCompleted(actorId, rollTypeId) || this.#isPending(actorId, rollTypeId)) {
      return;
    }

    const roll = this.#findRoll(rollTypeId);

    if (roll == null) {
      this.#emitRollFailed(
        actorId,
        rollTypeId,
        "askaroll.player.error.rollFailed",
      );
      ui.notifications?.error(
        game.i18n!.localize("askaroll.player.error.rollFailed"),
      );
      return;
    }

    this.#markPending(actorId, rollTypeId);

    const result = await this.#performPendingRoll(actorId, rollTypeId, event);

    if (!result.ok) {
      this.#emitRollFailed(actorId, rollTypeId, result.reasonKey);
      ui.notifications?.error(game.i18n!.localize(result.reasonKey));
      return;
    }

    this.#emitRollSubmitted(result.result);
    this.#markCompleted(actorId, rollTypeId);

    const viewModel = buildPlayerRollPromptViewModel(
      this.#request,
      this.#ownedActors.map((actor) => this.#buildOwnedActorContext(actor)),
    );

    if (shouldClosePrompt(viewModel)) {
      await this.close();
      return;
    }

    await this.render({ force: true });
  }

  #buildOwnedActorContext(
    actor: PlayerRollPromptAppOwnedActor,
  ): PlayerRollPromptOwnedActor {
    const completedRollTypeIds = this.#request.rolls
      .map(rollDescriptorToRollTypeId)
      .filter((rollTypeId) => this.#isCompleted(actor.id, rollTypeId));

    return {
      id: actor.id,
      name: actor.name,
      img: actor.img,
      completedRollTypeIds,
    };
  }

  #findRoll(rollTypeId: RollTypeId): Wfrp4eRollDescriptor | null {
    return (
      this.#request.rolls.find(
        (roll) => rollDescriptorToRollTypeId(roll) === rollTypeId,
      ) ?? null
    );
  }

  #isCompleted(actorId: ActorId, rollTypeId: RollTypeId): boolean {
    return this.#completedRollActions.has(this.#completionKey(actorId, rollTypeId));
  }

  #isPending(actorId: ActorId, rollTypeId: RollTypeId): boolean {
    return this.#pendingRollActions.has(this.#completionKey(actorId, rollTypeId));
  }

  #markCompleted(actorId: ActorId, rollTypeId: RollTypeId): void {
    this.#completedRollActions.add(this.#completionKey(actorId, rollTypeId));
  }

  #markPending(actorId: ActorId, rollTypeId: RollTypeId): void {
    this.#pendingRollActions.add(this.#completionKey(actorId, rollTypeId));
  }

  #clearPending(actorId: ActorId, rollTypeId: RollTypeId): void {
    this.#pendingRollActions.delete(this.#completionKey(actorId, rollTypeId));
  }

  async #performPendingRoll(
    actorId: ActorId,
    rollTypeId: RollTypeId,
    event: Event | null,
  ): ReturnType<PlayerRollRequestService["performRequestedRoll"]> {
    try {
      return await this.#service.performRequestedRoll(
        this.#request.requestId,
        actorId,
        rollTypeId,
        event,
      );
    } finally {
      this.#clearPending(actorId, rollTypeId);
    }
  }

  #emitRollSubmitted(result: {
    readonly actorId: ActorId;
    readonly rollTypeId: RollTypeId;
    readonly chatMessageIds: readonly string[];
    readonly completedAt: number;
  }): void {
    const currentUserId = game.user?.id;
    if (currentUserId == null) {
      return;
    }

    game.socket?.emit(
      askARollSocketChannel,
      createRollSubmittedMessage({
        requestId: this.#request.requestId,
        senderUserId: asUserId(currentUserId),
        actorId: result.actorId,
        rollTypeId: result.rollTypeId,
        playerUserId: asUserId(currentUserId),
        chatMessageIds: result.chatMessageIds,
        completedAt: result.completedAt,
      }),
    );
  }

  #emitRollFailed(
    actorId: ActorId,
    rollTypeId: RollTypeId,
    reasonKey: string,
  ): void {
    const currentUserId = game.user?.id;
    if (currentUserId == null) {
      return;
    }

    game.socket?.emit(
      askARollSocketChannel,
      createRollFailedMessage({
        requestId: this.#request.requestId,
        senderUserId: asUserId(currentUserId),
        actorId,
        rollTypeId,
        playerUserId: asUserId(currentUserId),
        reasonKey,
        failedAt: Date.now(),
      }),
    );
  }

  #completionKey(actorId: ActorId, rollTypeId: RollTypeId): string {
    return `${actorId}:${rollTypeId}`;
  }

  #localizeViewModelLabels(
    viewModel: PlayerRollPromptViewModel,
  ): PlayerRollPromptViewModel {
    return {
      ...viewModel,
      visibilityLabel: game.i18n!.localize(viewModel.visibilityLabel),
      actors: viewModel.actors.map((actor) => ({
        ...actor,
        rolls: actor.rolls.map((roll) => ({
          ...roll,
          label: game.i18n!.localize(roll.label),
        })),
      })),
    };
  }

  get requestId(): RequestId {
    return this.#request.requestId;
  }
}
