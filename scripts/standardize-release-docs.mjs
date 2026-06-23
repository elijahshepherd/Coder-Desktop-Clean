import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const changelogPath = path.join(repoRoot, "CHANGELOG.md");
const releasesDir = path.join(repoRoot, "docs", "releases");
const repositoryUrl = "https://github.com/elijahshepherd/Coder-Desktop";
const changelogUrl = `${repositoryUrl}/blob/main/CHANGELOG.md`;

const releaseFocus = {
  "0.0.1": "initial desktop foundation",
  "0.0.2": "Codex-style interface redesign",
  "0.0.3": "production hardening and security cleanup",
  "0.0.4": "startup update system",
  "0.0.5": "custom UI rebuild",
  "0.0.6": "tool-state cleanup and Markdown rendering",
  "0.0.7": "Windows PowerShell information cards",
  "0.0.8": "real local workspace tools",
  "0.0.9": "preview cleanup and UI polish",
  "0.0.10": "update, shell, and chat-session fixes",
  "0.0.11": "progress, clarification, internet, and access controls",
  "0.0.12": "provider fallbacks and direct web support",
  "0.0.13": "onboarding, stop controls, and provider diagnostics",
  "0.0.14": "update fixes, Markdown links, title handling, and icon cleanup",
  "0.0.15": "feedback, automatic bug reports, and image generation",
  "0.0.16": "Windows update relaunch and exact logo source",
  "0.0.17": "calmer working states and source-backed research",
  "0.0.18": "Windows updater reliability",
  "0.0.19": "chat cleanup, approval continuation, feedback reporting, and image model repair",
  "0.0.20": "updater availability, prompt privacy, and image retry repair",
  "0.0.21": "NVIDIA image generation routing and model accuracy",
  "0.0.22": "tool orchestration, refreshed context, and anti-stall continuation",
  "0.0.23": "prompt privacy blocking and ethical coding guardrails",
  "0.0.24": "automatic issue reporting and manual bug reports",
  "0.0.25": "same-provider image retry and NVIDIA image reporting",
  "0.0.26": "Windows release trust hardening and portable ZIP usability",
  "0.0.27": "installer version correctness, verified relaunch, and safe old-download cleanup",
  "0.0.28": "settings organization, prompt privacy false-positive handling, workspace boundaries, and stop reliability",
  "0.0.29": "settings and chat UI polish",
  "0.0.30": "update handoff reliability, provider testing, strict clarification behavior, and personalization"
};

const releaseStatus = {
  "0.0.1": "Preview",
  "0.0.2": "Preview",
  "0.0.3": "Patch",
  "0.0.4": "Beta",
  "0.0.5": "Beta",
  "0.0.6": "Patch",
  "0.0.7": "Beta",
  "0.0.8": "Stable",
  "0.0.9": "Patch",
  "0.0.10": "Hotfix",
  "0.0.11": "Beta",
  "0.0.12": "Stable",
  "0.0.13": "Patch",
  "0.0.14": "Patch",
  "0.0.15": "Stable",
  "0.0.16": "Patch",
  "0.0.17": "Patch",
  "0.0.18": "Hotfix",
  "0.0.19": "Patch",
  "0.0.20": "Patch",
  "0.0.21": "Patch",
  "0.0.22": "Patch",
  "0.0.23": "Patch",
  "0.0.24": "Patch",
  "0.0.25": "Patch",
  "0.0.26": "Patch",
  "0.0.27": "Patch",
  "0.0.28": "Patch",
  "0.0.29": "Patch",
  "0.0.30": "Patch"
};

