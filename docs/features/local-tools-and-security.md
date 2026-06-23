# Local Tools And Security

![Local tools](https://img.shields.io/badge/Local%20tools-main%20process-111111?style=flat-square)
![Files](https://img.shields.io/badge/Files-read%20edit%20create%20delete-4e5158?style=flat-square)
![Shell](https://img.shields.io/badge/Shell-enabled%20by%20permission-6f747d?style=flat-square)
![Web](https://img.shields.io/badge/Web-search%20and%20fetch-202124?style=flat-square)
![Security](https://img.shields.io/badge/Security-access%20modes-2f3238?style=flat-square)

Coder Desktop local tools are owned by the Electron main process. The renderer displays activity and sends requests through the preload bridge, but it does not directly read files, write files, run commands, fetch updates, or access provider secrets.

> [!IMPORTANT]
> Local tool permissions are real behavior controls. They are not only visual settings.

> [!NOTE]
> Version `0.0.38` keeps runtime keyword auto-runs removed. User text alone does not start PowerShell, shell, file, web, provider health checks, or image actions. The assistant must explicitly request a Coder Desktop tool, then the main process validates permissions, workspace scope, and access settings before showing the activity card.

## Working Folder Behavior

Coder Desktop keeps a preferred working folder when the user selects one. Local file and shell tools require that selected workspace before they run.

The assistant may also use explicit absolute paths when the user provides them, but those paths must resolve inside the selected workspace. If the work belongs somewhere else, the user should choose that folder as the workspace first.

> [!CAUTION]
> Absolute paths make the app more useful, but they also require clear permission settings, visible tool cards, and selected-workspace boundaries. Sensitive actions should stay visible.

## File Reading

When file reading is enabled, the assistant can request:

- File listing.
- File content reads.
- Folder inspection.

File reads return compact tool context to the provider. The UI shows a card so the user can see what was inspected.

File reading should:

- Respect the read permission.
- Reject oversized reads.
- Prefer reading before editing.
- Show paths clearly.
- Avoid exposing secrets in unnecessary summaries.

## File Editing

When file editing is enabled, the assistant can request:

- File creation.
- File replacement.
- File deletion.
- Folder creation.
- Folder deletion.

File edits produce diff summaries. The card can show added and removed counts such as `+45 -31`.

> [!NOTE]
> The assistant should create a real file when the user asks for a real file. It should not only paste code into chat unless the user asks for an example.

## Shell Commands

When shell commands are enabled, Coder Desktop can run local commands from the selected workspace.

Shell cards show:

- Command title.
- Command text.
- Exit code.
- Output when expanded.

The shell runner avoids the older PowerShell variable expansion problem for scoped package names such as `@codex`. General shell commands use the native command shell, while Windows information cards remain a separate PowerShell group.

## Windows PowerShell Information Cards

Windows information commands use the `windows-ps-group` tool. This group is for read-only information commands.

Approved examples include:

- `systeminfo`
- `Get-ComputerInfo`
- `Get-CimInstance`
- `ipconfig`
- `tasklist`
- `Get-Process`
- `Get-Service`
- `whoami`
- `hostname`
- `Get-Date`
- `Get-NetAdapter`
- `Get-NetIPAddress`

The assistant can request these commands when the user asks for local Windows information. The app validates that the requested command is read-only and approved before it runs.

## Internet Tools

When internet access is enabled, Coder Desktop supports:

- Web search.
- Public web page fetching.
- URL reading when the user provides a link.
- Search cards with source favicons.
- Expandable source lists.

Internet tools are useful for:

- Current documentation.
- Official downloads.
- GitHub repository pages.
- Release notes.
- Public hardware or software requirements.

> [!IMPORTANT]
> Official software installation work should prefer official sources and visible commands. The assistant should not run remote scripts piped into a shell.

## Access Modes

The composer status area includes chat access modes.

| Mode | Behavior |
| --- | --- |
| Ask for approval | Always ask before creating edits or using the internet. |
| Approve for me | Only ask for actions detected as potentially unsafe. |
| Full access | Allow local tools and internet inside app security boundaries. |

Access mode changes update security behavior directly.

## Security Settings

The settings card exposes security controls for:

- File reading.
- File editing.
- Shell commands.
- Internet access.
- Permission prompts.

Each control should explain what it enables in plain language.

## Dangerous Command Guidance

The provider prompt tells the assistant to deny or avoid dangerous requests such as:

- Credential theft.
- Malware.
- Phishing.
- Unauthorized access.
- Security bypass.
- Broad destructive deletion.
- Disk formatting.
- Firewall or antivirus disabling.
- Registry or boot configuration changes.
- Secret exfiltration.

This guidance is intentionally not too strict. Normal development work should still be allowed, including package installation, tests, builds, git inspection, local debugging, documentation reads, and project file edits.

> [!WARNING]
> Security should block genuinely dangerous behavior without making normal development impossible.

## Tool Result Privacy

Tool output can contain sensitive data. The app should:

- Keep outputs compact in chat.
- Avoid showing raw tool JSON.
- Avoid exposing secrets in provider error cards.
- Preserve copy controls for the user.
- Keep tool activity visible.

## Extension Status

Extensions are not part of the active feature set. If extension loading returns later, it should have a clear purpose, trusted manifest rules, user documentation, and a visible security control.
