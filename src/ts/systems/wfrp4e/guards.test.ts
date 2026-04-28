import { describe, expect, it } from "vitest";

import {
  isWfrp4eActor,
  isWfrp4eActorSystemData,
  isWfrp4eSystemId,
} from "./guards";

describe("isWfrp4eSystemId", () => {
  it("accepts only the WFRP4e system id", () => {
    expect(isWfrp4eSystemId("wfrp4e")).toBe(true);
    expect(isWfrp4eSystemId("dnd5e")).toBe(false);
    expect(isWfrp4eSystemId(undefined)).toBe(false);
  });
});

describe("isWfrp4eActorSystemData", () => {
  it("accepts characteristic data with WFRP4e characteristic keys", () => {
    expect(
      isWfrp4eActorSystemData({
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
      }),
    ).toBe(true);
  });

  it("rejects missing characteristic data", () => {
    expect(isWfrp4eActorSystemData({})).toBe(false);
  });

  it("rejects characteristic keys with non-record values", () => {
    expect(
      isWfrp4eActorSystemData({
        characteristics: {
          ws: null,
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
      }),
    ).toBe(false);
  });
});

describe("isWfrp4eActor", () => {
  it("accepts actors with WFRP4e system data", () => {
    expect(
      isWfrp4eActor({
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
      }),
    ).toBe(true);
  });

  it("rejects actors without WFRP4e system data", () => {
    expect(isWfrp4eActor({ system: {} })).toBe(false);
    expect(isWfrp4eActor(null)).toBe(false);
  });
});
