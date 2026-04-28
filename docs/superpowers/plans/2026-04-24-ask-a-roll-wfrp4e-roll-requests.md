# Ask A Roll WFRP4e Roll Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first Ask A Roll roll-request lifecycle for WFRP4e: a GM requests rolls, selected players receive prompts, players execute WFRP4e rolls, and results are tracked through typed socket/chat integration.

**Architecture:** Use a typed request-centered core with Foundry integration at the edges. Keep GM-authoritative request creation separate from player prompt and roll execution, isolate WFRP4e behavior behind a system adapter, and use a versioned `module.askaroll` socket protocol guarded from `unknown` input.

**Tech Stack:** Foundry VTT v13, WFRP4e, TypeScript strict mode, Vite library build, Handlebars templates, SCSS, `fvtt-types`, optional Vitest for pure TypeScript tests.

---

# Executive Summary

LMRTFY is a Foundry v10 JavaScript module that lets GMs request rolls from players through a scene-control button, a GM request form, socket-delivered player prompts, actor roll execution, and chat-native results. Its useful product behavior is the GM-to-player request workflow, recipient targeting, roll-mode selection, localized templates, and chat integration.

Ask A Roll should implement the same core lifecycle first for WFRP4e, not LMRTFY's architecture. The first release should support WFRP4e characteristic tests, skill tests, and a constrained custom formula request if WFRP4e roll data works reliably during implementation verification. Item-based rolls, roll tables, macro generation, fail buttons, multi-system support, and legacy LMRTFY macro compatibility are out of scope for this plan.

# Sources Inspected

Ask A Roll files inspected:

- `package.json`: scripts are `yarn build`, `yarn watch`, and `yarn clean`; no test or lint script exists.
- `tsconfig.json`: strict TypeScript, `fvtt-types`, `noEmit`, `noUnusedLocals`, `noImplicitAny`, and `skipLibCheck`.
- `vite.config.ts`: builds `src/ts/module.ts`, writes JS to `dist/scripts/module.js`, copies `src/languages` and `src/templates`, and generates `dist/module.json` from `src/module.json`.
- `src/module.json`: module id `askaroll`, Foundry v13 only, WFRP4e system relationship, `languages/en.json`, `style.css`, and `scripts/module.js`.
- `src/ts/module.ts`: current entrypoint imports `../styles/style.scss`, creates `DogBrowser` on `init`, and injects a hardcoded dog button into `renderActorDirectory`.
- `src/ts/constants.ts`: exports `moduleId` from `src/module.json`.
- `src/ts/types.ts`: current lowercase `askaroll` module interface with `dogBrowser`.
- `src/ts/apps/dogBrowser.ts`: demo AppV1 `Application` with external dog API behavior.
- `src/templates/dogs.hbs`: demo dog browser template.
- `src/languages/en.json`: demo dog browser localization keys.
- `src/styles/style.scss`: demo dog browser styles; the style import in `src/ts/module.ts` must remain.

LMRTFY files inspected:

- `.market_research/fvtt-module-lmrtfy/module.json`: v10 global script module, many supported systems, `socket: true`, templates, styles, languages.
- `.market_research/fvtt-module-lmrtfy/README.md`: product description and stale supported-system list.
- `.market_research/fvtt-module-lmrtfy/AGENTS.md`: confirms legacy runtime wiring and gotchas.
- `.market_research/fvtt-module-lmrtfy/src/lmrtfy.js`: `LMRTFY.init`, `LMRTFY.ready`, `LMRTFY.onMessage`, `LMRTFY.getSceneControlButtons`, `LMRTFY.hideBlind`, `LMRTFY.fromUuid`.
- `.market_research/fvtt-module-lmrtfy/src/requestor.js`: `LMRTFYRequestor`, `_getUserActorIds`, `_onUserChange`, `_updateObject`, macro creation, socket emission.
- `.market_research/fvtt-module-lmrtfy/src/roller.js`: `LMRTFYRoller`, `_makeRoll`, `_makeDiceRoll`, `_drawTable`, `_tagMessage`, button handlers.
- `.market_research/fvtt-module-lmrtfy/templates/request-rolls.html`: generic GM form.
- `.market_research/fvtt-module-lmrtfy/templates/roller.html`: player prompt.
- `.market_research/fvtt-module-lmrtfy/templates/demonlord-request-rolls.html`: Demon Lord-specific GM form.
- `.market_research/fvtt-module-lmrtfy/templates/degenesis-request-rolls.html`: Degenesis-specific GM form.
- `.market_research/fvtt-module-lmrtfy/lang/en.json`: localization keys.
- `.market_research/fvtt-module-lmrtfy/css/lmrtfy.css`: requestor and roller layout, avatar selection, dice tray, parchment theme.
- `.market_research/fvtt-module-lmrtfy/.serena/memories/project_overview.md`: summary of legacy module wiring.
- `.market_research/fvtt-module-lmrtfy/.serena/memories/task_completion.md`: manual verification notes for the legacy reference.

Foundry v13 documentation inspected:

- `https://foundryvtt.com/api/v13/classes/foundry.applications.api.ApplicationV2.html`
- `https://foundryvtt.com/api/v13/functions/foundry.applications.api.HandlebarsApplicationMixin.html`
- `https://foundryvtt.com/api/v13/classes/foundry.helpers.Hooks.html`
- `https://foundryvtt.com/api/v13/classes/foundry.helpers.ClientSettings.html`
- `https://foundryvtt.com/api/v13/classes/foundry.Game.html`
- `https://foundryvtt.com/api/v13/classes/foundry.applications.ui.SceneControls.html`
- `https://foundryvtt.com/api/v13/functions/hookEvents.getSceneControlButtons.html`
- `https://foundryvtt.com/api/v13/classes/foundry.documents.ChatMessage.html`

# LMRTFY Feature Inventory

