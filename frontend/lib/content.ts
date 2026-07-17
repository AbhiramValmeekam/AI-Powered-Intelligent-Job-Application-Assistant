export const navigation = [
  { index: "01", label: "Read", href: "#read" },
  { index: "02", label: "Discover", href: "#match" },
  { index: "03", label: "Tailor", href: "#tailor" },
  { index: "04", label: "Move", href: "#move" },
] as const;

export const resumeSignals = [
  { label: "Experience", value: "Evidence kept intact", code: "01" },
  { label: "Skills", value: "Context before keywords", code: "02" },
  { label: "Goals", value: "Direction set by you", code: "03" },
] as const;

export const matchRoutes = [
  { place: "Remote", role: "Product systems", fit: "Strong evidence" },
  { place: "On-site", role: "Operations", fit: "Transferable fit" },
  { place: "Relocation", role: "Growth strategy", fit: "Eligibility check" },
  { place: "Hybrid", role: "Program delivery", fit: "Skill bridge" },
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
