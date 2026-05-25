export function escapeXmlText(input: string): string {
  if (!input) return "";
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const ch = input.charAt(i);
    const code = input.charCodeAt(i);
    switch (ch) {
      case "&":
        out += "&amp;";
        break;
      case "<":
        out += "&lt;";
        break;
      case ">":
        out += "&gt;";
        break;
      case '"':
        out += "&quot;";
        break;
      case "'":
        out += "&apos;";
        break;
      default:
        if (code > 126 || code < 32) {
          out += `&#${code};`;
        } else {
          out += ch;
        }
    }
  }
  return out;
}

export function escapeXmlAttribute(input: string): string {
  return escapeXmlText(input);
}
