// Extract structured profile fields from raw parsed resume text.
// Pure client-side heuristics — no LLM call, instant, reliable for the
// common resume shapes. Fields the regex can't find stay empty so the user
// can still fill them manually.

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\s.-]?){9,13}/;
const LINKEDIN_RE = /(?:linkedin\.com\/in\/[^\s,)\]]+)/i;
const GITHUB_RE = /(?:github\.com\/[^\s,)\]]+)/i;
const PORTFOLIO_RE = /(?:https?:\/\/(?!linkedin\.com|github\.com)[^\s,)\]]+\.[^\s,)\]]+)/i;

// Common technical / soft skills to spot in free text.
const SKILL_DICT = [
  "python", "java", "javascript", "typescript", "c++", "c#", "go", "rust", "kotlin", "swift",
  "ruby", "php", "scala", "sql", "mysql", "postgresql", "mongodb", "redis", "sqlite",
  "react", "angular", "vue", "next.js", "nextjs", "node.js", "nodejs", "express", "django",
  "flask", "fastapi", "spring", "rails", "laravel", "dotnet", ".net",
  "html", "css", "tailwind", "bootstrap", "sass",
  "aws", "azure", "gcp", "google cloud", "docker", "kubernetes", "terraform", "jenkins",
  "ci/cd", "linux", "bash", "powershell",
  "machine learning", "deep learning", "tensorflow", "pytorch", "opencv", "nlp", "llm",
  "gensim", "sklearn", "pandas", "numpy", "matplotlib",
  "git", "github", "jira", "agile", "scrum", "rest", "graphql", "grpc",
  "figma", "photoshop", "ui", "ux", "communication", "leadership", "problem solving",
];

const EDU_KEYWORDS = ["b.tech", "btech", "b.e", "b.e.", "bachelor", "m.tech", "mtech", "master",
  "university", "college", "institute", "school", "phd", "diploma", "12th", "10th", "intermediate"];
const EXP_KEYWORDS = ["intern", "internship", "engineer", "developer", "analyst", "manager", "founder",
  "freelance", "consultant", "trainee", "roles", "experience", "worked", "employed", "responsibilities"];

export type ExtractedProfile = {
  fullName: string;
  location: string;
  skills: string[];
  education: string[]; // "Degree — Institution" per line
  experience: string[]; // "Title @ Company" per line
  links: string; // "github: ...\nlinkedin: ...\nportfolio: ..." per line
  goal: string;
};

function firstLineName(text: string): string {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  // The name is usually the first short all-caps-ish or Title Case line
  // without digits, before any email/link/section header.
  for (const l of lines.slice(0, 6)) {
    if (EMAIL_RE.test(l) || LINKEDIN_RE.test(l) || GITHUB_RE.test(l)) continue;
    if (l.toLowerCase().startsWith("resume") || l.toLowerCase().startsWith("curriculum")) continue;
    if (l.length < 3 || l.length > 40) continue;
    if (/\d/.test(l)) continue;
    if (/^(education|experience|skills|projects|summary|objective|profile|contact)/i.test(l)) continue;
    // Looks like a person's name (2-4 words, letters only).
    const words = l.split(/\s+/);
    if (words.length >= 2 && words.length <= 4 && words.every((w) => /^[A-Za-z.]+$/.test(w))) {
      return l.replace(/\s+/g, " ").trim();
    }
  }
  return "";
}

function extractSection(text: string, headers: RegExp): string[] {
  const lines = text.split(/\n/).map((l) => l.trim());
  const out: string[] = [];
  let capturing = false;
  for (const line of lines) {
    if (headers.test(line)) { capturing = true; continue; }
    // Stop at the next major section header.
    if (capturing && /^(education|experience|skills|projects|summary|objective|profile|contact|certification|achievements|publications|languages|interests|references)\b/i.test(line)) {
      if (!headers.test(line)) { capturing = false; continue; }
    }
    if (capturing && line) out.push(line);
  }
  return out;
}

export function extractProfile(text: string): ExtractedProfile {
  const t = text || "";

  // Email & phone
  const email = (t.match(EMAIL_RE) || [])[0] || "";
  const phoneRaw = (t.match(PHONE_RE) || [])[0] || "";
  const phone = phoneRaw.replace(/[^\d+]/g, "");

  // Name: prefer a name near the top; fall back to email local part.
  let fullName = firstLineName(t);
  if (!fullName && email) {
    fullName = email.split("@")[0].split(/[._-]/).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
  }

  // Links
  const linkedin = (t.match(LINKEDIN_RE) || [])[0] || "";
  const github = (t.match(GITHUB_RE) || [])[0] || "";
  const portfolio = (t.match(PORTFOLIO_RE) || [])[0] || "";
  const links: string[] = [];
  if (github) links.push(`github: ${github}`);
  if (linkedin) links.push(`linkedin: ${linkedin}`);
  if (portfolio) links.push(`portfolio: ${portfolio}`);

  // Skills: scan whole text for dictionary terms (word-boundary, case-insensitive).
  const lower = t.toLowerCase();
  const found = new Set<string>();
  for (const s of SKILL_DICT) {
    const re = new RegExp(`(^|[^a-z0-9.])(${s.replace(/[.+]/g, "\\$&")})([^a-z0-9.]|$)`, "i");
    if (re.test(lower)) found.add(s);
  }
  // Also pick up an explicit "Skills" section comma/newline list.
  const skillsSection = extractSection(t, /^skills?\b/i);
  for (const line of skillsSection) {
    line.split(/[,;|]/).map((x) => x.trim()).filter(Boolean).forEach((s) => found.add(s.toLowerCase()));
  }
  const skills = Array.from(found);

  // Education: lines under an EDUCATION header that mention edu keywords.
  const eduSection = extractSection(t, /^education\b/i);
  const education = (eduSection.length ? eduSection : t.split(/\n/).map((l) => l.trim()))
    .filter((l) => EDU_KEYWORDS.some((k) => l.toLowerCase().includes(k)))
    .slice(0, 6)
    .map((l) => l.replace(/\s+/g, " ").trim());

  // Experience: lines under an EXPERIENCE header that mention exp keywords,
  // or "Title @ Company" style lines.
  const expSection = extractSection(t, /^(experience|work|employment)\b/i);
  const experience = (expSection.length ? expSection : t.split(/\n/).map((l) => l.trim()))
    .filter((l) => EXP_KEYWORDS.some((k) => l.toLowerCase().includes(k)) || /@/.test(l))
    .slice(0, 8)
    .map((l) => l.replace(/\s+/g, " ").trim());

  // Goal: best-effort — first line of a "Summary/Objective" section.
  const summary = extractSection(t, /^(summary|objective|profile|about)\b/i);
  const goal = summary[0] || "";

  return {
    fullName,
    location: phone ? "" : "", // location rarely parseable reliably; left for manual entry
    skills,
    education,
    experience,
    links: links.join("\n"),
    goal,
  };
}