| Feature | User | Behavior | Relevant files/symbols | Keep / Adapt / Defer |
| --- | --- | --- | --- | --- |
| Scene control button | GM | Adds a token scene-control tool titled `Request Roll`, visible only to GMs, which opens the requestor app. | `src/lmrtfy.js:398-411`, `LMRTFY.getSceneControlButtons` | Adapt: use v13 `getSceneControlButtons` hook with typed control config. |
| GM request form | GM | Opens one requestor window with recipient mode, actor avatars, roll mode, title, message, choose-one, roll type selections, custom formula, and save-as-macro. | `src/requestor.js:26-54`, `templates/request-rolls.html` | Adapt: use ApplicationV2 and typed form state; defer macro generation. |
| Recipient mode selection | GM | Supports controlled tokens, assigned characters, specific users, and selected tokens for generated macros. | `src/requestor.js:153-180`, `templates/request-rolls.html:4-34` | Adapt: support controlled tokens, assigned characters, and specific users; defer macro-only selected mode. |
| Actor avatar selection | GM | Shows actor portraits or token images and checks controlled-token actors by default. | `templates/request-rolls.html:20-34`, `src/lmrtfy.js:45-60` | Keep: actor-aware targeting; adapt settings and helpers. |
| Roll mode selection | GM | Uses `CONFIG.Dice.rollModes` and sends the selected mode to players. | `src/requestor.js:85-96`, `templates/request-rolls.html:48-52` | Keep: expose Foundry roll modes and pass through request. |
| Request title and reason | GM and player | GM sets window title and message; player sees reason. | `src/requestor.js:339-385`, `templates/roller.html:13-17` | Keep: localize labels and preserve reason in request/result flags. |
| Choose-one behavior | GM and player | Player prompt closes after a single button if enabled. | `src/roller.js:14`, `src/roller.js:212-216`, `templates/roller.html:19-23` | Keep: request option `selectionMode: "one" | "all"`. |
| Ability/check/save/skill selectors | GM and player | Generic D&D-style categories configured per system in a large switch. | `src/lmrtfy.js:75-284`, `templates/request-rolls.html:259-300`, `templates/roller.html:27-47` | Adapt: replace with WFRP4e-native characteristic and skill descriptors. |
| Custom formula | GM and player | GM enters a formula; player rolls it against actor roll data and sends chat messages. | `src/requestor.js:337-390`, `src/roller.js:454-497` | Adapt cautiously: support only typed formula strings after WFRP4e roll data verification. |
| Roll tables | GM and player | GM requests one or more roll table draws; player draws per actor and creates chat messages. | `src/roller.js:499-565`, `templates/request-rolls.html:304-316` | Defer: not part of WFRP4e first release. |
| Fail buttons | GM and player | Adds disabled fail buttons that inject `parts: [-100]` when enabled. | `src/roller.js:40-77`, `src/roller.js:202-249` | Defer: D&D-oriented behavior with no WFRP4e first-release need. |
| Advantage/query modes | GM and player | Sends advantage/disadvantage/query and maps to system-specific events/options. | `src/lmrtfy.js:85-91`, `src/roller.js:252-274` | Defer generic advantage; for WFRP4e use a typed modifier model after API verification. |
| Socket delivery | All clients | Broadcasts `module.lmrtfy`; each client filters by target user/actors. | `src/lmrtfy.js:72-74`, `src/lmrtfy.js:354-379`, `src/requestor.js:436-438` | Adapt: use `module.askaroll` with typed envelopes and sender validation. |
| Local GM self-handling | GM | After socket emit, GM also calls `LMRTFY.onMessage` locally. | `src/requestor.js:436-438` | Adapt: explicitly route local GM requests through the same service path when the GM is a target. |
| Player prompt | Player | Renders actor avatars, reason, notes, and roll buttons; disables buttons after use. | `src/roller.js:128-210`, `templates/roller.html` | Keep behavior; adapt to ApplicationV2 and view models. |
| System-specific roll execution | Player | UI class calls system actor methods and system-specific branches in `_makeRoll`. | `src/roller.js:276-377` | Adapt: move WFRP4e execution into a system adapter. |
| Chat message flags | Player and GM | Adds `flags.lmrtfy` with message/data/blind values. | `src/roller.js:405-407`, `src/roller.js:462-493`, `src/roller.js:552` | Adapt: include `requestId`, roll type, actor, token, GM, player, and protocol version. |
| Blind chat hiding | Non-GM player | Replaces blind LMRTFY chat content with `??`. | `src/lmrtfy.js:426-436`, `Hooks.on('renderChatMessage')` | Defer custom hiding; rely on Foundry roll mode visibility first. |
| Settings | GM and players | Parchment theme, deselect on requestor render, use token image, show fail buttons. | `src/lmrtfy.js:2-43` | Adapt: keep token image and optional deselect; defer parchment and fail buttons. |
| Localization | All users | Templates mostly use `localize`; several JS strings remain hardcoded. | `lang/en.json`, templates, `src/roller.js:520-541` | Keep localization from start; do not hardcode visible English. |
| Macro generation | GM | Saves a macro that emits the same socket payload. | `src/requestor.js:402-434` | Defer: useful but not needed for the first WFRP4e lifecycle. |
| Multi-system support | All users | Manifest and runtime switch support many systems. | `module.json:75-197`, `src/lmrtfy.js:75-284` | Defer concrete systems beyond WFRP4e; keep adapter boundary. |

# User Interaction Map

GM flow for the first Ask A Roll release:

1. GM opens a WFRP4e world with the Ask A Roll module enabled.
2. Ask A Roll registers settings and the scene-control request button during Foundry lifecycle hooks.
3. GM selects one or more tokens or chooses an assigned-character or user-owned actor targeting mode.
4. GM clicks the Ask A Roll scene-control button.
5. The GM Request app opens with visible WFRP4e roll groups: characteristics and skills.
6. The app preselects actors from controlled tokens when that target mode is active.
7. GM selects recipients, one or more actors, one or more roll descriptors, roll visibility, selection mode, and an optional localized reason message.
8. GM submits the request.
9. The GM service validates that the current user is a GM, at least one target actor is selected, at least one roll descriptor is selected, every recipient can control at least one targeted actor, and the active system adapter is WFRP4e.
10. The GM service creates a `RollRequest` with a `requestId`, records it in memory, and emits `request:create` on `module.askaroll`.
11. The GM service shows a localized notification that the request was sent.
12. If the GM is also a valid target for an NPC or self-owned actor, the same local routing path opens a player prompt for the GM client.

Player flow for the first Ask A Roll release:

1. Player client receives a `request:create` socket message.
2. Socket guard validates `moduleId`, `protocol`, `type`, `requestId`, `senderUserId`, and payload shape.
3. Player router ignores messages from non-GM senders and messages that do not target the current user or a controlled/owned actor.
4. Player router resolves actor targets from actor ids and token ids, then filters to actors the player owns.
5. Player Prompt app opens with actor portraits, GM reason, selected roll visibility label, and WFRP4e roll buttons.
6. Player clicks a roll button for one actor or all listed actors depending on UI grouping.
7. Player response service asks the WFRP4e adapter to execute the roll for the actor and roll descriptor.
8. WFRP4e adapter performs the roll through verified WFRP4e actor APIs or returns a typed failure.
9. Chat/result service tags created chat messages with `flags.askaroll` containing request correlation.
10. Player client emits `roll:submitted` to the GM with result metadata.
11. Player Prompt disables completed buttons and closes when all required rolls are complete or when `selectionMode` is `one` and one roll succeeds.
12. GM client updates in-memory request status and may show a localized completion notification.

UI surfaces in scope:

- Scene-control button under token controls using the v13 `getSceneControlButtons` hook.
- GM Request ApplicationV2 window.
- Player Prompt ApplicationV2 window.
- Foundry notifications for validation errors and sent/completed states.
- Chat message flags attached to WFRP4e/system roll chat output.

UI surfaces out of scope:

- Macro generation dialog.
- Request history panel.
- Persistent request queue after reload.
- Custom blind-message HTML rewriting.
- Multi-system request templates.

# Business Rules

Rules discovered from LMRTFY that should be preserved or adapted:

1. Only GMs can create authoritative roll requests.
2. Player clients execute rolls for actors they own or control; GM does not directly roll for players in the first release.
3. Recipient targeting must be actor-aware, not only user-aware.
4. A request with no valid actors must warn and must not emit a socket message.
5. A request with no requested roll descriptor must warn and must not emit a socket message.
6. Controlled token targeting should default to currently controlled token actors.
7. Assigned-character targeting should resolve users through `game.user.character` or the v13 equivalent user character property exposed by types/runtime.
8. User targeting should filter actors by owner permission for the selected user.
9. A socket receiver must ignore requests not targeted at the current user or current user's actors.
10. A socket receiver must ignore request messages from non-GM users.
11. GM clients may receive prompts for valid GM-controlled actors, but player-owned actors should not be silently rolled by a GM unless the GM is the targeted actor owner.
12. Roll visibility should use Foundry roll modes: public roll, GM roll, blind roll, and self roll.
13. Player prompt must show the GM reason/message when one is provided.
14. Player prompt must disable a completed roll action to avoid accidental duplicate rolls.
15. `selectionMode: "one"` closes the player prompt after one successful roll.
16. `selectionMode: "all"` closes the player prompt after all requested actor/roll combinations complete or fail with a visible error.
17. Chat messages created by requested rolls should carry module flags for request correlation.
18. Unsupported systems should produce a localized warning and should not show a broken WFRP4e request UI.
19. Unsupported WFRP4e roll descriptors should be hidden in the GM UI and rejected by socket guards if received.
20. All user-facing labels, warnings, notifications, and chat flavors must use `src/languages/en.json` localization keys.

