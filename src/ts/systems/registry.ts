import type { AdapterResult, SystemRollAdapter } from "./adapter";
import { adapterOk, adapterUnsupported } from "./adapter";
import { isWfrp4eSystemId } from "./wfrp4e/guards";
import { wfrp4eRollAdapter } from "./wfrp4e/adapter";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const getSystemRollAdapter = (
  foundryGame: unknown,
): AdapterResult<SystemRollAdapter> => {
  if (!isRecord(foundryGame) || !isRecord(foundryGame.system)) {
    return adapterUnsupported(
      "unsupportedSystem",
      "askaroll.systems.unsupportedSystem",
    );
  }

  if (isWfrp4eSystemId(foundryGame.system.id)) {
    return adapterOk(wfrp4eRollAdapter);
  }

  return adapterUnsupported(
    "unsupportedSystem",
    "askaroll.systems.unsupportedSystem",
  );
};
