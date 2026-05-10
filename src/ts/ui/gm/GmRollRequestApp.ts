import type { ActorId, UserId } from "../../domain/ids";
import { asActorId, asUserId } from "../../domain/ids";
import type { RecipientTargetInput } from "../../domain/recipients";
import { gmRollRequestService } from "../../services/gmRollRequestService";
import { notifyWarn } from "../../services/notifications";
import type { RollVisibility, SelectionMode } from "../../domain/requests";
import type { Wfrp4eRollDescriptor } from "../../domain/rolls";
import { getSystemRollAdapter } from "../../systems/registry";
import { buildRecipientTargetForMode } from "../../services/recipientResolver";
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
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string") return [value];
  return [];
}

const recipientModes = new Set(["controlledTokens", "assignedCharacters", "users"]);
const rollVisibilities = new Set<RollVisibility>([
  "publicroll",
  "gmroll",
  "blindroll",
  "selfroll",
]);
const selectionModes = new Set<SelectionMode>(["all", "one"]);

function isRecipientMode(value: unknown): value is "controlledTokens" | "assignedCharacters" | "users" {
  return typeof value === "string" && recipientModes.has(value);
}

function isRollVisibility(value: unknown): value is RollVisibility {
  return typeof value === "string" && rollVisibilities.has(value as RollVisibility);
}

function isSelectionMode(value: unknown): value is SelectionMode {
  return typeof value === "string" && selectionModes.has(value as SelectionMode);
}

function normalizeSelectedUserIds(value: unknown): readonly UserId[] {
  const selectedIds = new Set(normalizeToArray(value));
  return (game.users?.contents ?? [])
    .filter((user) => !user.isGM && selectedIds.has(user.id))
    .map((user) => asUserId(user.id));
}

function buildRecipientTarget(
  mode: "controlledTokens" | "assignedCharacters" | "users",
  actorIds: readonly ActorId[],
  selectedUserIds: readonly UserId[],
): RecipientTargetInput {
  if (mode === "users") {
    return { type: "users", userIds: selectedUserIds, actorIds };
  }

  return buildRecipientTargetForMode(mode, actorIds);
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
      notifyWarn("askaroll.gm.validation.noAdapter");
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
        name: actor.name ?? game.i18n!.localize("askaroll.common.unknown"),
        img: actor.img ?? "",
        tokenImg:
          (actor.prototypeToken?.texture?.src as string | undefined) ?? null,
      }));

    const controlledActorIds = (canvas?.tokens?.controlled ?? [])
      .map((token) => token.actor?.id)
      .filter((id): id is string => id != null);

    const users = (game.users?.contents ?? []).map((user) => ({
      id: user.id,
      name: user.name ?? game.i18n!.localize("askaroll.common.unknown"),
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
      notifyWarn("askaroll.gm.validation.noActors");
      return;
    }
    if (rollIds.length === 0) {
      notifyWarn("askaroll.gm.validation.noRolls");
      return;
    }

    const rolls = rollIds
      .map((id) => this.#rollDescriptorMap.get(id))
      .filter((r): r is Wfrp4eRollDescriptor => r != null);

    const recipientMode = isRecipientMode(data.recipientMode)
      ? data.recipientMode
      : "controlledTokens";
    const selectedUserIds = normalizeSelectedUserIds(data.userIds);
    const recipients = buildRecipientTarget(recipientMode, actorIds, selectedUserIds);
    const visibility = isRollVisibility(data.visibility)
      ? data.visibility
      : "publicroll";
    const selectionMode = isSelectionMode(data.selectionMode)
      ? data.selectionMode
      : "all";
    const reason = typeof data.reason === "string" ? data.reason : "";

    const request = await gmRollRequestService.createAndDispatchRequest({
      actorIds,
      rolls,
      recipients,
      visibility,
      selectionMode,
      reason,
    });

    if (request == null) {
      return;
    }

    this.close();
  }

  static _onClose(this: GmRollRequestApp): void {
    this.close();
  }
}