# Foundry VTT v13 Compatibility Risks

Legacy LMRTFY patterns that need redesign:

- `module.json.scripts` global script loading: Ask A Roll already uses `esmodules` and Vite output in `src/module.json`.
- AppV1 `Application` and `FormApplication`: new Ask A Roll UI should use `foundry.applications.api.ApplicationV2` plus `HandlebarsApplicationMixin`; docs inspected confirm these v13 APIs.
- AppV1 `defaultOptions`, `getData`, and `activateListeners`: ApplicationV2 uses `DEFAULT_OPTIONS`, `_prepareContext`, `_onRender`, action handlers, and form submission hooks.
- jQuery event wiring: use DOM events and ApplicationV2 action handlers.
- `renderChatMessage`: v13 ChatMessage docs reference `renderChatMessageHTML`; avoid copying LMRTFY's direct rendered HTML mutation.
- `game.actors.entities` and `game.users.entities`: v10 compatibility fallbacks should not be used in v13 code.
- Manual UUID parsing in `LMRTFY.fromUuid`: use v13 document APIs such as `fromUuid` where available and verified during implementation.
- `duplicate`, `mergeObject`, and `setProperty` globals: use `foundry.utils.deepClone`, `foundry.utils.mergeObject`, `foundry.utils.setProperty`, or typed local transforms after checking types.
- Global mutable singleton `LMRTFY`: replace with services composed in lifecycle modules.
- Large `switch(game.system.id)` in entrypoint: replace with `SystemRollAdapter` registry.
- UI class invoking system-specific actor methods directly: route through `Wfrp4eRollAdapter`.
- Temporary mutation of `game.settings.get("core", "rollMode")`: prefer per-roll or per-message roll mode options; if a WFRP4e API requires global mutation, wrap it in `try/finally` and keep it inside the adapter.
- `globalThis.LMRTFYRequestRoll`: do not expose a global API in the first release.
- Untyped socket payload with overloaded fields: replace with versioned discriminated unions and runtime guards.
- Direct access to unknown WFRP4e actor internals: keep all structural narrowing inside `src/ts/systems/wfrp4e/guards.ts`.

# Ask A Roll Target Architecture

Proposed file/module layout:

```text
src/ts/
  module.ts
  constants.ts
  types.ts
  lifecycle/
    init.ts
    ready.ts
  settings/
    settings.ts
  domain/
    ids.ts
    requests.ts
    recipients.ts
    rolls.ts
    results.ts
    validation.ts
  socket/
    channel.ts
    messages.ts
    guards.ts
    routers.ts
  systems/
    adapter.ts
    registry.ts
    wfrp4e/
      adapter.ts
      guards.ts
      rolls.ts
  services/
    gmRollRequestService.ts
    playerRollRequestService.ts
    recipientResolver.ts
    chatResultService.ts
    notifications.ts
  ui/
    gm/
      GmRollRequestApp.ts
      gmRollRequestViewModel.ts
    player/
      PlayerRollPromptApp.ts
      playerRollPromptViewModel.ts
  foundry/
    game.ts
    users.ts
    actors.ts
src/templates/
  gm-roll-request.hbs
  player-roll-prompt.hbs
src/languages/
  en.json
src/styles/
  style.scss
```

Domain types:

```ts
export type Brand<TValue, TBrand extends string> = TValue & { readonly __brand: TBrand };

export type RequestId = Brand<string, "RequestId">;
export type UserId = Brand<string, "UserId">;
export type ActorId = Brand<string, "ActorId">;
export type TokenId = Brand<string, "TokenId">;
export type SceneId = Brand<string, "SceneId">;
export type RollTypeId = Brand<string, "RollTypeId">;

export type RollVisibility = "publicroll" | "gmroll" | "blindroll" | "selfroll";
export type SelectionMode = "all" | "one";

export type RequestStatus =
  | "created"
  | "delivered"
  | "rolled"
  | "cancelled"
  | "expired"
  | "failed";

export type RecipientTarget =
  | { type: "controlledTokens"; actorIds: ActorId[]; tokenIds: TokenId[]; sceneId: SceneId | null }
  | { type: "assignedCharacters"; userIds: UserId[]; actorIds: ActorId[] }
  | { type: "users"; userIds: UserId[]; actorIds: ActorId[] };

export type Wfrp4eCharacteristic =
  | "ws"
  | "bs"
  | "s"
  | "t"
  | "i"
  | "ag"
  | "dex"
  | "int"
  | "wp"
  | "fel";

export type Wfrp4eRollDescriptor =
  | { system: "wfrp4e"; type: "characteristic"; characteristic: Wfrp4eCharacteristic; labelKey: string }
  | { system: "wfrp4e"; type: "skill"; skillId: string; label: string }
  | { system: "wfrp4e"; type: "customFormula"; formula: string; labelKey: string };

export type RollRequest = {
  requestId: RequestId;
  status: RequestStatus;
  systemId: "wfrp4e";
  gmUserId: UserId;
  createdAt: number;
  recipients: RecipientTarget;
  actorIds: ActorId[];
  rolls: Wfrp4eRollDescriptor[];
  visibility: RollVisibility;
  selectionMode: SelectionMode;
  reason: string;
};
```

Socket message model:

```ts
export type SocketEnvelope<TType extends string, TPayload> = {
  moduleId: "askaroll";
  protocol: 1;
  type: TType;
  requestId: RequestId;
  senderUserId: UserId;
  createdAt: number;
  payload: TPayload;
};

export type RequestCreateMessage = SocketEnvelope<"request:create", { request: RollRequest }>;
export type RequestCancelMessage = SocketEnvelope<"request:cancel", { reasonKey: string }>;
export type RequestDeliveredMessage = SocketEnvelope<"request:delivered", { userId: UserId }>;
export type RollSubmittedMessage = SocketEnvelope<"roll:submitted", RollResultSummary>;
export type RollFailedMessage = SocketEnvelope<"roll:failed", { actorId: ActorId; rollTypeId: RollTypeId; reasonKey: string }>;

export type AskARollSocketMessage =
  | RequestCreateMessage
  | RequestCancelMessage
  | RequestDeliveredMessage
  | RollSubmittedMessage
  | RollFailedMessage;

export type RollResultSummary = {
  actorId: ActorId;
  rollTypeId: RollTypeId;
  chatMessageIds: string[];
  completedAt: number;
};
```

Socket guard pattern:

