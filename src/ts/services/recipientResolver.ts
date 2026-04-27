import type { ActorId, UserId } from "../domain/ids";
import { asActorId, asSceneId, asTokenId, asUserId } from "../domain/ids";
import type { RecipientTargetInput } from "../domain/recipients";
import type { RollRequest } from "../domain/requests";

export type ResolvedPlayerRequestTarget = {
  readonly actor: Actor;
  readonly id: ActorId;
  readonly name: string;
  readonly img: string;
};

type ActorPermissionProbe = {
  readonly testUserPermission?: (user: User, permission: string) => boolean;
  readonly isOwner?: boolean;
};

function unique<TValue>(values: readonly TValue[]): TValue[] {
  return [...new Set(values)];
}

function actorCanBeUsedByCurrentUser(actor: Actor, currentUser: User): boolean {
  if (currentUser.isGM) {
    return true;
  }

  const probe = actor as ActorPermissionProbe;
  if (typeof probe.testUserPermission === "function") {
    return probe.testUserPermission(currentUser, "OWNER");
  }

  return probe.isOwner === true;
}

function actorCanBeUsedByUser(actor: Actor, user: User): boolean {
  if (user.isGM) {
    return true;
  }

  const probe = actor as ActorPermissionProbe;
  if (typeof probe.testUserPermission === "function") {
    return probe.testUserPermission(user, "OWNER");
  }

  return false;
}

function hasCurrentUserControlledActor(actorId: ActorId): boolean {
  return (canvas?.tokens?.controlled ?? []).some(
    (token) => token.actor?.id === actorId,
  );
}

export function buildRecipientTargetForMode(
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

export function isRequestTargetingUser(
  request: RollRequest,
  userId: UserId,
): boolean {
  if (request.recipients.type === "controlledTokens") {
    return request.recipients.actorIds.some(hasCurrentUserControlledActor);
  }

  return request.recipients.userIds.some((targetUserId) => targetUserId === userId);
}

export function resolveCurrentUserRequestTargets(
  request: RollRequest,
  currentUser: User,
): readonly ResolvedPlayerRequestTarget[] {
  if (currentUser.id == null) {
    return [];
  }

  if (!isRequestTargetingUser(request, asUserId(currentUser.id))) {
    return [];
  }

  const candidateActorIds = unique(request.actorIds);
  return candidateActorIds.flatMap((actorId) => {
    const actor = game.actors?.get(actorId);
    if (actor == null || !actorCanBeUsedByCurrentUser(actor, currentUser)) {
      return [];
    }

    if (actor.id == null) {
      return [];
    }

    return [
      {
        actor,
        id: asActorId(actor.id),
        name: actor.name ?? "",
        img: actor.img ?? "",
      },
    ];
  });
}

export function filterActorsOwnedByUser(
  userId: UserId,
  actorIds: readonly ActorId[],
): readonly ActorId[] {
  const user = game.users?.get(userId);
  if (user == null) {
    return [];
  }

  return actorIds.filter((actorId) => {
    const actor = game.actors?.get(actorId);
    return actor != null && actorCanBeUsedByUser(actor, user);
  });
}
