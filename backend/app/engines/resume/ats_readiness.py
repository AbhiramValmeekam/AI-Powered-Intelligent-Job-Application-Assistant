"""
Deterministic, LLM-free ATS readiness scorer for a single resume.

Used for the dashboard right-rail: whenever a master resume is uploaded we run
this instantly (no Gemini quota risk) to produce a real, explainable ATS score
plus a resume-completeness percentage. Both feed the live data visualisation.

The score rewards the things real ATS parsers care about:
  * parseable contact block (email/phone/links)
  * standard sections present (summary, experience, education, skills, projects)
  * quantified, action-verb bullets
  * a healthy skill inventory
  * sensible length (not too short, not bloated)
  * keyword density / readable structure
"""

from typing import Dict, List
import re

_EMAIL_RE = re.compile(r"[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}", re.I)
_PHONE_RE = re.compile(r"(?:\+?\d[\s.\-]?){9,13}")
_LINK_RE = re.compile(r"https?://[^\s,)\]]+|linkedin\.com|github\.com", re.I)

_SECTION_HINTS = {
    "summary": ["summary", "objective", "profile", "about"],
    "experience": ["experience", "work", "employment", "internship", "intern"],
    "education": ["education", "academic", "university", "college", "school"],
    "skills": ["skills", "technical", "competencies", "technologies"],
    "projects": ["projects", "portfolio"],
    "certifications": ["certification", "certificate", "certs"],
}
_BULLET_SPLIT = re.compile(r"[\n•\-\*\u2022]")
_METRIC_RE = re.compile(r"\b\d+(\.\d+)?\s?%|\b\d+\+?\s?(years|yrs|months|k|m\b|team|users|clients|projects|apps|features|apis|services)|improved|increased|reduced|built|launched|led|achieved|optimi[sz]ed|delivered|generated|saved")
_ACTION_VERBS = {
    "developed", "built", "designed", "implemented", "created", "led", "managed", "launched",
    "improved", "increased", "reduced", "optimized", "delivered", "generated", "architected",
    "engineered", "automated", "shipped", "drove", "spearheaded", "maintained", "integrated",
    "analyzed", "researched", "deployed", "scaled", "mentored",
}
_SKILL_DICT = [
    "python", "java", "javascript", "typescript", "c++", "c#", "go", "rust", "kotlin", "swift",
    "ruby", "php", "scala", "sql", "mysql", "postgresql", "mongodb", "redis", "sqlite",
    "react", "angular", "vue", "next.js", "nextjs", "node.js", "nodejs", "express", "django",
    "flask", "fastapi", "spring", "rails", "laravel", "dotnet", ".net",
    "html", "css", "tailwind", "bootstrap", "sass", "figma",
    "aws", "azure", "gcp", "google cloud", "docker", "kubernetes", "terraform", "jenkins",
    "ci/cd", "linux", "bash", "powershell", "git", "github",
    "machine learning", "deep learning", "tensorflow", "pytorch", "opencv", "nlp", "llm",
    "pandas", "numpy", "matplotlib", "scikit", "sklearn", "data analysis", "tableau",
    "rest", "graphql", "grpc", "microservices", "agile", "scrum",
]


def _section_present(text_lower: str, hints: List[str]) -> bool:
    return any(h in text_lower for h in hints)


def score_resume(text: str) -> Dict:
    """Return {atsScore, completeness, breakdown, tips}."""
    t = (text or "").strip()
    tl = t.lower()
    words = t.split()
    n_words = len(words)

    if n_words < 20:
        return {
            "atsScore": 0,
            "completeness": 0,
            "breakdown": {"contact": 0, "sections": 0, "bullets": 0, "skills": 0, "length": 0},
            "tips": ["Upload a fuller resume to see your ATS score."],
        }

    # --- contact (20) ---
    contact = 0
    if _EMAIL_RE.search(t): contact += 8
    if _PHONE_RE.search(t): contact += 7
    if _LINK_RE.search(t): contact += 5
    contact = min(20, contact)

    # --- sections (25) ---
    present = {k: _section_present(tl, v) for k, v in _SECTION_HINTS.items()}
    section_score = round(25 * sum(present.values()) / len(present))

    # --- bullets / achievement language (25) ---
    bullets = [b.strip(" •\-*") for b in _BULLET_SPLIT.split(t) if b.strip(" •\-*")]
    bullets = [b for b in bullets if len(b.split()) >= 3]
    n_bullets = len(bullets)
    metric_bullets = sum(1 for b in bullets if _METRIC_RE.search(b))
    verb_bullets = sum(1 for b in bullets if b.split()[0].lower() in _ACTION_VERBS)
    bullet_score = 0
    if n_bullets:
        bullet_score += min(12, round(12 * min(n_bullets, 8) / 8))
        bullet_score += min(13, round(13 * (metric_bullets / max(n_bullets, 1))))
        # bonus for action-verb starts
        bullet_score += min(5, round(5 * (verb_bullets / max(n_bullets, 1))))
        bullet_score = min(25, bullet_score)

    # --- skills (20) ---
    found = {s for s in _SKILL_DICT if re_search(s, tl)}
    skill_score = min(20, round(20 * min(len(found), 12) / 12))

    # --- length (10) ---
    if 250 <= n_words <= 900:
        length_score = 10
    elif 150 <= n_words < 250 or 900 < n_words <= 1200:
        length_score = 6
    else:
        length_score = 3

    ats = contact + section_score + bullet_score + skill_score + length_score
    ats = max(0, min(100, ats))

    # --- completeness (structural) ---
    completeness = 0
    completeness += 18 if contact >= 18 else contact
    completeness += 18 if present["experience"] else 0
    completeness += 18 if present["education"] else 0
    completeness += 16 if present["skills"] else 0
    completeness += 12 if present["projects"] else 0
    completeness += 10 if present["summary"] else 0
    completeness += 8 if n_bullets >= 4 else (4 if n_bullets else 0)
    completeness = max(0, min(100, completeness))

    breakdown = {
        "contact": contact,
        "sections": section_score,
        "bullets": bullet_score,
        "skills": skill_score,
        "length": length_score,
    }

    tips: List[str] = []
    if contact < 20:
        tips.append("Add email, phone and a LinkedIn/GitHub link so parsers can read your contact block.")
    if not present["summary"]:
        tips.append("Add a short professional summary at the top.")
    if not present["skills"]:
        tips.append("Add a Skills section with technologies you know.")
    if not present["projects"]:
        tips.append("Add a Projects section to showcase real work.")
    if metric_bullets == 0 and n_bullets:
        tips.append("Quantify bullets with metrics (e.g. 'improved speed by 35%').")
    if skill_score < 12:
        tips.append("List more concrete technical skills.")
    if not tips:
        tips.append("Strong resume — keep bullets quantified and keywords job-matched.")

    return {
        "atsScore": ats,
        "completeness": completeness,
        "breakdown": breakdown,
        "tips": tips[:3],
        "skillsFound": sorted(found),
    }


def re_search(needle: str, haystack: str) -> bool:
    return bool(re.search(r"(^|[^a-z0-9.])(%s)([^a-z0-9.]|$)" % re.escape(needle), haystack))