```ts
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const isAskARollSocketMessage = (value: unknown): value is AskARollSocketMessage => {
  if (!isRecord(value)) return false;
  if (value.moduleId !== "askaroll") return false;
  if (value.protocol !== 1) return false;
  if (typeof value.type !== "string") return false;
  if (typeof value.requestId !== "string") return false;
  if (typeof value.senderUserId !== "string") return false;
  if (typeof value.createdAt !== "number") return false;
  if (!isRecord(value.payload)) return false;
  return ["request:create", "request:cancel", "request:delivered", "roll:submitted", "roll:failed"].includes(value.type);
};
```

WFRP4e adapter boundary:

```ts
export type RollOptionGroup = {
  id: string;
  labelKey: string;
  rolls: Wfrp4eRollDescriptor[];
};

export type PlayerRollContext = {
  request: RollRequest;
  actor: Actor;
  roll: Wfrp4eRollDescriptor;
  event: Event | null;
};

export type SystemRollAdapter = {
  readonly systemId: "wfrp4e";
  isSupportedActor(actor: Actor): boolean;
  getRollGroups(actor: Actor): RollOptionGroup[];
  executeRoll(context: PlayerRollContext): Promise<RollResultSummary>;
};
```

Initial WFRP4e roll types to support:

- Characteristic tests: WS, BS, S, T, I, Ag, Dex, Int, WP, Fel.
- Skill tests: skills discovered from the actor's WFRP4e skill collection or system data after runtime verification.
- Custom formula: enabled only if `actor.getRollData()` provides stable WFRP4e data and `Roll` creation succeeds in manual verification.

WFRP4e roll types deferred:

- Weapon attacks.
- Spell casting.
- Prayer rolls.
- Channeling rolls.
- Talent, trait, mutation, career, and item-specific rolls.
- Roll table draws.

UI/application strategy:

- Use ApplicationV2 plus HandlebarsApplicationMixin for new GM and player apps.
- Keep UI classes thin: prepare view models, route submit/click actions to services, and render localized templates.
- Do not extend the existing AppV1 `DogBrowser`; remove demo UI when feature UI is wired.
- Use DOM dataset action handlers through ApplicationV2 configuration rather than jQuery.

Settings/localization strategy:

- Register settings in `init`.
- Register scene-control button and socket listener in `ready` or after adapter resolution when world data is available.
- Use `src/languages/en.json` for every label, hint, notification, template string, and chat flavor.
- Initial settings: `useTokenImageForActors` and `deselectTokensOnOpen`.
- No keybinding in the first release unless the GM request action has a clear default-free shortcut requirement.

# Phased Implementation Plan

## Phase 1: Domain Model and Abstractions

**Goal:** Create pure TypeScript models for requests, recipients, rolls, results, and validation.

**Files likely touched:**

- Create `src/ts/domain/ids.ts`
- Create `src/ts/domain/rolls.ts`
- Create `src/ts/domain/recipients.ts`
- Create `src/ts/domain/requests.ts`
- Create `src/ts/domain/results.ts`
- Create `src/ts/domain/validation.ts`
- Create `src/ts/domain/requests.test.ts`
- Modify `package.json`

**Tasks:**

- [x] Add `vitest` as a dev dependency and add scripts `test` and `test:run` to `package.json`.
- [x] Write failing tests in `src/ts/domain/requests.test.ts` for rejecting an empty actor list, rejecting an empty roll list, and creating a request with `status: "created"`.
- [x] Implement branded ids, WFRP4e roll descriptors, recipient targets, and `createRollRequest`.
- [x] Run `yarn test:run src/ts/domain/requests.test.ts` and verify all domain tests pass.
- [x] Run `yarn build` and verify TypeScript strict mode passes.
- [x] Commit with `git add package.json yarn.lock src/ts/domain && git commit -m "feat: add roll request domain model"`. Skipped because no commit was requested.

Minimal domain test content:

```ts
import { describe, expect, it } from "vitest";
import { asActorId, asRequestId, asUserId } from "./ids";
import { createRollRequest } from "./requests";

describe("createRollRequest", () => {
  it("rejects a request with no actors", () => {
    const result = createRollRequest({
      requestId: asRequestId("request-1"),
      gmUserId: asUserId("gm-1"),
      actorIds: [],
      rolls: [{ system: "wfrp4e", type: "characteristic", characteristic: "wp", labelKey: "askaroll.wfrp4e.characteristics.wp" }],
      recipients: { type: "assignedCharacters", userIds: [asUserId("player-1")], actorIds: [] },
      visibility: "publicroll",
      selectionMode: "all",
      reason: "Test fear",
      createdAt: 100,
    });

    expect(result).toEqual({ ok: false, reason: "noActors" });
  });

  it("rejects a request with no rolls", () => {
    const result = createRollRequest({
      requestId: asRequestId("request-1"),
      gmUserId: asUserId("gm-1"),
      actorIds: [asActorId("actor-1")],
      rolls: [],
      recipients: { type: "assignedCharacters", userIds: [asUserId("player-1")], actorIds: [asActorId("actor-1")] },
      visibility: "publicroll",
      selectionMode: "all",
      reason: "Test fear",
      createdAt: 100,
    });

    expect(result).toEqual({ ok: false, reason: "noRolls" });
  });

  it("creates a valid WFRP4e request", () => {
    const result = createRollRequest({
      requestId: asRequestId("request-1"),
      gmUserId: asUserId("gm-1"),
      actorIds: [asActorId("actor-1")],
      rolls: [{ system: "wfrp4e", type: "characteristic", characteristic: "wp", labelKey: "askaroll.wfrp4e.characteristics.wp" }],
      recipients: { type: "assignedCharacters", userIds: [asUserId("player-1")], actorIds: [asActorId("actor-1")] },
      visibility: "publicroll",
      selectionMode: "all",
      reason: "Test fear",
      createdAt: 100,
    });

    expect(result).toMatchObject({ ok: true, value: { status: "created", systemId: "wfrp4e" } });
  });
});
```

**Acceptance criteria:**

- Domain types compile under strict TypeScript.
- Invalid request inputs return typed validation failures, not thrown generic errors.
- Valid requests contain a request id, GM user id, recipient target, actor ids, roll descriptors, roll visibility, selection mode, reason, creation time, status, and system id.

**Risks:**

- `noUnusedLocals` will fail if future-facing types are added before use; add only types used by tests or immediate integration.
- Adding Vitest changes package scripts and lockfile; if dependency addition is rejected during execution, keep tests as a follow-up and use `yarn build` for this phase.

## Phase 2: Foundry Integration

**Goal:** Replace demo entrypoint behavior with lifecycle modules, settings, scene-control button, and socket registration.

**Files likely touched:**

- Modify `src/ts/module.ts`
- Modify `src/ts/types.ts`
- Create `src/ts/lifecycle/init.ts`
- Create `src/ts/lifecycle/ready.ts`
- Create `src/ts/settings/settings.ts`
- Create `src/ts/foundry/game.ts`
- Create `src/ts/foundry/users.ts`
- Delete `src/ts/apps/dogBrowser.ts`
- Delete `src/templates/dogs.hbs`

**Tasks:**

- [x] Write failing tests for pure setting key constants if test framework was added in Phase 1.
- [x] Keep the `import "../styles/style.scss";` side-effect import in `src/ts/module.ts`.
- [x] Replace DogBrowser initialization with `Hooks.once("init", registerAskARollInit)` and `Hooks.once("ready", registerAskARollReady)`.
- [x] Register settings `useTokenImageForActors` and `deselectTokensOnOpen` under namespace `askaroll`.
- [x] Add a token scene-control button through `Hooks.on("getSceneControlButtons", controls => { ... })` using the v13 hook signature inspected at `hookEvents.getSceneControlButtons`.
- [x] Remove dog browser template, class, and module API field.
- [x] Run `yarn build`.
- [x] Commit with `git add src/ts src/templates src/languages package.json yarn.lock && git commit -m "feat: wire ask a roll lifecycle"`.

