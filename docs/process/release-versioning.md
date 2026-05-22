# Release And Versioning Notes

## Current Policy

Crew currently uses manual versioning.

The important plugin version files are:

- `.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`

These should stay in sync for user-visible plugin releases.

## Update Model

Claude Code installs plugin versions from a specific source state and does not auto-update this plugin for the user.

That means the practical release loop is:

1. make a user-visible plugin change
2. bump the plugin version
3. reinstall or update the plugin in Claude Code

## Current CI Guard

CI now checks that the repo version files stay consistent.

The intent is:

- catch forgotten version bumps
- catch mismatched plugin metadata
- keep release state obvious in pull requests

## Current Recommendation

- bump versions for user-visible behavior changes
- do not force automatic version bumps on every merge yet
- prefer a simple manual release rhythm until the product stabilizes further

## Future Options

Later, if release cadence becomes frequent enough, possible upgrades include:

- a scripted version bump command
- auto-bump on merge to `main`
- changelog generation

For now, manual versioning plus CI consistency checks is enough.
