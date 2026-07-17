// Parse a raw job description (HTML or markdown) into clean sections,
// like an Internshala posting: About, Responsibilities, Skills, etc.

export type Section = { heading: string; body: string };

const KNOWN = [
  "about", "responsibilities", "key responsibilities", "roles and responsibilities",
  "what you", "what you'll do", " duties", "requirements", "requirements & skills",
  "skills", "skill(s) required", "who can apply", "perks", "about the company",
  "about us", "company", "benefits", "what we offer", "qualifications", "eligibility",
  "nice to have", "description", "overview", "the role", "your role", "what you need",
];

function isHeading(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (t.length > 60) return false;                       // too long to be a heading
  const lower = t.toLowerCase().replace(/[:.\-–—\s]+$/, "");
  if (KNOWN.some((k) => lower === k || lower.endsWith(k.trim()))) return true;
  // A short comma-separated list is a tag/skill list, not a heading.
  if (t.includes(",") && !/[.;:]$/.test(t)) return false;
  // standalone short bold line, likely a heading
  return t.split(/\s+/).length <= 7 && !t.endsWith(".");
}

function htmlToText(html: string): string {
  return (html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")          // strip remaining tags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function mdToText(md: string): string {
  return (md || "")
    .replace(/^###\s+/gm, "\n# ")
    .replace(/^\*\*(.+?)\*\*\s*$/gm, "# $1")   // standalone **Heading**
    .replace(/[*_`]/g, "")
    .trim();
}

export function parseSections(raw: string): Section[] {
  if (!raw) return [];
  const isHtml = /<[a-z][\s\S]*>/i.test(raw);
  let text = isHtml ? htmlToText(raw) : mdToText(raw);

  // Split into lines, detect "# Heading" markers (from md) or short bold-ish lines.
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const sections: Section[] = [];
  let cur: Section | null = null;

  for (const line of lines) {
    const mdHeading = line.match(/^#\s+(.+)$/);
    const headingText = mdHeading ? mdHeading[1] : line;
    if (mdHeading || isHeading(headingText)) {
      if (cur) sections.push(cur);
      cur = { heading: headingText.replace(/^#\s+/, ""), body: "" };
    } else {
      if (!cur) cur = { heading: "Description", body: "" };
      cur.body += (cur.body ? " " : "") + line;
    }
  }
  if (cur) sections.push(cur);

  // Merge a leading "Description" with the first real section if it's just intro.
  const cleaned = sections
    .map((s) => ({ heading: s.heading.trim(), body: s.body.trim() }))
    .filter((s) => s.heading || s.body);

  return cleaned.length ? cleaned : [{ heading: "Description", body: text }];
}