Entry point target shape:

```ts
/// <reference types="vite/client" />

// Do not remove this import. If you do Vite will think your styles are dead
// code and not include them in the build output.
import "../styles/style.scss";
import { registerAskARollInit } from "./lifecycle/init";
import { registerAskARollReady } from "./lifecycle/ready";

Hooks.once("init", registerAskARollInit);
Hooks.once("ready", registerAskARollReady);
```

**Acceptance criteria:**

- Ask A Roll no longer renders dog-browser UI.
- Build still emits JS and CSS through Vite.
- Settings are registered during `init`.
- World-dependent setup runs during `ready`.
- Scene-control button is visible only to GMs.

**Risks:**

- The `fvtt-types` package may not perfectly type v13 scene control structures; keep unsafe casts in `lifecycle/ready.ts` and document why if one is unavoidable.
- Removing demo files requires removing all imports and language/style references in the same commit.

## Phase 3: WFRP4e Adapter

**Goal:** Resolve WFRP4e roll descriptors and execute supported WFRP4e roll types through a bounded adapter.

**Files likely touched:**

- Create `src/ts/systems/adapter.ts`
- Create `src/ts/systems/registry.ts`
- Create `src/ts/systems/wfrp4e/adapter.ts`
- Create `src/ts/systems/wfrp4e/guards.ts`
- Create `src/ts/systems/wfrp4e/rolls.ts`
- Create `src/ts/systems/wfrp4e/guards.test.ts`
- Modify `src/languages/en.json`

**Tasks:**

- [ ] Write failing tests for WFRP4e guard functions using minimal structural actor fixtures.
- [x] Implement `isWfrp4eSystemId`, `isWfrp4eActor`, and characteristic-data guards using `unknown` inputs.
- [x] Implement static characteristic roll descriptors for WS, BS, S, T, I, Ag, Dex, Int, WP, and Fel.
- [ ] Implement skill descriptor discovery from actor data only after confirming the WFRP4e actor shape in a running WFRP4e world.
- [x] Implement `getSystemRollAdapter` so it returns the WFRP4e adapter for `game.system.id === "wfrp4e"` and a typed unsupported result otherwise.
- [x] Implement `executeRoll` as a typed unsupported path until the exact WFRP4e Actor method is verified in manual Foundry testing.
- [ ] Implement skill roll execution after characteristic execution passes manual testing.
- [x] Run `yarn test:run src/ts/systems/wfrp4e/guards.test.ts` if tests exist.
- [x] Run `yarn build`.
- [x] Commit with `git add src/ts/systems src/languages/en.json && git commit -m "feat: add wfrp4e roll adapter"`.

Guard fixture test target:

```ts
import { describe, expect, it } from "vitest";
import { isWfrp4eActorSystemData } from "./guards";

describe("isWfrp4eActorSystemData", () => {
  it("accepts characteristic data with WFRP4e characteristic keys", () => {
    expect(isWfrp4eActorSystemData({ characteristics: { ws: {}, bs: {}, s: {}, t: {}, i: {}, ag: {}, dex: {}, int: {}, wp: {}, fel: {} } })).toBe(true);
  });

  it("rejects missing characteristic data", () => {
    expect(isWfrp4eActorSystemData({})).toBe(false);
  });
});
```

**Acceptance criteria:**

- System-specific type guards are the only place that narrows raw WFRP4e system data.
- GM UI can ask the adapter for WFRP4e roll groups without knowing WFRP4e internals.
- Player service can ask the adapter to execute a roll without knowing WFRP4e actor method names.

**Risks:**

- WFRP4e actor methods are not part of Foundry core docs; implementation must verify exact method names and call signatures in a WFRP4e v13 world before coding the execution path.
- Community `fvtt-types` may not include WFRP4e-specific actor data. Use minimal structural interfaces and `unknown` guards instead of module-wide casts.

## Phase 4: GM Request UI

**Goal:** Provide a localized GM ApplicationV2 form for choosing recipients, actors, WFRP4e roll types, roll visibility, selection mode, and reason.

**Files likely touched:**

- Create `src/ts/ui/gm/GmRollRequestApp.ts`
- Create `src/ts/ui/gm/gmRollRequestViewModel.ts`
- Create `src/templates/gm-roll-request.hbs`
- Modify `src/styles/style.scss`
- Modify `src/languages/en.json`
- Modify `src/ts/lifecycle/ready.ts`

**Tasks:**

- [x] Write failing tests for `buildGmRollRequestViewModel` using fake users, actors, selected token ids, and WFRP4e roll groups.
- [x] Implement the GM view model as a pure function with no Foundry globals.
- [x] Create `gm-roll-request.hbs` with localized labels for recipients, actors, roll groups, visibility, selection mode, reason, submit, and cancel.
- [x] Implement `GmRollRequestApp` using ApplicationV2 plus HandlebarsApplicationMixin.
- [x] Wire the scene-control button to render one GM request app instance.
- [x] Add SCSS classes for actor selection, roll group layout, and submit actions.
- [x] Run view-model tests if tests exist.
- [x] Run `yarn build`.
- [x] Commit with `git add src/ts/ui/gm src/templates/gm-roll-request.hbs src/styles/style.scss src/languages/en.json src/ts/lifecycle/ready.ts && git commit -m "feat: add gm roll request ui"`.

View-model test target:

```ts
import { describe, expect, it } from "vitest";
import { buildGmRollRequestViewModel } from "./gmRollRequestViewModel";

describe("buildGmRollRequestViewModel", () => {
  it("marks controlled-token actors as selected", () => {
    const viewModel = buildGmRollRequestViewModel({
      actors: [{ id: "actor-1", name: "Bruno", img: "actor.png", tokenImg: "token.png" }],
      users: [{ id: "user-1", name: "Player", assignedActorId: "actor-1", isGM: false }],
      controlledActorIds: ["actor-1"],
      useTokenImageForActors: false,
      rollGroups: [],
    });

    expect(viewModel.actors).toEqual([{ id: "actor-1", name: "Bruno", img: "actor.png", selected: true }]);
  });
});
```

**Acceptance criteria:**

- GM can open the request UI from scene controls.
- UI displays only WFRP4e-supported roll groups.
- UI defaults controlled-token actors to selected.
- Submit is blocked with localized warnings when no actors or rolls are selected.
- All visible strings are localization keys.

**Risks:**

- ApplicationV2 form submission types can be verbose with `fvtt-types`; keep form parsing in a small helper that accepts `FormData` and returns a typed draft.
- WFRP4e skill lists can be long; the initial UI should group and scroll skill choices without adding filters in the first release.

## Phase 5: Player Response UI

**Goal:** Show targeted players a localized prompt with requested WFRP4e rolls and execute actions through the player service.

**Files likely touched:**

- Create `src/ts/ui/player/PlayerRollPromptApp.ts`
- Create `src/ts/ui/player/playerRollPromptViewModel.ts`
- Create `src/templates/player-roll-prompt.hbs`
- Modify `src/styles/style.scss`
- Modify `src/languages/en.json`
- Create `src/ts/services/playerRollRequestService.ts`