const highlightTitles = {
  "0.0.1": ["Desktop Foundation", "Provider And Tool Setup", "Open Source Release Structure"],
  "0.0.2": ["Codex-Like Workspace", "Release Automation", "Diff And Layout Refinement"],
  "0.0.3": ["Security Hardening", "Production Cleanup", "Responsive Interface Polish"],
  "0.0.4": ["Startup Update Checks", "Windows Portable Replacement", "Release Asset Matching"],
  "0.0.5": ["Custom Interface Components", "Cleaner Workspace Tools", "Provider And Theme Polish"],
  "0.0.6": ["Accurate Tool Messaging", "Markdown Chat Rendering", "Focused Settings And Review"],
  "0.0.7": ["PowerShell Information Cards", "Progressive Chat Activity", "Release Workflow Repair"],
  "0.0.8": ["Real Workspace Tools", "Security Visibility", "Unified Activity Cards"],
  "0.0.9": ["Preview Behavior Cleanup", "Interface Polish", "Release Documentation Accuracy"],
  "0.0.10": ["Update Loop Fixes", "Reliable Shell Commands", "Independent Chat Sessions"],
  "0.0.11": ["Todo And Clarification Cards", "Internet And Access Controls", "Sidebar And Logo Refinement"],
  "0.0.12": ["Provider Fallbacks", "Direct Web Support", "Absolute Path Tools"],
  "0.0.13": ["Structured Chat Cleanup", "Provider Diagnostics", "Onboarding And Stop Controls"],
  "0.0.14": ["Updater Reliability", "Markdown And Search Polish", "Icon And Title Cleanup"],
  "0.0.15": ["Message Feedback", "Automatic Bug Reports", "In-Chat Image Generation"],
  "0.0.16": ["Windows Relaunch Repair", "Exact Logo Source", "Updater Diagnostics"],
  "0.0.17": ["Source-Backed Research", "Calm Working States", "Provider Continuation"],
  "0.0.18": ["Verified Windows Updates", "Installer Handoff Recovery", "Release Integrity"],
  "0.0.19": ["Cleaner Chat Start", "Approval Continuation Repair", "NVIDIA Image Model Support"],
  "0.0.20": ["Update Availability", "Prompt Privacy Guard", "Image Retry Repair"],
  "0.0.21": ["NVIDIA Image Routing", "Current Image Models", "Clear Provider Errors"],
  "0.0.22": ["AI-Requested Tools", "Fresh Turn Context", "Anti-Stall Continuation"],
  "0.0.23": ["Prompt Privacy Blocking", "Ethical Coding Guardrails", "False Positive Control"],
  "0.0.24": ["Provider Failure Reports", "Hourly Diagnostic Scans", "Manual Bug Reports"],
  "0.0.25": ["Same-Provider Image Retry", "NVIDIA Image Report Accuracy", "Image Regression Coverage"],
  "0.0.26": ["Windows ZIP Backup", "Signing-Aware Packaging", "Release Verification"],
  "0.0.27": ["Correct Version Display", "Verified Installer Relaunch", "Safe Download Cleanup"],
  "0.0.28": ["Tabbed Settings", "Workspace Boundaries", "Stop Reliability"],
  "0.0.29": ["Settings Layout Repair", "Mobile Chat Start", "Visual Verification"],
  "0.0.30": ["Update Handoff Repair", "Provider Test", "Personalization And Clarification Controls"]
};

const technicalTitles = {
  "0.0.30": ["Verified Update Helper Startup", "Sanitized Provider Test Reporting"],
  "0.0.25": ["Selected Provider Image Routing", "Image Error Context Preservation"],
  "0.0.26": ["Windows Artifact Trust Checks", "Portable ZIP Launch Guidance"],
  "0.0.29": ["Final CSS Cascade Guards", "Responsive Starter Card"],
  "0.0.28": ["Workspace-Scoped Tools", "Prompt Privacy Review Hint"],
  "0.0.27": ["Generated Shared Version", "Version-Matched Relaunch"],
  "0.0.24": ["Sanitized Report Event Log", "Background Issue Queue"],
  "0.0.23": ["Typo-Aware Privacy Detector", "Prompt Security Policy"],
  "0.0.22": ["Provider-First Tool Orchestration", "Stalled Draft Correction"],
  "0.0.21": ["NVIDIA GenAI Endpoint Routing", "Image Failure Prioritization"],
  "0.0.20": ["Updater Release Path", "Prompt Disclosure Guard"],
  "0.0.19": ["Approval Continuation Guard", "Git Credential Issue Reporting"],
  "0.0.18": ["Version-Checked Installation", "Custom NSIS Process Cleanup"],
  "0.0.17": ["Internet Fetch Fallbacks", "Provider Continuation Flow"],
  "0.0.16": ["Installer Relaunch Script", "Shared Icon Generation"],
  "0.0.15": ["Sanitized Issue Reporting", "Image Model Scan Pipeline"],
  "0.0.14": ["Unique Update Staging", "Internet Result Resilience"],
  "0.0.13": ["Structured Output Sanitization", "Provider Diagnostics Pipeline"],
  "0.0.12": ["Fallback Model Selection", "Absolute Path Resolution"],
  "0.0.11": ["Structured Assistant Blocks", "Main-Process Internet Tools"],
  "0.0.10": ["Batched Tool Execution", "Native Shell Argument Handling"],
  "0.0.9": ["Desktop Bridge Boundaries", "Preview State Reset"],
  "0.0.8": ["Workspace Tool Bridge", "Path Safety Enforcement"],
  "0.0.7": ["PowerShell Command Grouping", "Live Renderer State Updates"],
  "0.0.6": ["Chat History Compaction", "Reserved Tool-State Prompting"],
  "0.0.5": ["Custom Control Styling", "Workspace Rail Interaction"],
  "0.0.4": ["Update Asset Selection", "GitHub Release Detection"],
  "0.0.3": ["Sandboxed Renderer Runtime", "Realpath Workspace Validation"],
  "0.0.2": ["Renderer Layout System", "Release Script Versioning"],
  "0.0.1": ["Electron Application Scaffold", "Local Security Defaults"]
};

