# Chat Workflow

![Chat](https://img.shields.io/badge/Chat-local%20sessions-111111?style=flat-square)
![Queued prompts](https://img.shields.io/badge/Prompts-queued-4e5158?style=flat-square)
![Markdown](https://img.shields.io/badge/Markdown-tables%20and%20code-6f747d?style=flat-square)
![Progress](https://img.shields.io/badge/Progress-todo%20cards-202124?style=flat-square)
![Feedback](https://img.shields.io/badge/Feedback-message%20actions-2f3238?style=flat-square)

Coder Desktop uses chat as the main work surface. The chat is not only text. It can show user messages, assistant messages, tool activity cards, image generation cards, todo progress cards, clarification cards, provider error cards, and queued prompts.

> [!NOTE]
> Each chat is an independent session. A message sent in one chat should not make a different chat look like it is working.

## Chats

Chats are stored locally in app state. A chat contains:

- A stable id.
- A short title.
- The provider that handled the latest user message.
- User messages.
- Assistant messages.
- Tool messages.
- Image generation messages.
- Structured cards.
- Created and updated timestamps.

New chats start empty and show the central build state. The first user message gives the chat a generated title.

## Chat Titles

Chat titles should summarize the task, not copy filler words from the prompt.

Examples:

| User request shape | Expected title style |
| --- | --- |
| Create and test a Discord bot file | `Discord bot and testing` |
| Check whether GTA 5 can run | `GTA 5 hardware check` |
| Read or summarize a GitHub repository | `Reading GitHub repository` |
| Find when Codex was installed | `Finding Codex duration` |

The title generator removes common filler words and keeps titles short enough for the sidebar.

## Search

The sidebar search looks through:

- Chat titles.
- Message content.

Search is local. It does not send the query to a provider.

## Queued Prompts

If the user sends another prompt while a chat is already working, Coder Desktop queues it for that same chat.

Queued prompts:

- Stay attached to the chat where they were entered.
- Appear above the composer.
- Can be removed before they run.
- Run automatically after the current message finishes.

> [!IMPORTANT]
> Queued prompts should not jump to a different chat. The queue belongs to a specific chat id.

## Loading State

The sidebar can show that a chat is working. The active chat item uses a subtle neutral border motion instead of a colored pulsing dot.

The conversation surface uses a thinking shimmer while the current chat is waiting for a provider or a tool result.

## Todo Progress Cards

Todo progress cards are used when a task is large enough to need visible steps.

A progress card contains:

- A title.
- Up to twelve task items.
- A status for each item.
- A completion counter.

Item statuses:

| Status | Meaning |
| --- | --- |
| `pending` | The step has not started yet. |
| `active` | The assistant is currently working on the step. |
| `done` | The step is complete. |

The collapsed card shows the active step and the count. Clicking it expands the full task list.

> [!TIP]
> Progress cards should replace long status paragraphs. They help the user see motion without filling the chat with repeated updates.

## Let Me Know Cards

Let me know cards appear when the assistant needs more information to continue safely or correctly.

A clarification card can include:

- Up to five questions.
- Two or three AI-generated options per question.
- One recommended option.
- A custom answer field.
- A submit button.

The user can choose the recommended option, choose another option, or write a custom answer.

> [!NOTE]
> Clarification cards should be used only when the missing information changes the correct implementation. They should not interrupt tasks the assistant can reasonably complete.

## Tool Activity Cards

Tool activity cards show local work without exposing raw tool JSON.

Cards can represent:

- File reads.
- File edits.
- File or folder creation.
- File or folder deletion.
- Shell commands.
- Windows information commands.
- Web search.
- Web page reads.

Cards are compact by default. Clicking a card expands details such as command, path, output, sources, or summaries.

Completed shell and Windows information cards use a check mark and completed wording such as `Ran shell command` or `Got system information`.

## Image Generation Cards

Image generation cards appear when the user asks Coder Desktop to create an image or when the assistant requests an image tool.

Cards show:

- Provider.
- Image model.
- Prompt.
- Generation state.
- Generated image preview when available.
- A readable error when generation fails.

The prompt can be copied from the card. Generated image links can also be copied when the provider returns a link.

## Message Actions

Completed assistant messages show actions on hover:

- Copy.
- Like.
- Dislike.
- Response timing.

Copy writes the full assistant message to the clipboard.

Like and dislike open an optional feedback note. Submitting the note creates a sanitized GitHub issue when GitHub authentication is available on the user's computer.

> [!NOTE]
> Feedback reports are public issues. The app trims message content and removes common secret patterns before reporting.

## Markdown

Assistant messages support Markdown rendering for:

- Paragraphs.
- Headings.
- Bullet lists.
- Numbered lists.
- Quotes.
- Links.
- Inline code.
- Double-backtick inline code.
- Fenced code blocks.
- Tables.
- Horizontal rules.

Code blocks and inline code include copy controls. Tables are wrapped so they can scroll horizontally instead of breaking the layout.

## Copy Controls

Copy buttons are available for:

- Full assistant messages.
- Inline code.
- Fenced code blocks.
- Tool commands.
- File paths.
- Tool output.
- Provider error details.

Copy controls should be compact and quiet. They should not shift the layout when they appear.

## Provider Error Cards

Provider failures are shown as structured cards instead of raw text dumps.

Provider error cards include:

- Provider name.
- Model name when available.
- Status code when available.
- A clear title.
- A readable message.
- A copy button when expanded.

> [!WARNING]
> Provider errors should not expose API keys or private request payloads.
