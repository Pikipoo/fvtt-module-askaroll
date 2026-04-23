# Changelog

All notable changes to this project will be documented in this file.

## [v0.0.1] - 2026-04-23

First tagged release of Ask A Roll. This version establishes the module package, release pipeline, and an initial in-Foundry UI scaffold.

### Added

- Initial public release of the `Ask A Roll` module.
- Added a button in the Actor Directory sidebar to open the module window.
- Added a localized module window with a basic interactive placeholder UI.
- Added English localization entries and module metadata for Foundry VTT.
- Added an MIT license for the project.

### Improved

- Updated the module configuration to target Foundry VTT 13 and the `wfrp4e` system.
- Cleaned up project structure and typings to match the Ask A Roll module naming and setup.
- Added automated release packaging so GitHub releases can publish the built module files directly.

### Fixed

- Corrected the build output path and bundled entry file so the module ships with the expected runtime files.
- Aligned the packaged version metadata to `0.0.1`.

### Notes

- `v0.0.1` is primarily a bootstrap release: it prepares the module for installation and future feature work, but the core roll-request functionality is still at an early stage.