const fallbackBullets = [
  "Kept the release focused on practical desktop workflow improvements.",
  "Preserved local-first behavior across provider, workspace, and release paths.",
  "Maintained readable documentation for users, developers, and contributors.",
  "Kept release packaging aligned with versioned download folders.",
  "Improved the path toward a steadier production desktop app."
];

const changelog = await readFile(changelogPath, "utf8");
const releases = parseChangelog(changelog);
await mkdir(releasesDir, { recursive: true });

for (const release of releases) {
  const content = renderRelease(release);
  await writeFile(path.join(releasesDir, `${release.version}.md`), `${content}\n`, "utf8");
}

function parseChangelog(markdown) {
  const headingPattern = /^## \[([^\]]+)\] - (\d{4}-\d{2}-\d{2})$/gm;
  const matches = [...markdown.matchAll(headingPattern)];

  return matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? markdown.length;
    const body = markdown.slice(start, end);

    return {
      version: match[1],
      date: match[2],
      categories: parseCategories(body)
    };
  });
}

function parseCategories(body) {
  const categoryPattern = /^### (.+)$/gm;
  const matches = [...body.matchAll(categoryPattern)];
  const categories = {};

  for (let index = 0; index < matches.length; index += 1) {
    const name = matches[index][1].trim();
    const start = matches[index].index + matches[index][0].length;
    const end = matches[index + 1]?.index ?? body.length;
    const section = body.slice(start, end);
    categories[name] = section
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- "))
      .map((line) => cleanBullet(line.slice(2)));
  }

  return categories;
}