**Tasks:**

- [x] Write and pass player prompt completion tests for `selectionMode: "one"` and `selectionMode: "all"`.
- [x] Implement a prompt view model that lists actors, reason, roll labels, visibility label, and completion state.
- [x] Create `player-roll-prompt.hbs` with localized intro, reason, choose-one note, actor list, and roll buttons.
- [x] Implement `PlayerRollPromptApp` with ApplicationV2 action handlers for roll buttons, request-scoped app ids, and request cleanup on close.
- [x] Implement player service method `performRequestedRoll(requestId, actorId, rollTypeId, event)` with request and actor validation.
- [x] Disable completed buttons, block duplicate in-flight rolls, and close the prompt according to selection mode.
- [x] Run view-model tests if tests exist.
- [x] Run `yarn build`.
- [x] Commit with `git add src/ts/ui/player src/templates/player-roll-prompt.hbs src/styles/style.scss src/languages/en.json src/ts/services/playerRollRequestService.ts && git commit -m "feat: add player roll prompt"`.

Completion test target:

```ts
import { describe, expect, it } from "vitest";
import { shouldClosePrompt } from "./playerRollPromptViewModel";

describe("shouldClosePrompt", () => {
  it("closes after one completed roll in one-selection mode", () => {
    expect(shouldClosePrompt({ selectionMode: "one", totalActions: 3, completedActions: 1 })).toBe(true);
  });

  it("keeps open until every action is completed in all-selection mode", () => {
    expect(shouldClosePrompt({ selectionMode: "all", totalActions: 3, completedActions: 2 })).toBe(false);
    expect(shouldClosePrompt({ selectionMode: "all", totalActions: 3, completedActions: 3 })).toBe(true);
  });
});
```

**Acceptance criteria:**

- Targeted player receives one prompt per request.
- Prompt shows only actors the player can roll for.
- Clicking a roll button delegates to WFRP4e adapter through player service.
- Completed roll buttons cannot be clicked a second time.
- Prompt closes according to selection mode.

**Risks:**

- Multiple targeted actors for one player can make the UI noisy; group buttons by actor first and by roll second.
- Failed WFRP4e roll execution must leave the button enabled and show a localized error so the player can retry.

## Phase 6: Socket, Chat, and Result Lifecycle

**Goal:** Route request and result messages over `module.askaroll`, validate senders, correlate chat messages, and track in-memory lifecycle state.

**Files likely touched:**

- Create `src/ts/socket/channel.ts`
- Create `src/ts/socket/messages.ts`
- Create `src/ts/socket/guards.ts`
- Create `src/ts/socket/routers.ts`
- Create `src/ts/socket/guards.test.ts`
- Create `src/ts/services/gmRollRequestService.ts`
- Create `src/ts/services/recipientResolver.ts`
- Create `src/ts/services/chatResultService.ts`
- Create `src/ts/services/notifications.ts`
- Modify `src/ts/lifecycle/ready.ts`
- Modify `src/languages/en.json`

**Tasks:**

- [x] Write and pass socket guard acceptance and rejection tests.
- [x] Implement message constructors for `request:create`, `request:cancel`, `request:delivered`, `roll:submitted`, and `roll:failed`.
- [x] Implement `isAskARollSocketMessage(value: unknown)` and payload-specific guards.
- [x] Register `game.socket?.on("module.askaroll", routeSocketMessage)` during `ready`.
- [x] Implement GM router that accepts player result messages and rejects request creation from non-GM senders.
- [x] Implement player router that accepts only GM-created request messages targeting the current user.
- [x] Implement recipient resolver for controlled tokens, assigned characters, and users.
- [x] Implement chat result service that sets `flags.askaroll.requestId`, `flags.askaroll.rollTypeId`, `flags.askaroll.actorId`, `flags.askaroll.gmUserId`, `flags.askaroll.playerUserId`, and `flags.askaroll.protocol`.
- [x] Route locally-created GM request and delivery messages so the active client tracks its own request state.
- [x] Capture internally-created WFRP4e chat messages with a temporary `preCreateChatMessage` hook for result correlation.
- [x] Run socket guard tests.
- [x] Run `yarn build`.
- [x] Commit with `git add src/ts/socket src/ts/services src/ts/lifecycle/ready.ts src/languages/en.json && git commit -m "feat: add roll request socket lifecycle"`.

Socket guard test target:

```ts
import { describe, expect, it } from "vitest";
import { isAskARollSocketMessage } from "./guards";

describe("isAskARollSocketMessage", () => {
  it("rejects foreign module messages", () => {
    expect(isAskARollSocketMessage({ moduleId: "other", protocol: 1, type: "request:create", requestId: "r1", senderUserId: "u1", createdAt: 1, payload: {} })).toBe(false);
  });

  it("rejects unsupported protocol versions", () => {
    expect(isAskARollSocketMessage({ moduleId: "askaroll", protocol: 2, type: "request:create", requestId: "r1", senderUserId: "u1", createdAt: 1, payload: {} })).toBe(false);
  });

  it("accepts a protocol 1 Ask A Roll envelope with an object payload", () => {
    expect(isAskARollSocketMessage({ moduleId: "askaroll", protocol: 1, type: "request:cancel", requestId: "r1", senderUserId: "u1", createdAt: 1, payload: { reasonKey: "askaroll.request.cancelled" } })).toBe(true);
  });
});
```

**Acceptance criteria:**

- All socket messages use channel `module.askaroll`.
- Incoming socket data is treated as `unknown` until guard validation passes.
- Non-GM `request:create` messages are rejected with no UI side effects.
- Player `roll:submitted` messages update GM in-memory request state.
- Chat flags are written for every requested roll result the module can tag.

**Risks:**

- Some WFRP4e actor roll APIs may create chat messages internally. If they do not expose message ids, use `preCreateChatMessage` in a small `try/finally`-style helper for correlation and remove the hook immediately after the roll completes.
- Socket messages are not persisted across reloads in the first release; document that active prompts are transient.

## Phase 7: Localization and Settings

**Goal:** Complete user-facing strings and settings for the first release.

**Files likely touched:**

- Modify `src/languages/en.json`
- Modify `src/ts/settings/settings.ts`
- Modify `src/ts/services/notifications.ts`
- Modify `src/templates/gm-roll-request.hbs`
- Modify `src/templates/player-roll-prompt.hbs`

**Tasks:**

- [x] Replace dog-browser localization keys with Ask A Roll keys.
- [x] Add localization keys for settings names and hints.
- [x] Add localization keys for GM app labels and validation warnings.
- [x] Add localization keys for player prompt labels, action buttons, completion notifications, and errors.
- [x] Add localization keys for WFRP4e characteristics.
- [x] Add localization keys for chat/result flavors.
- [x] Run a text search for hardcoded visible strings in `src/ts`, `src/templates`, and `src/styles`.
- [x] Run `yarn build`.
- [x] Commit with `git add src/languages/en.json src/ts/settings src/ts/services/notifications.ts src/templates && git commit -m "feat: localize roll request workflow"` (not requested).

Initial localization key set:

