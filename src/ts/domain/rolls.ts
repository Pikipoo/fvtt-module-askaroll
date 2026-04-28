export type Wfrp4eCharacteristic =
  | "ws"
  | "bs"
  | "s"
  | "t"
  | "i"
  | "ag"
  | "dex"
  | "int"
  | "wp"
  | "fel";

export type Wfrp4eRollDescriptor =
  | {
      readonly system: "wfrp4e";
      readonly type: "characteristic";
      readonly characteristic: Wfrp4eCharacteristic;
      readonly labelKey: string;
    }
  | {
      readonly system: "wfrp4e";
      readonly type: "skill";
      readonly skillId: string;
      readonly label: string;
    }
  | {
      readonly system: "wfrp4e";
      readonly type: "customFormula";
      readonly formula: string;
      readonly labelKey: string;
    };

export const copyWfrp4eRollDescriptor = (
  roll: Wfrp4eRollDescriptor,
): Wfrp4eRollDescriptor => {
  switch (roll.type) {
    case "characteristic":
      return {
        system: roll.system,
        type: roll.type,
        characteristic: roll.characteristic,
        labelKey: roll.labelKey,
      };
    case "skill":
      return {
        system: roll.system,
        type: roll.type,
        skillId: roll.skillId,
        label: roll.label,
      };
    case "customFormula":
      return {
        system: roll.system,
        type: roll.type,
        formula: roll.formula,
        labelKey: roll.labelKey,
      };
  }
};
