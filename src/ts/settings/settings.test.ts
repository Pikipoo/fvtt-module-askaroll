import { describe, expect, it } from "vitest";

import { askARollSettingKeys } from "./settings";

describe("askARollSettingKeys", () => {
  it("exposes the Phase 2 Foundry setting keys", () => {
    expect(askARollSettingKeys).toEqual({
      useTokenImageForActors: "useTokenImageForActors",
      deselectTokensOnOpen: "deselectTokensOnOpen",
    });
  });
});