```json
{
  "askaroll.title": "Ask A Roll",
  "askaroll.controls.requestRoll": "Request Roll",
  "askaroll.settings.useTokenImageForActors.name": "Use token images for actor selection",
  "askaroll.settings.useTokenImageForActors.hint": "Show token artwork instead of actor portraits in the GM request window.",
  "askaroll.settings.deselectTokensOnOpen.name": "Deselect tokens when opening the request window",
  "askaroll.settings.deselectTokensOnOpen.hint": "Clear the current token selection after opening Ask A Roll to prevent repeated accidental targeting.",
  "askaroll.gm.title": "Request Rolls",
  "askaroll.gm.recipients": "Recipients",
  "askaroll.gm.actors": "Actors",
  "askaroll.gm.rolls": "Rolls",
  "askaroll.gm.visibility": "Visibility",
  "askaroll.gm.reason": "Reason",
  "askaroll.gm.submit": "Request Rolls",
  "askaroll.validation.noActors": "Choose at least one actor.",
  "askaroll.validation.noRolls": "Choose at least one roll.",
  "askaroll.notifications.sent": "Roll request sent.",
  "askaroll.player.intro": "Your GM requested a roll.",
  "askaroll.player.chooseOne": "Choose one roll.",
  "askaroll.player.roll": "Roll",
  "askaroll.wfrp4e.characteristics.ws": "Weapon Skill",
  "askaroll.wfrp4e.characteristics.bs": "Ballistic Skill",
  "askaroll.wfrp4e.characteristics.s": "Strength",
  "askaroll.wfrp4e.characteristics.t": "Toughness",
  "askaroll.wfrp4e.characteristics.i": "Initiative",
  "askaroll.wfrp4e.characteristics.ag": "Agility",
  "askaroll.wfrp4e.characteristics.dex": "Dexterity",
  "askaroll.wfrp4e.characteristics.int": "Intelligence",
  "askaroll.wfrp4e.characteristics.wp": "Willpower",
  "askaroll.wfrp4e.characteristics.fel": "Fellowship"
}
```

**Acceptance criteria:**

- No visible dog-browser strings remain.
- No hardcoded English user-facing strings remain in new Ask A Roll code or templates.
- Settings display localized names and hints.
- Characteristic names resolve through localization.

**Risks:**

- WFRP4e skill names may already be localized by the system. Preserve system-provided labels when present and only localize Ask A Roll labels around them.

## Phase 8: Tests and Manual Verification

**Goal:** Verify pure logic with tests and verify Foundry/WFRP4e behavior manually.

**Files likely touched:**

- Modify test files created in earlier phases.
- Create `docs/manual-test-checklists/wfrp4e-roll-requests.md` if maintainers want a persistent manual checklist.

**Tasks:**

- [ ] Run `yarn test:run` if Vitest was added.
- [ ] Run `yarn build`.
- [ ] In Foundry v13 with WFRP4e, enable Ask A Roll in a test world.
- [ ] Log in as GM and a non-GM player in separate browser sessions.
- [ ] Confirm the scene-control button appears for GM and not for player.
- [ ] Confirm GM can open the request window.
- [ ] Confirm controlled-token targeting preselects controlled actors.
- [ ] Confirm assigned-character targeting resolves the player character.
- [ ] Confirm user targeting lists actors owned by that user.
- [ ] Send a characteristic request to the player.
- [ ] Confirm player prompt appears only on the targeted player client.
- [ ] Execute a characteristic roll and confirm WFRP4e produces the expected chat output.
- [ ] Confirm chat message flags include `flags.askaroll.requestId` and protocol metadata.
- [ ] Send a skill request and confirm player can roll an available skill.
- [ ] Confirm `selectionMode: "one"` closes after one successful roll.
- [ ] Confirm `selectionMode: "all"` closes after all requested rolls complete.
- [ ] Confirm non-GM socket request creation is ignored by router if simulated from console.
- [ ] Confirm unsupported system state shows a localized warning and does not render WFRP4e-only roll options.
- [ ] Commit manual checklist if created with `git add docs/manual-test-checklists/wfrp4e-roll-requests.md && git commit -m "docs: add wfrp4e roll request checklist"`.

**Acceptance criteria:**

- Automated pure logic tests pass if the test runner is added.
- `yarn build` passes.
- GM and player manual checks pass in a WFRP4e world.
- Any manual verification failure has a specific follow-up issue or code task before release.

**Risks:**

- Foundry and WFRP4e behavior cannot be fully verified by `yarn build`; manual multi-client testing is required.
- Socket behavior requires at least two connected users to validate properly.

## Phase 9: Build and Release Verification

**Goal:** Confirm source-of-truth manifest/build behavior before packaging.

**Files likely touched:**

- No source edits expected unless verification finds a build configuration issue.

**Tasks:**

- [ ] Run `yarn build`.
- [ ] Confirm `dist/scripts/module.js` exists.
- [ ] Confirm `dist/style.css` exists, proving the `src/ts/module.ts` style side-effect import still works.
- [ ] Confirm `dist/templates/gm-roll-request.hbs` and `dist/templates/player-roll-prompt.hbs` exist.
- [ ] Confirm `dist/languages/en.json` exists.
- [ ] Confirm generated `dist/module.json` contains id `askaroll`, compatibility v13, WFRP4e relationship, styles `style.css`, and esmodule `scripts/module.js`.
- [ ] Do not hand-edit `dist/module.json`.
- [ ] Commit only source changes if a source fix was needed.

**Acceptance criteria:**

- Build output matches `vite.config.ts` expectations.
- `src/module.json` remains the manifest source of truth.
- Release workflow can zip `dist/` after `yarn build` without missing templates or localization files.

**Risks:**

- Removing the style import or moving templates/languages outside `src/templates` and `src/languages` will break generated release output.

# File-by-File Change Plan

Expected Ask A Roll files to modify:

- `package.json`: add test scripts if Vitest is accepted; keep `build` unchanged.
- `yarn.lock`: update only if adding a test dependency.
- `src/ts/module.ts`: keep style import; replace dog-browser wiring with lifecycle registration.
- `src/ts/types.ts`: replace `askaroll` dog-browser interface with an `AskARollModule` shape only if a module API object is needed.
- `src/ts/constants.ts`: keep `moduleId`; optionally add `socketChannel = `module.${moduleId}`` if not defined in socket module.
- `src/languages/en.json`: replace dog keys with Ask A Roll workflow, settings, validation, notification, and WFRP4e keys.
- `src/styles/style.scss`: remove dog image styles and add request/prompt layout styles.
- `src/module.json`: no planned edits for first lifecycle unless adding a required manifest field for socket behavior after v13 verification.

Expected Ask A Roll files to delete:

- `src/ts/apps/dogBrowser.ts`: demo app not part of Ask A Roll.
- `src/templates/dogs.hbs`: demo template not part of Ask A Roll.

Expected Ask A Roll files to create:

