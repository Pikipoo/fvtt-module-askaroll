import { describe, expect, it } from "vitest";

import { shouldClosePrompt } from "./playerRollPromptViewModel";

describe("shouldClosePrompt", () => {
  it("closes after one completed roll in one-selection mode", () => {
    expect(
      shouldClosePrompt({
        selectionMode: "one",
        totalActions: 3,
        completedActions: 1,
      }),
    ).toBe(true);
  });

  it("keeps open until every action is completed in all-selection mode", () => {
    expect(
      shouldClosePrompt({
        selectionMode: "all",
        totalActions: 3,
        completedActions: 2,
      }),
    ).toBe(false);
    expect(
      shouldClosePrompt({
        selectionMode: "all",
        totalActions: 3,
        completedActions: 3,
      }),
    ).toBe(true);
  });
});
