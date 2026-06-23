# Future Features

![Future features](https://img.shields.io/badge/Future%20features-confirmed%20roadmap-111111?style=flat-square)
![Current version](https://img.shields.io/badge/Current%20version-0.0.38-2f3238?style=flat-square)
![Status](https://img.shields.io/badge/Status-planned-4e5158?style=flat-square)

This page lists confirmed upcoming Coder Desktop features. These dates are **predicted targets**, not guaranteed release dates. The goal is to give users a clear look at what is planned without turning future work into full feature documentation before it ships.

When a feature is released, it should move into the normal feature guides, release notes, and changelog.

## Shipped In 0.0.15

These roadmap items moved into implemented feature guides:

- In-app image models. See [image generation](features/image-generation.md).
- Auto bug report system. See [feedback and reporting](features/feedback-and-reporting.md).

## Skills

**Predicted target:** Before June 7, 2026

**Priority:** Low

Skills will let Coder Desktop use specific instruction sets or data text for focused tasks. A skill can teach the AI how to perform a certain kind of work, follow a repeatable workflow, or take on a specific persona for a chat.

This should make advanced behavior easier to reuse. Instead of writing the same long instructions every time, users could rely on saved skills for things like code review style, documentation tone, release preparation, UI polish, provider setup, or project-specific rules.

Skills should stay clear and inspectable. Users should be able to understand what a skill is telling the AI before they use it. The feature should improve consistency without hiding important behavior from the user.

## Automations

**Predicted target:** Before June 9, 2026

**Priority:** Low

Automations will let users schedule tasks that Coder Desktop can run automatically. A user should be able to create a daily, weekly, or custom schedule, give the automation a specific instruction, and let the app start the work in a new chat when the selected time arrives.

This feature is meant for repeated work that users do not want to start manually every time. Examples could include checking a project each morning, reviewing release readiness, summarizing recent changes, running planned diagnostics, or preparing a recurring status note.

If Coder Desktop is closed, the computer is asleep, or another interruption prevents the task from running on time, the app should queue the missed automation safely. When Coder Desktop opens again, or when the interruption is gone, overdue automations should run as soon as possible if their selected time has already passed.

Automations should be careful and visible. Users should be able to see what is scheduled, what ran, what was queued, and what failed. Sensitive work should still respect Coder Desktop's security controls instead of becoming hidden background behavior.

## Expanded AI Providers

**Predicted target:** By June 9, 2026

**Priority:** Low

Coder Desktop will add support for more AI provider options so users can choose the services that fit their work, pricing, speed, and model preferences. Planned providers include Gemini, OpenRouter, DeepSeek, Grok, and Groq.

This should make Coder Desktop more flexible without changing the core workflow. Users should still be able to choose a primary provider, configure API keys locally, select models, and keep provider setup inside the same calm settings experience.

Provider expansion should follow the same security model as the current provider system. API keys should stay out of public renderer state, provider base URLs should be validated, and provider errors should appear as readable cards instead of raw technical dumps.

## Coder Desktop Remote

**Predicted target:** June 11, 2026

**Priority:** Low

Coder Desktop Remote is planned as an Android-only mobile companion. Users will be able to install it for quick access to the AI from a mobile device, then prompt Coder Desktop to work on projects while they are away from their computer.

This feature has a lower priority because it is not a major desktop workflow change. The main app still matters most. Remote access should support the desktop experience, not distract from the core product.

The mobile app should be useful for quick prompts, checking task progress, sending follow-up instructions, and keeping work moving when the user is not sitting at the computer. A user might ask Coder Desktop to continue a project task, review a file later, run a planned check, or summarize what happened while they were away.

This is not planned as a full mobile coding environment. Phones are not a good place for serious project editing, large file navigation, or terminal-heavy development. The phone should be a simple remote control for desktop work while Coder Desktop remains the app that owns files, commands, providers, and local security controls.

*The Android app should make Coder Desktop easier to reach, not turn a phone into the main coding surface.*
