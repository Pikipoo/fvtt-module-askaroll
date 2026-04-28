export type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

export type RequestId = Brand<string, "RequestId">;
export type UserId = Brand<string, "UserId">;
export type ActorId = Brand<string, "ActorId">;
export type TokenId = Brand<string, "TokenId">;
export type SceneId = Brand<string, "SceneId">;
export type RollTypeId = Brand<string, "RollTypeId">;

export const asRequestId = (value: string): RequestId => value as RequestId;

export const asUserId = (value: string): UserId => value as UserId;

export const asActorId = (value: string): ActorId => value as ActorId;

export const asTokenId = (value: string): TokenId => value as TokenId;

export const asSceneId = (value: string): SceneId => value as SceneId;

export const asRollTypeId = (value: string): RollTypeId => value as RollTypeId;
