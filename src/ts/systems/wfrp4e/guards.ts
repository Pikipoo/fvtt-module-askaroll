import type { Wfrp4eCharacteristic } from "../../domain/rolls";

type Wfrp4eActorSystemData = {
  readonly characteristics: Record<Wfrp4eCharacteristic, Record<string, unknown>>;
};

type Wfrp4eActor = {
  readonly system: Wfrp4eActorSystemData;
};

const WFRP4E_CHARACTERISTICS: readonly Wfrp4eCharacteristic[] = [
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
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isWfrp4eSystemId = (value: unknown): value is "wfrp4e" =>
  value === "wfrp4e";

export const isWfrp4eActorSystemData = (
  value: unknown,
): value is Wfrp4eActorSystemData => {
  if (!isRecord(value) || !isRecord(value.characteristics)) {
    return false;
  }

  const { characteristics } = value;

  return WFRP4E_CHARACTERISTICS.every((characteristic) =>
    isRecord(characteristics[characteristic]),
  );
};

export const isWfrp4eActor = (value: unknown): value is Wfrp4eActor =>
  isRecord(value) && isWfrp4eActorSystemData(value.system);
