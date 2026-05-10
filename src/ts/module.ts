/// <reference types="vite/client" />

// Do not remove this import. If you do Vite will think your styles are dead
// code and not include them in the build output.
import "../styles/style.scss";
import { registerAskARollInit } from "./lifecycle/init";
import {
  registerAskARollReady,
  registerAskARollSceneControlButton,
} from "./lifecycle/ready";

Hooks.on("getSceneControlButtons", registerAskARollSceneControlButton);
Hooks.once("init", registerAskARollInit);
Hooks.once("ready", registerAskARollReady);
