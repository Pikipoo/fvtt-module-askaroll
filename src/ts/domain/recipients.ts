import type { ActorId, SceneId, TokenId, UserId } from "./ids";

export type RecipientTarget =
  | {
      readonly type: "controlledTokens";
      readonly actorIds: readonly ActorId[];
      readonly tokenIds: readonly TokenId[];
      readonly sceneId: SceneId | null;
    }
  | {
      readonly type: "assignedCharacters";
      readonly userIds: readonly UserId[];
      readonly actorIds: readonly ActorId[];
    }
  | {
      readonly type: "users";
      readonly userIds: readonly UserId[];
      readonly actorIds: readonly ActorId[];
    };

export type RecipientTargetInput =
  | {
      type: "controlledTokens";
      actorIds: readonly ActorId[];
      tokenIds: readonly TokenId[];
      sceneId: SceneId | null;
    }
  | {
      type: "assignedCharacters";
      userIds: readonly UserId[];
      actorIds: readonly ActorId[];
    }
  | { type: "users"; userIds: readonly UserId[]; actorIds: readonly ActorId[] };

export const copyRecipientTarget = (
  recipients: RecipientTargetInput,
): RecipientTarget => {
  switch (recipients.type) {
    case "controlledTokens":
      return {
        type: recipients.type,
        actorIds: [...recipients.actorIds],
        tokenIds: [...recipients.tokenIds],
        sceneId: recipients.sceneId,
      };
    case "assignedCharacters":
      return {
        type: recipients.type,
        userIds: [...recipients.userIds],
        actorIds: [...recipients.actorIds],
      };
    case "users":
      return {
        type: recipients.type,
        userIds: [...recipients.userIds],
        actorIds: [...recipients.actorIds],
      };
  }
};
