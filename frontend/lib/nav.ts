export type ModuleDef = {
  slug: string;
  index: string;
  title: string;
  eyebrow: string;
};

export const MODULES: ModuleDef[] = [
  { slug: "jobs", index: "01", title: "Job Search", eyebrow: "Live Board" },
  { slug: "alerts", index: "02", title: "Alerts", eyebrow: "Real-time" },
  { slug: "jd", index: "03", title: "JD Intelligence", eyebrow: "Decode JD" },
  { slug: "tailor", index: "04", title: "Resume Tailor", eyebrow: "Tailor" },
  { slug: "cover", index: "05", title: "Cover Letter", eyebrow: "Generate" },
  { slug: "ats", index: "06", title: "ATS Analyzer", eyebrow: "Score" },
  { slug: "skills", index: "07", title: "Missing Skills", eyebrow: "Gaps" },
  { slug: "scam", index: "08", title: "Scam Shield", eyebrow: "ML" },
  { slug: "company", index: "09", title: "Company Intel", eyebrow: "Research" },
  { slug: "interview", index: "10", title: "Interview Coach", eyebrow: "Practice" },
  { slug: "tracker", index: "11", title: "Applications", eyebrow: "Tracker" },
  { slug: "versions", index: "12", title: "Versions", eyebrow: "History" },
  { slug: "analytics", index: "13", title: "Analytics", eyebrow: "Pipeline" },
  { slug: "learning", index: "14", title: "Learning", eyebrow: "Paths" },
  { slug: "advisor", index: "15", title: "Advisor", eyebrow: "Chat" },
];
