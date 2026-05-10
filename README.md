# Ask A Roll

Ask A Roll is a Foundry VTT module for Game Masters who want to request rolls from their players.

The current module targets WFRP4e and Foundry VTT 13. It is built with TypeScript, Vite, and Bun.

## Compatibility

- Foundry VTT: 13 only
- System: WFRP4e

This scope is defined in `src/module.json`.

## Quick Start

Install dependencies:

```bash
bun install
```

Build the module:

```bash
bun run build
```

Watch and rebuild during development:

```bash
bun run watch
```

The build writes the distributable module to `dist/`.

## Project Layout

- `src/module.json`: Foundry manifest source of truth.
- `src/ts/module.ts`: Runtime entry point loaded by Foundry.
- `src/ts/lifecycle/`: Foundry hook setup.
- `src/ts/domain/`: Roll request domain types and validation.
- `src/ts/services/`: Request, recipient, roll, and notification logic.
- `src/ts/socket/`: GM/player socket messages and routing.
- `src/ts/systems/`: System adapter boundary.
- `src/ts/systems/wfrp4e/`: WFRP4e roll support.
- `src/ts/ui/`: GM and player application UI.
- `src/styles/`: SCSS bundled into `dist/style.css`.
- `src/templates/` and `src/languages/`: Copied into `dist/` during build.

## Build Notes

`bun run build` runs TypeScript checking first, then Vite.

Vite builds `src/ts/module.ts` into `dist/scripts/module.js`, emits `dist/style.css`, copies templates and languages, and generates `dist/module.json`.

Do not edit files in `dist/` by hand. Update source files under `src/` instead.

## License

MIT.
