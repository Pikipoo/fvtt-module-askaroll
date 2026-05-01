import type {
  Wfrp4eCharacteristic,
  Wfrp4eRollDescriptor,
} from "../../domain/rolls";
import type {
  AdapterResult,
  RollExecutionContext,
  SystemRollAdapter,
} from "../adapter";
import { adapterFailure, adapterOk, adapterUnsupported } from "../adapter";
import { isWfrp4eActor } from "./guards";
import { wfrp4eCharacteristicRollDescriptors } from "./rolls";

type Wfrp4eCharacteristicRollDescriptor = Extract<
  Wfrp4eRollDescriptor,
  { readonly type: "characteristic" }
>;

type Wfrp4eRollContext = {
  readonly fields?: {
    readonly rollMode?: RollExecutionContext["rollMode"];
  };
};

type Wfrp4eRollTest = {
  roll(): Promise<unknown> | unknown;
};

type Wfrp4eCharacteristicRollActor = {
  setupCharacteristic(
    characteristic: Wfrp4eCharacteristic,
    context?: Wfrp4eRollContext,
  ): Promise<Wfrp4eRollTest> | Wfrp4eRollTest;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isWfrp4eRollTest = (value: unknown): value is Wfrp4eRollTest =>
  isRecord(value) && typeof value.roll === "function";

const canRollWfrp4eCharacteristic = (
  actor: unknown,
): actor is Wfrp4eCharacteristicRollActor =>
  isRecord(actor) && typeof actor.setupCharacteristic === "function";

const createWfrp4eRollContext = (
  context: RollExecutionContext | undefined,
): Wfrp4eRollContext => ({
  fields: {
    rollMode: context?.rollMode,
  },
});

const isSupportedWfrp4eRoll = (
  roll: Wfrp4eRollDescriptor,
): roll is Wfrp4eCharacteristicRollDescriptor => {
  if (roll.system !== "wfrp4e" || roll.type !== "characteristic") {
    return false;
  }

  return wfrp4eCharacteristicRollDescriptors.some(
    (descriptor) => descriptor.characteristic === roll.characteristic,
  );
};

export const wfrp4eRollAdapter: SystemRollAdapter<Wfrp4eRollDescriptor> = {
  systemId: "wfrp4e",

  isSupportedActor(actor: unknown): boolean {
    return isWfrp4eActor(actor);
  },

  getRollGroups() {
    return adapterOk([
      {
        id: "wfrp4e.characteristics",
        labelKey: "askaroll.wfrp4e.rollGroups.characteristics",
        rolls: wfrp4eCharacteristicRollDescriptors,
      },
    ]);
  },

  async executeRoll(
    actor: unknown,
    roll: Wfrp4eRollDescriptor,
    context?: RollExecutionContext,
  ): Promise<AdapterResult<unknown>> {
    if (!isWfrp4eActor(actor)) {
      return adapterUnsupported(
        "unsupportedActor",
        "askaroll.wfrp4e.rolls.unsupportedActor",
      );
    }

    if (!isSupportedWfrp4eRoll(roll)) {
      return adapterUnsupported(
        "unsupportedRoll",
        "askaroll.wfrp4e.rolls.unsupportedRoll",
      );
    }

    if (!canRollWfrp4eCharacteristic(actor)) {
      return adapterUnsupported(
        "unverifiedRollApi",
        "askaroll.wfrp4e.rolls.rollApiUnavailable",
      );
    }

    try {
      const test = await actor.setupCharacteristic(
        roll.characteristic,
        createWfrp4eRollContext(context),
      );

      if (!isWfrp4eRollTest(test)) {
        return adapterFailure("rollFailed", "askaroll.wfrp4e.rolls.rollFailed");
      }

      return adapterOk(await test.roll());
    } catch {
      return adapterFailure("rollFailed", "askaroll.wfrp4e.rolls.rollFailed");
    }
  },
};
