# Image Generation

![Images](https://img.shields.io/badge/Images-chat%20generation-111111?style=flat-square)
![Providers](https://img.shields.io/badge/Provider-NVIDIA%20FLUX-4e5158?style=flat-square)
![Count](https://img.shields.io/badge/Images-1%20to%203-6f747d?style=flat-square)
![Version](https://img.shields.io/badge/Added%20in-0.0.15-202124?style=flat-square)

Image generation was added in Coder Desktop `0.0.15` and remains available in the current app. A user can ask for an app mockup, icon direction, documentation image, game concept, visual reference, or asset idea without leaving the desktop workspace.

## Provider Setup

Image generation is handled through NVIDIA FLUX models. The NVIDIA provider card includes image generation settings:

- Scan and add image models.
- Current scan status.
- Available image model choices.
- Selected image model.
- A clear no-model state when NVIDIA image models are unavailable.

OpenAI and Claude do not expose native image generation choices in the current app. Their provider cards point users to NVIDIA FLUX for image output.

NVIDIA includes known FLUX model defaults. `flux.2-klein-4b` uses the OpenAI-compatible image endpoint. FLUX.1 hosted models such as `black-forest-labs/flux_1-dev` and `black-forest-labs/flux_1-schnell` use NVIDIA's GenAI endpoint.

> [!NOTE]
> Provider model availability can vary by account, endpoint, and region. The scan reads the configured provider endpoint instead of assuming every account has the same image models.

## Chat Image Requests

When the user asks for an image, Coder Desktop creates an image generation card. The user can request one, two, or three images. The app clamps image counts to a maximum of three and stops after the requested count is complete.

The card shows:

- Prompt.
- Generation state.
- Generated image preview or previews.
- Copy image link actions.
- Error details when generation fails.

The card can copy the image prompt and each generated image link. Provider and model details are kept out of the visible card layout so the response stays focused on the image request.

## Fallback Behavior

Coder Desktop first tries the selected NVIDIA FLUX image model. If that model fails, it continues through configured NVIDIA FLUX fallback models until one succeeds or every compatible model fails.

Assistant-generated image tool requests are not allowed to switch image generation away from NVIDIA FLUX. If an assistant request accidentally names another provider, the image card still uses NVIDIA FLUX when NVIDIA is configured.

When generation still fails, the card stays visible with one readable error instead of repeating individual provider failures in the chat.

## Assistant Tooling

The assistant can request image generation through the chat tool path when a visual output is needed. This keeps image work in the same conversation as coding, planning, debugging, and documentation.

The assistant must not generate before required visual details are available. If the request needs clarification, it should ask first. After the requested number of images is complete, it should stop instead of generating more images or asking follow-up questions that trigger extra image work.

The assistant should write specific image prompts with:

- Subject.
- Style.
- Composition.
- Color direction.
- Constraints.
- What to avoid when relevant.
