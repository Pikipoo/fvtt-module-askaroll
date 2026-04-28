# WFRP4e Roll Requests Manual Test Checklist

Phase 8 verification checklist for Ask A Roll in Foundry VTT v13 with the WFRP4e system.

## Automated verification

- Date: 2026-04-27
- `yarn test:run`: Pass — 8 test files passed, 35 tests passed.
- `yarn build`: Pass — `tsc && vite build`; Vite built `dist/style.css` and `dist/scripts/module.js` successfully.
- Failures: None recorded during Phase 8 automated verification.

## Manual test setup

- [ ] Pass [ ] Fail [ ] Blocked — Foundry VTT v13 test world uses the WFRP4e system.
  - Notes:
- [ ] Pass [ ] Fail [ ] Blocked — Ask A Roll is enabled in the test world.
  - Notes:
- [ ] Pass [ ] Fail [ ] Blocked — One GM user and one non-GM player user can log in at the same time in separate browser sessions.
  - Notes:
- [ ] Pass [ ] Fail [ ] Blocked — Test actors exist for controlled-token, assigned-character, and user-owned actor targeting.
  - Notes:

## GM visibility and request window

- [ ] Pass [ ] Fail [ ] Blocked — The Ask A Roll scene-control button appears for the GM.
  - Notes:
- [ ] Pass [ ] Fail [ ] Blocked — The Ask A Roll scene-control button does not appear for the non-GM player.
  - Notes:
- [ ] Pass [ ] Fail [ ] Blocked — The GM can open the roll request window from the scene-control button.
  - Notes:
- [ ] Pass [ ] Fail [ ] Blocked — Controlled-token targeting preselects currently controlled actors.
  - Notes:
- [ ] Pass [ ] Fail [ ] Blocked — Assigned-character targeting resolves the player character.
  - Notes:
- [ ] Pass [ ] Fail [ ] Blocked — User targeting lists actors owned by the selected user.
  - Notes:

## Characteristic request lifecycle

- [ ] Pass [ ] Fail [ ] Blocked — The GM can send a WFRP4e characteristic request to the player.
  - Notes:
- [ ] Pass [ ] Fail [ ] Blocked — The player prompt appears only on the targeted player client.
  - Notes:
- [ ] Pass [ ] Fail [ ] Blocked — Executing the requested characteristic roll produces the expected WFRP4e chat output.
  - Notes:
- [ ] Pass [ ] Fail [ ] Blocked — The created chat message includes `flags.askaroll.requestId`.
  - Notes:
- [ ] Pass [ ] Fail [ ] Blocked — The created chat message includes Ask A Roll protocol metadata under `flags.askaroll`.
  - Notes:

## Skill request lifecycle

- [ ] Pass [ ] Fail [ ] Blocked — The GM can send a skill request for an available WFRP4e actor skill.
  - Notes:
- [ ] Pass [ ] Fail [ ] Blocked — The player can execute the requested available skill roll.
  - Notes:

## Prompt completion behavior

- [ ] Pass [ ] Fail [ ] Blocked — With selection mode `one`, the player prompt closes after one successful roll.
  - Notes:
- [ ] Pass [ ] Fail [ ] Blocked — With selection mode `all`, the player prompt closes after all requested rolls complete.
  - Notes:

## Security and unsupported-system behavior

- [ ] Pass [ ] Fail [ ] Blocked — A simulated non-GM `request:create` socket message is ignored by the router and creates no player prompt.
  - Notes:
- [ ] Pass [ ] Fail [ ] Blocked — In an unsupported system state, Ask A Roll shows a localized warning and does not render WFRP4e-only roll options.
  - Notes:

## Release follow-up rule

For every failed or blocked manual case, create a specific follow-up issue or code task before release and link it in the case notes.
