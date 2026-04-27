import type { ActorId, RollTypeId } from "../../domain/ids";
import { asActorId, asRollTypeId } from "../../domain/ids";
import type { RollRequest } from "../../domain/requests";
import type { PlayerRollRequestService } from "../../services/playerRollRequestService";
import {
  buildPlayerRollPromptViewModel,
  rollDescriptorToRollTypeId,
  shouldClosePrompt,
  type PlayerRollPromptOwnedActor,
  type PlayerRollPromptViewModel,
} from "./playerRollPromptViewModel";

const { ApplicationV2, HandlebarsApplicationMixin } =
  foundry.applications.api;

export type PlayerRollPromptAppOwnedActor = {
  readonly id: ActorId;
  readonly name: string;
  readonly img: string;
};

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
  readonly #completedRollActions = new Set<string>();

  constructor(
    request: RollRequest,
    ownedActors: readonly PlayerRollPromptAppOwnedActor[],
    service: PlayerRollRequestService,
  ) {
    super();
    this.#request = request;
    this.#ownedActors = ownedActors;
    this.#service = service;
    this.#service.trackRequest(request);
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
    if (this.#isCompleted(actorId, rollTypeId)) {
      return;
    }

    const result = await this.#service.performRequestedRoll(
      this.#request.requestId,
      actorId,
      rollTypeId,
      event,
    );

    if (!result.ok) {
      ui.notifications?.error(game.i18n!.localize(result.reasonKey));
      return;
    }

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

  #isCompleted(actorId: ActorId, rollTypeId: RollTypeId): boolean {
    return this.#completedRollActions.has(this.#completionKey(actorId, rollTypeId));
  }

  #markCompleted(actorId: ActorId, rollTypeId: RollTypeId): void {
    this.#completedRollActions.add(this.#completionKey(actorId, rollTypeId));
  }

  #completionKey(actorId: ActorId, rollTypeId: RollTypeId): string {
    return `${actorId}:${rollTypeId}`;
  }

  #localizeViewModelLabels(
    viewModel: PlayerRollPromptViewModel,
  ): PlayerRollPromptViewModel {
    return {
      ...viewModel,
      actors: viewModel.actors.map((actor) => ({
        ...actor,
        rolls: actor.rolls.map((roll) => ({
          ...roll,
          label: game.i18n!.localize(roll.label),
        })),
      })),
    };
  }
}
