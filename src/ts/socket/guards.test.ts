import { describe, expect, it } from "vitest";
import { isAskARollSocketMessage } from "./guards";

describe("isAskARollSocketMessage", () => {
  it("rejects foreign module messages", () => {
    expect(
      isAskARollSocketMessage({
        moduleId: "other",
        protocol: 1,
        type: "request:create",
        requestId: "r1",
        senderUserId: "u1",
        createdAt: 1,
        payload: {},
      }),
    ).toBe(false);
  });

  it("rejects unsupported protocol versions", () => {
    expect(
      isAskARollSocketMessage({
        moduleId: "askaroll",
        protocol: 2,
        type: "request:create",
        requestId: "r1",
        senderUserId: "u1",
        createdAt: 1,
        payload: {},
      }),
    ).toBe(false);
  });

  it("accepts a protocol 1 Ask A Roll envelope with an object payload", () => {
    expect(
      isAskARollSocketMessage({
        moduleId: "askaroll",
        protocol: 1,
        type: "request:cancel",
        requestId: "r1",
        senderUserId: "u1",
        createdAt: 1,
        payload: { reasonKey: "askaroll.request.cancelled" },
      }),
    ).toBe(true);
  });
});
