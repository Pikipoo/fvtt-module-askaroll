import { describe, expect, it } from "vitest";

import { getSystemRollAdapter } from "./registry";

describe("getSystemRollAdapter", () => {
  it("returns the WFRP4e adapter for game-like values with the WFRP4e system id", () => {
    const result = getSystemRollAdapter({ system: { id: "wfrp4e" } });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected WFRP4e adapter result to be ok");
    }
    expect(result.value.systemId).toBe("wfrp4e");
  });

  it("returns unsupported for non-WFRP4e game-like values", () => {
    const result = getSystemRollAdapter({ system: { id: "dnd5e" } });

    expect(result).toEqual({
      ok: false,
      outcome: "unsupported",
      reason: "unsupportedSystem",
      messageKey: "askaroll.systems.unsupportedSystem",
    });
  });

  it("returns unsupported for values without a structural system id", () => {
    const result = getSystemRollAdapter({ system: null });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected malformed game-like value to be unsupported");
    }
    expect(result.outcome).toBe("unsupported");
    expect(result.reason).toBe("unsupportedSystem");
  });
});
