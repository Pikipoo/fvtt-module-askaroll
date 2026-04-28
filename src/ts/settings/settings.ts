export const askARollSettingsNamespace = "askaroll" as const;

export const askARollSettingKeys = {
  useTokenImageForActors: "useTokenImageForActors",
  deselectTokensOnOpen: "deselectTokensOnOpen",
} as const;

export type AskARollSettingKey =
  (typeof askARollSettingKeys)[keyof typeof askARollSettingKeys];

declare global {
  interface SettingConfig {
    "askaroll.useTokenImageForActors": boolean;
    "askaroll.deselectTokensOnOpen": boolean;
  }
}

export function registerAskARollSettings(): void {
  const settings = getClientSettings();

  settings.register(
    askARollSettingsNamespace,
    askARollSettingKeys.useTokenImageForActors,
    {
      name: "askaroll.settings.useTokenImageForActors.name",
      hint: "askaroll.settings.useTokenImageForActors.hint",
      scope: "client",
      config: true,
      type: Boolean,
      default: true,
    }
  );

  settings.register(
    askARollSettingsNamespace,
    askARollSettingKeys.deselectTokensOnOpen,
    {
      name: "askaroll.settings.deselectTokensOnOpen.name",
      hint: "askaroll.settings.deselectTokensOnOpen.hint",
      scope: "client",
      config: true,
      type: Boolean,
      default: false,
    }
  );
}

function getClientSettings(): foundry.helpers.ClientSettings {
  if (!game.settings) {
    throw new Error(
      "Ask A Roll settings cannot be registered before game.settings exists."
    );
  }

  return game.settings;
}
