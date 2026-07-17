export const navigation = [
  { index: "01", label: "Read", href: "#read" },
  { index: "02", label: "Discover", href: "#match" },
  { index: "03", label: "Tailor", href: "#tailor" },
  { index: "04", label: "Move", href: "#move" },
] as const;

export const resumeSignals = [
  { label: "Experience", value: "Evidence kept intact—instantly backing up your claims with verifiable facts.", code: "01" },
  { label: "Skills", value: "Context before keywords—passing ATS filters by proving depth, not just buzzwords.", code: "02" },
  { label: "Goals", value: "Direction set by you—tailoring applications to target your ideal title and salary.", code: "03" },
] as const;

export const matchRoutes = [
  { place: "ENGINE", role: "JD INTELLIGENCE", fit: "[Deconstruct JDs] — Extract core skills and decode recruiter expectations instantly." },
  { place: "FACTORY", role: "RESUME TAILOR", fit: "[Match Metrics] — Dynamically adapt your master profile to match job metrics while maintaining factual truth." },
  { place: "AUDIT", role: "ATS ANALYZER", fit: "[Reveal Gaps] — Uncover critical missing skills and benchmark your real-world match score before applying." },
  { place: "SHIELD", role: "SCAM SHIELD", fit: "[Filter Schemes] — AI-powered tracking to filter out ghost jobs, data-harvesting schemes, and fake listings." },
] as const;

export const operatingPrinciples = [
  {
    number: "01",
    verb: "READ",
    statement: "See the evidence a recruiter sees.",
    detail: "Structure, relevance, clarity, and gaps—explained without invented achievements.",
  },
  {
    number: "02",
    verb: "TEACH",
    statement: "Turn every gap into a next step.",
    detail: "Feedback stays specific to the role and close to the skills you already have.",
  },
  {
    number: "03",
    verb: "TAILOR",
    statement: "Change the framing. Never the facts.",
    detail: "Each application can speak to the role while remaining grounded in your source CV.",
  },
  {
    number: "04",
    verb: "MOVE",
    statement: "Act only inside known boundaries.",
    detail: "Authorization, required answers, and submission status must be clear before anything is sent.",
  },
] as const;

export const boundaryChecks = [
  ["Scam screening", "On by default"],
  ["Role requirements", "Checked"],
  ["Candidate evidence", "Linked"],
  ["Required answers", "Confirmed"],
  ["Submission state", "Recorded"],
] as const;