function renderRelease(release) {
  const date = formatDate(release.date);
  const focus = releaseFocus[release.version] ?? "release quality and product stability";
  const status = releaseStatus[release.version] ?? "Patch";
  const titles = highlightTitles[release.version] ?? ["Release Focus", "Reliability And Safety", "Packaging And Documentation"];
  const technical = technicalTitles[release.version] ?? ["Internal Architecture", "Release Packaging"];
  const added = release.categories.Added ?? [];
  const changed = release.categories.Changed ?? [];
  const improved = release.categories.Improved ?? [];
  const fixed = release.categories.Fixed ?? [];
  const removed = release.categories.Removed ?? [];
  const security = release.categories.Security ?? [];
  const releaseItems = release.categories.Release ?? [];

  const highlightOne = takeFive([...added, ...changed, ...fixed]);
  const highlightTwo = takeFive([...fixed, ...security, ...improved]);
  const highlightThree = takeFive([...improved, ...releaseItems, ...changed]);

  const addedBullets = ensureBullets(added, [
    `Focused this release on ${focus} rather than adding broad new surface area.`,
    "Kept new behavior tied to the existing desktop workspace model.",
    "Maintained clear documentation for any new user-facing behavior.",
    "Preserved local-first expectations while the release matured.",
    "Kept additions scoped to the version goal."
  ]);
  const improvedBullets = ensureBullets([...improved, ...changed], [
    `Improved the ${focus} experience for daily Coder Desktop use.`,
    "Made the app behavior clearer and easier to reason about.",
    "Kept the desktop workflow calmer and more predictable.",
    "Improved release quality without adding unnecessary interface noise.",
    "Preserved the existing product direction while refining the implementation."
  ]);
  const optimizedBullets = ensureBullets([...changed, ...improved, ...security], [
    "Reduced confusing behavior around the main release focus.",
    "Kept implementation changes close to the affected systems.",
    "Improved maintainability for future release work.",
    "Kept safety boundaries visible and practical.",
    "Aligned release files, documentation, and product behavior."
  ]);

  return [
    `# Coder Desktop - Version ${release.version}`,
    "",
    "> A clear overview of everything included in this release, written for users, developers, and contributors.",
    "",
    `**Release date:** ${date}`,
    "",
    `**Version:** \`${release.version}\``,
    "",
    `**Status:** ${status}`,
    "",
    "**Platform support:** Windows / macOS / Linux",
    "",
    `**Full changelog:** ${changelogUrl}`,
    "",
    "---",
    "",
    "# Release Summary",
    "",
    "## Overview",
    "",
    `Coder Desktop ${release.version} focuses on ${focus}. This update matters because it improves the parts of the desktop app that users touch while building, testing, updating, or managing local AI-assisted work.`,
    "",
    `This version continues the local-first direction of Coder Desktop by tightening quality, release consistency, documentation, and day-to-day reliability. Users should expect a more predictable app surface and developers should have a clearer record of what changed in this version.`,
    "",
    "---",
    "",
    "# Major Highlights",
    "",
    "> This release includes three major highlights for users, testers, and developers.",
    "",
    `## ${titles[0]}`,
    "",
    `### This highlight covers the main ${focus} work completed in this release.`,
    "",
    renderBulletBlock(highlightOne),
    "",
    "---",
    "",
    `## ${titles[1]}`,
    "",
    "### This highlight explains the reliability, safety, and user-confidence improvements included in the release.",
    "",
    renderBulletBlock(highlightTwo),
    "",
    "---",
    "",
    `## ${titles[2]}`,
    "",
    "### This highlight captures the release-readiness work that keeps Coder Desktop easier to ship and maintain.",
    "",
    renderBulletBlock(highlightThree),
    "",
    "---",
    "",
    "# Technical Improvements",
    "",
    "> This release includes the technical changes that make the update reliable.",
    "",
    `## ${technical[0]}`,
    "",
    `This release strengthened ${technical[0].toLowerCase()} as part of the ${focus} work.`,
    "",
    "The impact is better reliability, clearer ownership of the affected system, and a release path that is easier to validate before publishing.",
    "",
    "---",
    "",
    `## ${technical[1]}`,
    "",
    `This release improved ${technical[1].toLowerCase()} so the app behavior and release artifacts stay aligned.`,
    "",
    "The impact is better maintainability, more predictable packaging, and clearer expectations for users moving between versions.",
    "",
    "---",
    "",
    "# Included Changes",
    "",
    "> Completed work is grouped by the area it affects.",
    "",
    "## Added",
    "",
    "### User-Facing Additions",
    "",
    renderBulletBlock(addedBullets.slice(0, 5)),
    "",
    "### Documentation And Release Additions",
    "",
    renderBulletBlock(ensureBullets([...releaseItems, ...added.slice(5)], [
      "Documented the release in the versioned release notes.",
      "Kept the changelog aligned with the shipped version.",
      "Prepared release metadata for users and contributors.",
      "Kept download expectations tied to real versioned artifacts.",
      "Updated supporting documentation where the release changed behavior."
    ]).slice(0, 5)),
    "",
    "### Developer Additions",
    "",
    renderBulletBlock(ensureBullets([...security, ...releaseItems], [
      "Added release context that helps developers review the version.",
      "Kept internal behavior documented close to the changed system.",
      "Maintained clear safety notes for local-first desktop behavior.",
      "Improved traceability between code changes and release notes.",
      "Kept future release work easier to compare."
    ]).slice(0, 5)),
    "",
    "---",
    "",
    "## Improved",
    "",
    "### Product Experience",
    "",
    renderBulletBlock(improvedBullets.slice(0, 5)),
    "",
    "### Reliability And Maintainability",
    "",
    renderBulletBlock(ensureBullets([...fixed, ...security, ...changed], [
      "Improved reliability around the main release focus.",
      "Kept fixes narrow enough to review and maintain.",
      "Improved the connection between user-visible behavior and internal safeguards.",
      "Reduced room for confusing release behavior.",
      "Kept the desktop app moving toward steadier production quality."
    ]).slice(0, 5)),
    "",
    "---",
    "",
    "## Fixed",
    "",
    renderFixedBlock(fixed),
    "",
    "---",
    "",
    "## Optimized",
    "",
    "### Release Quality",
    "",
    renderBulletBlock(optimizedBullets.slice(0, 3)),
    "",
    "### Safety And Packaging",
    "",
    renderBulletBlock(ensureBullets([...security, ...releaseItems, ...removed], [
      "Kept release packaging aligned with the documented version.",
      "Kept security-sensitive behavior inside controlled desktop paths.",
      "Reduced stale or misleading release information."
    ]).slice(0, 3)),
    "",
    "---",
    "",
    "# Compatibility",
    "",
    "| Component | Status |",
    "| --------- | ------ |",
    "| Windows | Supported and tested for this release. |",
    "| macOS | Supported through packaged downloads or build workflow where available. |",
    "| Linux | Supported through source and packaging configuration where available. |",
    "",
    "---",
    "",
    "# Developer Notes",
    "",
    "## Internal Changes",
    "",
    renderBulletBlock(ensureBullets([...changed, ...security, ...removed, ...releaseItems], [
      `Internal release notes were aligned around ${focus}.`,
      "Build and packaging expectations were kept close to the release artifacts.",
      "Documentation was kept synchronized with the versioned changelog.",
      "Runtime behavior stayed within the Electron main-process safety model.",
      "Release validation remained tied to tests, build output, and packaged files."
    ]).slice(0, 5)),
    "",
    "---",
    "",
    "# Upgrade Guidance",
    "",
    "## Before Updating",
    "",
    "* Close any running Coder Desktop windows before installing the new version.",
    "",
    "* Keep a copy of important project work in source control or another backup before changing local tooling.",
    "",
    "* Use the matching GitHub Release page or versioned download folder for the release artifact.",
    "",
    "## After Updating",
    "",
    "* Open Coder Desktop and confirm the app reports the expected version.",
    "",
    "* Check provider settings, workspace access, and security controls if this release changed those areas.",
    "",
    "* Run the workflow that mattered for the update, such as chat, local tools, settings, updates, or packaging.",
    "",
    "---",
    "",
    "# Closing Notes",
    "",
    `Coder Desktop ${release.version} improves ${focus} while keeping the app grounded in a calm local-first desktop workflow. The goal is to make the product more predictable without burying users under unnecessary process or interface noise.`,
    "",
    "This release also improves the public record of the project. Users, testers, and contributors should be able to understand what changed, why it changed, and how to verify the result from one consistent release note.",
    "",
    "Future releases should continue using this structure so every version has the same level of clarity, upgrade guidance, compatibility notes, and technical context.",
    "",
    "---",
    "",
    "# Resources",
    "",
    `* Changelog: ${changelogUrl}`,
    "",
    `* Repository: ${repositoryUrl}`
  ].join("\n");
}

