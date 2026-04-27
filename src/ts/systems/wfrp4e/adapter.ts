import type { Wfrp4eRollDescriptor } from "../../domain/rolls";
import type { AdapterResult, SystemRollAdapter } from "../adapter";
import { adapterOk, adapterUnsupported } from "../adapter";
import { isWfrp4eActor } from "./guards";
import { wfrp4eCharacteristicRollDescriptors } from "./rolls";

const isSupportedWfrp4eRoll = (roll: Wfrp4eRollDescriptor): boolean => {
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

    return adapterUnsupported(
      "unverifiedRollApi",
      "askaroll.wfrp4e.rolls.unverifiedRollApi",
    );
  },
};
