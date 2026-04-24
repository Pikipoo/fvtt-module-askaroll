import { moduleId } from "../constants";
import { registerAskARollSettings } from "../settings/settings";

export function registerAskARollInit(): void {
  console.log(`Initializing ${moduleId}`);
  registerAskARollSettings();
}
