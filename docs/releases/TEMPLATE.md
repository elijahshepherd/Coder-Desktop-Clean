# Release Notes Template

All release notes in `docs/releases/{version}.md` must follow this format. The GitHub Actions publish workflow uses this file as the release body.

> Must be simple, not too technical. Just because a change is listed in Highlights does not mean it should be removed from its main section. A change can appear in multiple sections, such as being listed in Added and also mentioned in Highlights.

---

## Required Format

```
# {Five-word summary}

Short 1 sentence explaining the change.

---

## Highlights

- Key user-facing change
- Another highlight

## Added

- New feature or capability
- New platform support

## Removed

- Deprecated feature removed
- Artifact type no longer produced

## Fixed

- Button not working

## Other Changes

- Internal refactor
- Build improvement
- Dependency update


```