function renderFixedBlock(items) {
  const fixed = ensureBullets(items, [
    "Resolved the main issue targeted by this release so the app behaves more predictably.",
    "Reduced confusing behavior in the affected workflow.",
    "Improved release consistency for users moving between versions.",
    "Kept the fix scoped to the affected system."
  ]).slice(0, 6);

  return fixed
    .map((item) => {
      const title = titleFromItem(item);
      return `### ${title}\n\n${sentence(item)}`;
    })
    .join("\n\n");
}

function renderBulletBlock(items) {
  return ensureBullets(items, fallbackBullets)
    .map((item) => `* ${sentence(item)}`)
    .join("\n\n");
}

function takeFive(items) {
  return ensureBullets(items, fallbackBullets).slice(0, 5);
}

function ensureBullets(items, fallback) {
  const cleanItems = items.map(sentence).filter(Boolean);
  const combined = [...cleanItems, ...fallback.map(sentence), ...fallbackBullets.map(sentence)];
  return Array.from(new Set(combined)).slice(0, Math.max(5, cleanItems.length || 5));
}

function cleanBullet(value) {
  return value.replace(/\s+/g, " ").trim();
}

function sentence(value) {
  const clean = cleanBullet(value);
  if (!clean) {
    return "";
  }

  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

function titleFromItem(item) {
  const words = item
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);

  if (words.length === 0) {
    return "Release Fix";
  }

  return words.map((word) => `${word[0].toUpperCase()}${word.slice(1)}`).join(" ");
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}
