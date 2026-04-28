export function notifyInfo(key: string): void {
  ui.notifications?.info(game.i18n!.localize(key));
}

export function notifyWarn(key: string): void {
  ui.notifications?.warn(game.i18n!.localize(key));
}

export function notifyError(key: string): void {
  ui.notifications?.error(game.i18n!.localize(key));
}
