# Provider Setup

![Providers](https://img.shields.io/badge/Providers-OpenAI%20%7C%20Claude%20%7C%20NVIDIA-111111?style=flat-square)
![OpenAI](https://img.shields.io/badge/OpenAI-supported-4e5158?style=flat-square)
![Claude](https://img.shields.io/badge/Claude-supported-6f747d?style=flat-square)
![NVIDIA](https://img.shields.io/badge/NVIDIA-supported-202124?style=flat-square)
![API keys](https://img.shields.io/badge/API%20keys-stored%20locally-2f3238?style=flat-square)

Coder Desktop supports multiple AI provider configurations so users can choose the service that fits their workflow. Provider settings are managed inside the desktop app and stored locally.

This document explains how provider configuration works and what to check when a provider is not responding as expected.

> [!NOTE]
> Provider setup controls where chat content and selected context are sent. Local tools stay under the desktop app, but provider requests still go to the configured external or local endpoint.

> [!IMPORTANT]
> Keep provider keys out of Git, screenshots, logs, release notes, issue templates, and public support threads.

## Supported Providers

Coder Desktop supports these provider families:

| Provider | Default base URL | Request style |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | Chat completions |
| Claude | `https://api.anthropic.com/v1` | Messages |
| NVIDIA | `https://integrate.api.nvidia.com/v1` | OpenAI-compatible chat completions |

Each provider has:

- Enabled state.
- Model name.
- Up to three fallback models.
- Reasoning effort when the selected model supports reasoning.
- Base URL.
- API key status.

The app stores whether a key exists without exposing the raw key in public renderer state.

> [!TIP]
> Start with the default base URL first. Change the base URL only when intentionally using a trusted compatible gateway or local development endpoint.

## General Setup Flow

1. Open Coder Desktop.
2. Open settings.
3. Choose the provider you want to configure.
4. Enter the provider API key.
5. Confirm the model name.
6. Add fallback models when you have trusted alternatives.
7. Confirm reasoning effort when the model supports it.
8. Confirm the base URL.
9. Select the active provider.
10. Send a test message.

If the provider responds, the app records the assistant message in the active chat.

## OpenAI

OpenAI uses the default base URL:

```text
https://api.openai.com/v1
```

The expected request style is chat completions.

> [!NOTE]
> The OpenAI configuration uses an OpenAI-compatible chat completions request shape.

Common setup notes:

- Use an API key from your OpenAI account.
- Make sure the selected model is available to the account and project.
- Keep the base URL unchanged unless you intentionally use a compatible gateway.
- If a custom endpoint is used, it should still support the expected chat completions shape.

Common issues:

- The API key is missing or expired.
- The model name is not available.
- Billing or project access is not enabled.
- A custom base URL does not support the expected response format.

## Claude

Claude uses the default base URL:

```text
https://api.anthropic.com/v1
```

The expected request style is the Anthropic messages API.

> [!NOTE]
> Claude uses a different request shape than OpenAI-compatible providers, so model and endpoint errors may look different.

Common setup notes:

- Use an API key from the provider account.
- Make sure the selected model is available to the key.
- Keep the base URL on the official provider URL unless intentionally using a trusted compatible gateway.

Common issues:

- The key is not valid.
- The model name is wrong.
- The account does not have access to the model.
- The request format is not accepted by the endpoint.

## NVIDIA

NVIDIA uses the default base URL:

```text
https://integrate.api.nvidia.com/v1
```

The expected request style is OpenAI-compatible chat completions.

> [!NOTE]
> NVIDIA is treated as OpenAI-compatible for request formatting, but model access and model names still come from NVIDIA.

Common setup notes:

- Use a valid NVIDIA API key.
- Confirm the configured model name is available through the account.
- Keep the base URL on the default value unless using a trusted compatible endpoint.

Common issues:

- The key is not authorized for the selected model.
- The model name is incomplete or misspelled.
- The endpoint is unavailable.
- The response format differs from the expected OpenAI-compatible shape.

## API Key Storage

API keys are stored locally by the desktop app. The app separates secret values from public provider settings.

When Electron safe storage is available, keys are encrypted through the operating system. If safe storage is unavailable, the key is still stored locally and should be treated with the same caution as any developer credential file.

Do not commit API keys to Git. Do not place them in documentation, release notes, issue templates, or screenshots.

> [!CAUTION]
> If a key appears in a public place, rotate it with the provider. Deleting the message is not enough once the secret may have been copied.

## Base URL Rules

Provider base URLs are sanitized before use.

The app allows secure provider URLs and restricts plain `http` URLs to local hosts. This allows local development servers while reducing the chance of sending provider traffic to an unsafe remote endpoint.

> [!WARNING]
> A custom base URL can redirect provider traffic. Use custom endpoints only when you trust the gateway and understand what data it receives.

Examples of acceptable local development URLs:

```text
http://localhost:11434/v1
http://127.0.0.1:11434/v1
```

Examples that should not be used:

```text
file:///tmp/provider
http://example.com/v1
```

## Model Names

Model names are provider-specific. The app does not assume every account has every model.

When changing models:

- Use the exact provider model identifier.
- Confirm the account has access.
- Test with a short message before using the model for longer work.
- Keep a known working model name available for fallback.

## Fallback Models

Each provider can store up to three fallback models. Coder Desktop tries the primary model first, then each fallback model in order when the failure is likely temporary.

Fallbacks are useful for:

- Provider timeouts.
- Rate limits.
- Temporary server errors.
- Gateway errors.
- Slow model availability.

Fallbacks do not replace correct configuration. A missing API key, wrong base URL, or model the account cannot access should still be fixed in settings.

## Reasoning Effort

Reasoning effort controls appear when the model name looks reasoning-capable, such as OpenAI reasoning models or NVIDIA `gpt-oss` models.

Available values are:

- None.
- Low.
- Medium.
- High.

OpenAI-compatible requests send `reasoning_effort` only when the selected model appears to support that option.

## Troubleshooting

If a provider fails, check these items first:

- Is the provider enabled?
- Is it selected as the active provider?
- Is the API key present?
- Is the model name valid?
- Is the base URL correct?
- Does the account have model access?
- Is the network available?
- Is the provider API currently available?

If the app returns a provider error, read the message carefully. The app should avoid exposing secrets, but the error may still include enough information to identify a model, authentication, or endpoint issue.

## Local-First Expectations

Coder Desktop keeps local tools under the desktop app, but provider calls still send chat content and selected context to the configured provider. Users should treat provider selection as a data decision.

> [!IMPORTANT]
> Local-first does not mean every prompt stays on the machine. It means local files and tools stay under the desktop app's control unless the user chooses what context to send.

Before sending sensitive project details to a provider:

- Review which provider is active.
- Review the model setting.
- Review the base URL.
- Review the prompt and attached context.
- Confirm the provider is trusted for that material.

## Adding Future Providers

New providers should be added through:

- A stable provider identifier.
- Default provider settings.
- Sanitized provider configuration.
- A main-process request implementation.
- Tests for provider helpers.
- Clear documentation.

Provider support should stay explicit so users understand where their data is going.