- `src/ts/lifecycle/init.ts`: settings registration and init-time setup.
- `src/ts/lifecycle/ready.ts`: adapter resolution, socket registration, scene-control button, and world-dependent service composition.
- `src/ts/settings/settings.ts`: typed setting keys and accessors.
- `src/ts/domain/ids.ts`: branded id constructors.
- `src/ts/domain/rolls.ts`: WFRP4e roll descriptor types.
- `src/ts/domain/recipients.ts`: recipient target types.
- `src/ts/domain/requests.ts`: request creation and status model.
- `src/ts/domain/results.ts`: roll result summaries.
- `src/ts/domain/validation.ts`: typed validation results.
- `src/ts/socket/channel.ts`: `module.askaroll` channel helper.
- `src/ts/socket/messages.ts`: socket envelope and message constructors.
- `src/ts/socket/guards.ts`: runtime guards for incoming socket data.
- `src/ts/socket/routers.ts`: GM and player message routing.
- `src/ts/systems/adapter.ts`: system adapter interface.
- `src/ts/systems/registry.ts`: active adapter resolution.
- `src/ts/systems/wfrp4e/adapter.ts`: WFRP4e roll options and execution.
- `src/ts/systems/wfrp4e/guards.ts`: WFRP4e actor/system type guards.
- `src/ts/systems/wfrp4e/rolls.ts`: characteristic descriptor constants and skill descriptor helpers.
- `src/ts/services/gmRollRequestService.ts`: GM request creation, validation, state tracking, and outgoing socket messages.
- `src/ts/services/playerRollRequestService.ts`: player prompt state and roll execution orchestration.
- `src/ts/services/recipientResolver.ts`: controlled-token, assigned-character, and user-owned actor resolution.
- `src/ts/services/chatResultService.ts`: request flagging and chat metadata.
- `src/ts/services/notifications.ts`: localized notification wrappers.
- `src/ts/ui/gm/GmRollRequestApp.ts`: GM ApplicationV2 UI.
- `src/ts/ui/gm/gmRollRequestViewModel.ts`: pure GM view model builder.
- `src/ts/ui/player/PlayerRollPromptApp.ts`: player ApplicationV2 UI.
- `src/ts/ui/player/playerRollPromptViewModel.ts`: pure prompt view model and completion logic.
- `src/ts/foundry/game.ts`: safe accessors for `game`, `ui`, `canvas`, and current user.
- `src/ts/foundry/users.ts`: user view-model conversion and GM checks.
- `src/ts/foundry/actors.ts`: actor view-model conversion and permission wrappers.
- `src/templates/gm-roll-request.hbs`: GM request form template.
- `src/templates/player-roll-prompt.hbs`: player prompt template.

Expected files not to touch:

- `dist/`: generated output only.
- `dist/module.json`: generated from `src/module.json` by Vite plugin.
- `.market_research/fvtt-module-lmrtfy/`: reference code only.

# Testing and Verification Plan

Automated checks:

- Run `yarn build` before claiming implementation complete.
- If Vitest is added, run `yarn test:run` before `yarn build`.
- Add pure tests for domain validation, socket guards, recipient resolution, WFRP4e type guards, and UI view-model completion logic.

Manual Foundry v13 GM checks:

- GM sees Ask A Roll scene-control button.
- GM opens request UI.
- GM sees WFRP4e characteristic and skill roll groups.
- GM can target controlled tokens.
- GM can target assigned characters.
- GM can target actors owned by a specific user.
- GM receives localized warnings for no actors and no rolls.
- GM receives localized sent notification after valid submission.

Manual Foundry v13 player checks:

- Non-targeted player receives no prompt.
- Targeted player receives one prompt.
- Prompt shows actor, reason, roll labels, and choose-one note when enabled.
- Completed buttons disable after roll.
- Prompt closes according to selection mode.
- Player sees localized error if roll execution fails.

WFRP4e roll lifecycle checks:

- Characteristic request for each supported characteristic can be displayed.
- At minimum, one characteristic roll executes and produces WFRP4e chat output.
- Skill request displays available actor skills.
- At minimum, one skill roll executes and produces WFRP4e chat output.
- Custom formula is enabled only if manual verification confirms stable actor roll data and chat output.

Socket/request lifecycle checks:

- `request:create` is sent on `module.askaroll`.
- Incoming foreign module messages are ignored.
- Incoming unsupported protocol versions are ignored.
- Incoming non-GM request creation is ignored.
- Targeted player sends `request:delivered` or equivalent prompt-open acknowledgement if implemented in Phase 6.
- Player sends `roll:submitted` after successful roll execution.
- GM in-memory request state updates after submitted results.

Localization/template checks:

- Search `src/templates` for visible English outside localization keys.
- Search `src/ts` for notification and UI strings outside localization calls.
- Confirm `src/languages/en.json` contains every key used by templates and code.
- Confirm WFRP4e characteristic keys resolve in the UI.

Manifest/build output sanity checks:

- `yarn build` completes.
- `dist/scripts/module.js` exists.
- `dist/style.css` exists.
- `dist/templates/gm-roll-request.hbs` exists.
- `dist/templates/player-roll-prompt.hbs` exists.
- `dist/languages/en.json` exists.
- `dist/module.json` contains module id `askaroll`, v13 compatibility, WFRP4e relationship, style `style.css`, and esmodule `scripts/module.js`.
- `dist/module.json` was generated, not hand-edited.

# Deployment/Release Checklist

- Run `yarn build` locally.
- Confirm `src/module.json` is the manifest source of truth.
- Confirm `vite.config.ts` still writes `dist/module.json` from `src/module.json`.
- Confirm release-time version, manifest URL, and download URL behavior remains controlled by `MODULE_VERSION`, `GH_PROJECT`, and `GH_TAG` in `vite.config.ts`.
- Confirm templates and languages remain under `src/templates` and `src/languages` so Vite copy targets include them.
- Confirm the side-effect SCSS import remains in `src/ts/module.ts` so `dist/style.css` is emitted.
- Do not add publishing steps beyond the existing `.github/workflows/publish.yml` release flow.

# Open Questions and Assumptions

Questions that block implementation decisions:

1. Which exact WFRP4e Actor methods and option objects should Ask A Roll call for characteristic and skill rolls in Foundry v13?
2. Should custom formula requests be included in the first WFRP4e release if characteristic and skill requests already cover the core use case?
3. Should Ask A Roll add Vitest now for pure TypeScript tests, or keep the first milestone limited to `yarn build` plus manual Foundry verification?

Assumptions used by this plan:

- The first release targets WFRP4e only even though the architecture keeps an adapter boundary.
- Active requests are transient in memory and do not survive reloads.
- Macro generation is valuable but not required for the first working lifecycle.
- Foundry roll visibility should rely on core roll mode behavior before adding custom blind-content hiding.

# Self-Review

Spec coverage:

- Core features are covered by Phases 1 through 7.
- User interactions are covered by the User Interaction Map and Phases 4 through 6.
- Business rules are separated from implementation details in the Business Rules section.
- Foundry integration is covered by v13 compatibility risks, lifecycle files, socket files, ApplicationV2 UI, settings, and scene controls.
- TypeScript design is covered by domain types, socket discriminated unions, WFRP4e adapter boundary, guards, and strict-mode risks.
- Deferred LMRTFY features are listed in the inventory and architecture sections.
- Verification is covered by Phases 8 and 9 plus the Testing and Verification Plan.

- Placeholder scan:

- The plan contains none of the prohibited placeholder phrases from the planning instructions.
- Tasks that change code name exact files and provide representative code shapes for core types and tests.

Type consistency:

- `RequestId`, `UserId`, `ActorId`, `RollTypeId`, `RollRequest`, `Wfrp4eRollDescriptor`, `RollResultSummary`, `SocketEnvelope`, and `AskARollSocketMessage` are named consistently across architecture and phases.
- Socket message type strings are consistently `request:create`, `request:cancel`, `request:delivered`, `roll:submitted`, and `roll:failed`.
- Selection mode is consistently `"all" | "one"`.

# Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-24-ask-a-roll-wfrp4e-roll-requests.md`.

Two execution options when implementation begins:

1. Subagent-Driven (recommended) - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. Inline Execution - execute tasks in this session using executing-plans, batch execution with checkpoints.
