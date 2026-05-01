import { describe, expect, it, vi } from "vitest";

import type { Wfrp4eRollDescriptor } from "../../domain/rolls";
import { wfrp4eRollAdapter } from "./adapter";
import { wfrp4eCharacteristicRollDescriptors } from "./rolls";

const wfrp4eActor = {
  system: {
    characteristics: {
      ws: {},
      bs: {},
      s: {},
      t: {},
      i: {},
      ag: {},
      dex: {},
      int: {},
      wp: {},
      fel: {},
    },
  },
  setupCharacteristic: async () => ({
    roll: async () => ({ success: true }),
  }),
};

describe("wfrp4eRollAdapter", () => {
  it("reports actor support using the WFRP4e actor guard", () => {
    expect(wfrp4eRollAdapter.isSupportedActor(wfrp4eActor)).toBe(true);
    expect(wfrp4eRollAdapter.isSupportedActor({ system: {} })).toBe(false);
  });

  it("returns WFRP4e characteristic roll groups", () => {
    const result = wfrp4eRollAdapter.getRollGroups();

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected roll groups to be available");
    }
    expect(result.value).toEqual([
      {
        id: "wfrp4e.characteristics",
        labelKey: "askaroll.wfrp4e.rollGroups.characteristics",
        rolls: wfrp4eCharacteristicRollDescriptors,
      },
    ]);
  });

  it("executes WFRP4e characteristic rolls through the actor API", async () => {
    const roll = vi.fn(async () => ({ success: true }));
    const setupCharacteristic = vi.fn(async () => ({ roll }));
    const actor = {
      ...wfrp4eActor,
      setupCharacteristic,
    };

    const result = await wfrp4eRollAdapter.executeRoll(
      actor,
      wfrp4eCharacteristicRollDescriptors[0],
      { rollMode: "gmroll" },
    );

    expect(setupCharacteristic).toHaveBeenCalledWith("ws", {
      fields: { rollMode: "gmroll" },
    });
    expect(roll).toHaveBeenCalledWith();
    expect(result).toEqual({ ok: true, value: { success: true } });
  });

  it("returns a localized API error when actor roll methods are unavailable", async () => {
    const result = await wfrp4eRollAdapter.executeRoll(
      { system: wfrp4eActor.system },
      wfrp4eCharacteristicRollDescriptors[0],
    );

    expect(result).toEqual({
      ok: false,
      outcome: "unsupported",
      reason: "unverifiedRollApi",
      messageKey: "askaroll.wfrp4e.rolls.rollApiUnavailable",
    });
  });

  it("returns typed unsupported results for unsupported actors", async () => {
    const result = await wfrp4eRollAdapter.executeRoll(
      { system: {} },
      wfrp4eCharacteristicRollDescriptors[0],
    );

    expect(result).toEqual({
      ok: false,
      outcome: "unsupported",
      reason: "unsupportedActor",
      messageKey: "askaroll.wfrp4e.rolls.unsupportedActor",
    });
  });

  it("returns typed unsupported results for unsupported roll types", async () => {
    const skillRoll = {
      system: "wfrp4e",
      type: "skill",
      skillId: "perception",
      label: "Perception",
    } satisfies Wfrp4eRollDescriptor;

    const result = await wfrp4eRollAdapter.executeRoll(wfrp4eActor, skillRoll);

    expect(result).toEqual({
      ok: false,
      outcome: "unsupported",
      reason: "unsupportedRoll",
      messageKey: "askaroll.wfrp4e.rolls.unsupportedRoll",
    });
  });

  it("returns typed unsupported results for custom formula rolls", async () => {
    const customFormulaRoll = {
      system: "wfrp4e",
      type: "customFormula",
      formula: "1d100",
      labelKey: "some.key",
    } satisfies Wfrp4eRollDescriptor;

    const result = await wfrp4eRollAdapter.executeRoll(
      wfrp4eActor,
      customFormulaRoll,
    );

    expect(result).toEqual({
      ok: false,
      outcome: "unsupported",
      reason: "unsupportedRoll",
      messageKey: "askaroll.wfrp4e.rolls.unsupportedRoll",
    });
  });

  it("returns typed unsupported results for non-WFRP4e roll descriptors", async () => {
    const roll = {
      system: "other-system",
      type: "characteristic",
      characteristic: "ws",
      labelKey: "some.key",
    } as unknown as Wfrp4eRollDescriptor;

    const result = await wfrp4eRollAdapter.executeRoll(wfrp4eActor, roll);

    expect(result).toEqual({
      ok: false,
      outcome: "unsupported",
      reason: "unsupportedRoll",
      messageKey: "askaroll.wfrp4e.rolls.unsupportedRoll",
    });
  });
});
