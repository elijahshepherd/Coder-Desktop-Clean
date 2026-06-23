# Security Policy

Coder Desktop is a local-first desktop application that works with user workspaces, provider keys, security settings, updates, and future local tools. Security reports are taken seriously because the app is designed to run on real developer machines.

## Supported Releases

Security review is focused on the latest public release and the current `main` branch. Older releases may receive clarification or documentation updates, but fixes are normally made in the latest release line.

If you are using an older release, update to the latest public release before reporting unless the issue is specifically about an older artifact or upgrade path.

## What To Report

Please report issues such as:

- Future workspace file access outside the selected workspace.
- Symlink or path traversal bypasses in future file tools.
- Shell execution bypasses in future shell tools.
- Provider key exposure.
- Unsafe IPC behavior.
- Unsafe update download behavior.
- Release artifact tampering.
- Packaged app behavior that differs from source expectations.

## What Not To Include Publicly

Do not publish sensitive details in public issues, including:

- API keys.
- Private workspace files.
- Exploit payloads that can be copied directly.
- Credentials.
- Private logs with secrets.
- Personal information.

If a report needs sensitive detail, use a private reporting channel when available.

## Reporting A Vulnerability

Use GitHub private security advisories when available, or contact the maintainer directly.

Include:

- A concise summary.
- Affected release or commit.
- Operating system.
- Reproduction steps.
- Expected impact.
- Any relevant logs or screenshots with secrets removed.
- Suggested mitigation if known.

Clear reports are easier to verify and fix.

## Response Expectations

The maintainer will review reports as availability allows. Valid issues may lead to:

- A code fix.
- A configuration change.
- A release update.
- A documentation update.
- A public advisory when appropriate.

Not every report will be treated as a vulnerability. Some reports may be handled as hardening requests or documentation issues.

## Security Documentation

More detail about the app security model is available in [docs/security.md](docs/security.md).
