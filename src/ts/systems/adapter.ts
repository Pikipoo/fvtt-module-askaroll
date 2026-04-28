export type AdapterUnsupportedReason =
  | "unsupportedSystem"
  | "unsupportedActor"
  | "unsupportedRoll"
  | "unverifiedRollApi";

export type AdapterFailureReason = "rollFailed";

export type AdapterResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly outcome: "unsupported";
      readonly reason: AdapterUnsupportedReason;
      readonly messageKey: string;
    }
  | {
      readonly ok: false;
      readonly outcome: "failure";
      readonly reason: AdapterFailureReason;
      readonly messageKey: string;
    };

export type SystemRollDescriptor = {
  readonly system: string;
  readonly type: string;
  readonly labelKey?: string;
  readonly label?: string;
};

export type SystemRollGroup<TRoll extends SystemRollDescriptor> = {
  readonly id: string;
  readonly labelKey: string;
  readonly rolls: readonly TRoll[];
};

export type SystemRollAdapter<
  TRoll extends SystemRollDescriptor = SystemRollDescriptor,
> = {
  readonly systemId: string;
  isSupportedActor(actor: unknown): boolean;
  getRollGroups(): AdapterResult<readonly SystemRollGroup<TRoll>[]>;
  executeRoll(actor: unknown, roll: TRoll): Promise<AdapterResult<unknown>>;
};

export const adapterOk = <T>(value: T): AdapterResult<T> => ({ ok: true, value });

export const adapterUnsupported = <T>(
  reason: AdapterUnsupportedReason,
  messageKey: string,
): AdapterResult<T> => ({
  ok: false,
  outcome: "unsupported",
  reason,
  messageKey,
});
