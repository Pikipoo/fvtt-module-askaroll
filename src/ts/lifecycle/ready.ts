import { GmRollRequestApp } from "../ui/gm/GmRollRequestApp";

const requestRollToolName = "askaroll-request-roll";
let gmRequestApp: GmRollRequestApp | null = null;

type SceneControlButtons = Record<
  string,
  foundry.applications.ui.SceneControls.Control
>;

export function registerAskARollReady(): void {
  Hooks.on("getSceneControlButtons", registerAskARollSceneControlButton);
}

function registerAskARollSceneControlButton(
  controls: SceneControlButtons
): void {
  if (!game.user?.isGM) {
    return;
  }

  const tokenControls = controls.tokens;
  if (!tokenControls) {
    return;
  }

  tokenControls.tools[requestRollToolName] = {
    name: requestRollToolName,
    title: "askaroll.controls.requestRoll.name",
    icon: "fa-solid fa-dice-d20",
    order: Object.keys(tokenControls.tools).length,
    button: true,
    visible: true,
    onChange: () => {
      if (!gmRequestApp) {
        gmRequestApp = new GmRollRequestApp();
      }
      gmRequestApp.render(true);
    },
  };
}
