import type { ActorId } from "../../domain/ids";
import { asActorId, asSceneId, asTokenId, asUserId } from "../../domain/ids";
import type { RecipientTargetInput } from "../../domain/recipients";
import { gmRollRequestService } from "../../services/gmRollRequestService";
import type { RollVisibility, SelectionMode } from "../../domain/requests";
import { routeSocketMessage } from "../../socket/routers";
import { createRequestCreateMessage } from "../../socket/messages";
import type { Wfrp4eRollDescriptor } from "../../domain/rolls";
import { getSystemRollAdapter } from "../../systems/registry";
import {
  askARollSettingKeys,
  askARollSettingsNamespace,
} from "../../settings/settings";
import type { GmRollRequestViewModel } from "./gmRollRequestViewModel";
import {
  buildGmRollRequestViewModel,
  rollDescriptorToId,
} from "./gmRollRequestViewModel";

const { ApplicationV2, HandlebarsApplicationMixin } =
  foundry.applications.api;

function normalizeToArray(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === "string") return [value];
  return [];
}

function buildRecipientTarget(
  mode: string,
  actorIds: readonly ActorId[],
): RecipientTargetInput {
  switch (mode) {
    case "controlledTokens": {
      const tokenIds = (canvas?.tokens?.controlled ?? [])
        .filter((token) => {
          const aid = token.actor?.id;
          return aid != null && actorIds.some((id) => id === aid);
        })
        .map((token) => asTokenId(token.id));
      const sceneId = canvas?.scene ? asSceneId(canvas.scene.id) : null;
      return { type: "controlledTokens", actorIds, tokenIds, sceneId };
    }
    case "assignedCharacters": {
      const userIds = (game.users?.contents ?? [])
        .filter((user) => {
          const charId = user.character?.id;
          return charId != null && actorIds.some((id) => id === charId);
        })
        .map((user) => asUserId(user.id));
      return { type: "assignedCharacters", userIds, actorIds };
    }
    default: {
      const userIds = (game.users?.contents ?? [])
        .filter((user) => !user.isGM)
        .map((user) => asUserId(user.id));
      return { type: "users", userIds, actorIds };
    }
  }
}

export class GmRollRequestApp extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  static override DEFAULT_OPTIONS = {
    id: "askaroll-gm-request",
    window: {
      title: "askaroll.gm.title",
      resizable: true,
    },
    position: { width: 480 },
    form: {
      handler: GmRollRequestApp._onSubmit,
      closeOnSubmit: false,
    },
    actions: {
      close: GmRollRequestApp._onClose,
    },
    tag: "form",
    classes: ["askaroll"],
  };

  static override PARTS = {
    form: {
      template: "modules/askaroll/templates/gm-roll-request.hbs",
    },
  };

  #rollDescriptorMap: Map<string, Wfrp4eRollDescriptor> = new Map();

  override async _prepareContext(
    _options: object,
  ): Promise<GmRollRequestViewModel & foundry.applications.api.ApplicationV2.RenderContext> {
    const adapterResult = getSystemRollAdapter(game);
    if (!adapterResult.ok) {
      ui.notifications?.warn(
        game.i18n!.localize("askaroll.gm.validation.noAdapter"),
      );
      return { actors: [], recipients: [], rollGroups: [] };
    }
    const adapter = adapterResult.value;

    const rollGroupsResult = adapter.getRollGroups();
    const rollGroups = rollGroupsResult.ok ? [...rollGroupsResult.value] : [];

    this.#rollDescriptorMap.clear();
    for (const group of rollGroups) {
      for (const roll of group.rolls) {
        this.#rollDescriptorMap.set(
          rollDescriptorToId(group.id, roll),
          roll as Wfrp4eRollDescriptor,
        );
      }
    }

    const actors = (game.actors?.contents ?? [])
      .filter((actor) => adapter.isSupportedActor(actor))
      .map((actor) => ({
        id: actor.id,
        name: actor.name ?? "Unknown",
        img: actor.img ?? "",
        tokenImg:
          (actor.prototypeToken?.texture?.src as string | undefined) ?? null,
      }));

    const controlledActorIds = (canvas?.tokens?.controlled ?? [])
      .map((token) => token.actor?.id)
      .filter((id): id is string => id != null);

    const users = (game.users?.contents ?? []).map((user) => ({
      id: user.id,
      name: user.name ?? "Unknown",
      isGM: user.isGM,
    }));

    const useTokenImageForActors = game.settings!.get(
      askARollSettingsNamespace,
      askARollSettingKeys.useTokenImageForActors,
    );

    return buildGmRollRequestViewModel({
      actors,
      users,
      controlledActorIds,
      useTokenImageForActors,
      rollGroups,
    });
  }

  static async _onSubmit(
    this: GmRollRequestApp,
    _event: SubmitEvent | Event,
    _form: HTMLFormElement,
    formData: foundry.applications.ux.FormDataExtended,
  ): Promise<void> {
    const data = formData.object;

    const actorIds = normalizeToArray(data.actorIds).map(asActorId);
    const rollIds = normalizeToArray(data.rollIds);

    if (actorIds.length === 0) {
      ui.notifications?.warn(
        game.i18n!.localize("askaroll.gm.validation.noActors"),
      );
      return;
    }
    if (rollIds.length === 0) {
      ui.notifications?.warn(
        game.i18n!.localize("askaroll.gm.validation.noRolls"),
      );
      return;
    }

    const rolls = rollIds
      .map((id) => this.#rollDescriptorMap.get(id))
      .filter((r): r is Wfrp4eRollDescriptor => r != null);

    const recipientMode = data.recipientMode as string;
    const recipients = buildRecipientTarget(recipientMode, actorIds);

    const request = await gmRollRequestService.createAndDispatchRequest({
      actorIds,
      rolls,
      recipients,
      visibility: data.visibility as RollVisibility,
      selectionMode: data.selectionMode as SelectionMode,
      reason: (data.reason as string) ?? "",
    });

    if (request == null) {
      return;
    }

    routeSocketMessage(createRequestCreateMessage(request));
    this.close();
  }

  static _onClose(this: GmRollRequestApp): void {
    this.close();
  }
}
