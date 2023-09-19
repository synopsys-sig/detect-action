# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2023-09-19

### Added

- Add `comment-pr-on-success` input to control PR comments on success

## [1.2.0] - 2023-09-12

### Changed

- Re-add `fail-on-all-policy-severities` input
- Change log level on debug to another key
- Auto-enable diagnostic mode when debug mode is enabled
- Add `fail-if-detect-fails` input to propagate detect error as action failure

## [1.1.0] - 2023-09-11

### Added

- Make `detect-version` optional by downloading latest
- Support major version pattern on `detect-version`

## [1.0.0] - 2023-09-10

### Changed

- Set detect log level to `DEBUG` when action is in debug mode
- Update to latest actions/typescript-action
- Add `CHANGELOG.md` file
- Add `CODE_OF_CONDUCT.md` file
- Add `CONTRIBUTING.md` file
- Improve `README.md`

## [0.4.0] - 2023-08-29

### Added

- Add support for Detect V8
- Add Detect Exit code outputs
- Add `pull_request_target` to pr events

### Changed

- Improve logging
- Update dependencies and refactor action

[Unreleased]: https://github.com/mercedesbenzio/detect-action/compare/v1.3.0...main
[1.3.0]: https://github.com/mercedesbenzio/detect-action/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/mercedesbenzio/detect-action/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/mercedesbenzio/detect-action/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/mercedesbenzio/detect-action/compare/v0.4.0...v1.0.0
[0.4.0]: https://github.com/mercedesbenzio/detect-action/releases/tag/v0.4.0
