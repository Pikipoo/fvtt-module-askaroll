/// <reference types="vite/client" />

// Do not remove this import. If you do Vite will think your styles are dead
// code and not include them in the build output.
import "../styles/style.scss";
import DogBrowser from "./apps/dogBrowser";
import { moduleId } from "./constants";
import { askaroll } from "./types";

let module: askaroll;

Hooks.once("init", () => {
  console.log(`Initializing ${moduleId}`);

  module = (game as Game).modules.get(moduleId) as askaroll;
  module.dogBrowser = new DogBrowser();
});

Hooks.on("renderActorDirectory", (_application, element) => {
  const button = document.createElement("button");
  button.className = "cc-sidebar-button";
  button.type = "button";
  button.textContent = "🐶";
  button.addEventListener("click", () => {
    module.dogBrowser.render(true);
  });
  element
    .querySelector(".directory-header .action-buttons")
    ?.append(button);
});
