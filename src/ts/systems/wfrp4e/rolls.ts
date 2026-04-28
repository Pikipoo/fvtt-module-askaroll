import type { Wfrp4eRollDescriptor } from "../../domain/rolls";

export const wfrp4eCharacteristicRollDescriptors = [
  {
    system: "wfrp4e",
    type: "characteristic",
    characteristic: "ws",
    labelKey: "askaroll.wfrp4e.characteristics.ws",
  },
  {
    system: "wfrp4e",
    type: "characteristic",
    characteristic: "bs",
    labelKey: "askaroll.wfrp4e.characteristics.bs",
  },
  {
    system: "wfrp4e",
    type: "characteristic",
    characteristic: "s",
    labelKey: "askaroll.wfrp4e.characteristics.s",
  },
  {
    system: "wfrp4e",
    type: "characteristic",
    characteristic: "t",
    labelKey: "askaroll.wfrp4e.characteristics.t",
  },
  {
    system: "wfrp4e",
    type: "characteristic",
    characteristic: "i",
    labelKey: "askaroll.wfrp4e.characteristics.i",
  },
  {
    system: "wfrp4e",
    type: "characteristic",
    characteristic: "ag",
    labelKey: "askaroll.wfrp4e.characteristics.ag",
  },
  {
    system: "wfrp4e",
    type: "characteristic",
    characteristic: "dex",
    labelKey: "askaroll.wfrp4e.characteristics.dex",
  },
  {
    system: "wfrp4e",
    type: "characteristic",
    characteristic: "int",
    labelKey: "askaroll.wfrp4e.characteristics.int",
  },
  {
    system: "wfrp4e",
    type: "characteristic",
    characteristic: "wp",
    labelKey: "askaroll.wfrp4e.characteristics.wp",
  },
  {
    system: "wfrp4e",
    type: "characteristic",
    characteristic: "fel",
    labelKey: "askaroll.wfrp4e.characteristics.fel",
  },
] as const satisfies readonly Wfrp4eRollDescriptor[];
