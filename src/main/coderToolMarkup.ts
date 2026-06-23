export function extractCoderToolPayloads(content: string): string[] {
  const normalized = normalizeCoderToolMarkup(content);
  const payloads: string[] = [];
  const closedPattern = /<coder-tool>\s*([\s\S]*?)\s*<\/coder-tool>/gi;
  let match: RegExpExecArray | null;

  while ((match = closedPattern.exec(normalized))) {
    const payload = match[1].trim();

    if (payload) {
      payloads.push(payload);
    }
  }

  if (payloads.length > 0) {
    return payloads;
  }

  const openPattern = /<coder-tool>\s*([\s\S]*)$/i.exec(normalized);
  const openPayload = openPattern?.[1]?.trim();
  return openPayload ? [openPayload] : [];
}

export function stripCoderToolMarkup(content: string): string {
  return normalizeCoderToolMarkup(content)
    .replace(/<\|tool_calls_section_begin\|>[\s\S]*?(?:<\|tool_calls_section_end\|>|$)/gi, "")
    .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "")
    .replace(/<\/?think>/gi, "")
    .replace(/<\|tool_call_begin\|>[\s\S]*?(?:<\|tool_call_end\|>|$)/gi, "")
    .replace(/<tool_call>[\s\S]*?(?:<\/tool_call>|$)/gi, "")
    .replace(/<function=[^>]+>[\s\S]*?(?:<\/function>|$)/gi, "")
    .replace(/<parameter=[^>]+>[\s\S]*?(?:<\/parameter>|$)/gi, "")
    .replace(/<coder-tool>\s*[\s\S]*?<\/coder-tool>/gi, "")
    .replace(/<coder-tool>\s*[\s\S]*$/gi, "")
    .replace(/<coding-questions>\s*[\s\S]*?(?:<\/coding-questions>|$)/gi, "")
    .replace(/<coder-questions>\s*[\s\S]*?(?:<\/coder-questions>|$)/gi, "")
    .replace(/<coder-progress>\s*[\s\S]*?(?:<\/coder-progress>|$)/gi, "")
    .replace(/\bcoder-tool>\s*{[\s\S]*$/gi, "")
    .replace(/\btool_call>\s*[\s\S]*$/gi, "")
    .trim();
}

function normalizeCoderToolMarkup(content: string): string {
  return content
    .replace(/<\\\/coder-tool>/gi, "</coder-tool>")
    .replace(/&lt;coder-tool&gt;/gi, "<coder-tool>")
    .replace(/&lt;\/coder-tool&gt;/gi, "</coder-tool>")
    .replace(/&lt;coding-questions&gt;/gi, "<coding-questions>")
    .replace(/&lt;\/coding-questions&gt;/gi, "</coding-questions>")
    .replace(/&lt;coder-questions&gt;/gi, "<coder-questions>")
    .replace(/&lt;\/coder-questions&gt;/gi, "</coder-questions>")
    .replace(/&lt;tool_call&gt;/gi, "<tool_call>")
    .replace(/&lt;\/tool_call&gt;/gi, "</tool_call>")
    .replace(/&lt;function=([^&]+)&gt;/gi, "<function=$1>")
    .replace(/&lt;\/function&gt;/gi, "</function>")
    .replace(/&lt;parameter=([^&]+)&gt;/gi, "<parameter=$1>")
    .replace(/&lt;\/parameter&gt;/gi, "</parameter>");
}
