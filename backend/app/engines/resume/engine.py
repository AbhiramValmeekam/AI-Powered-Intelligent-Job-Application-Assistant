"""
Resume + Cover-Letter Tailoring Engine.

Ported and generalized from AI_Resume_Agent. Core principle: NEVER fabricate.
The LLM only reorders/rewrites/highlights real resume content to match a job.

Exposes:
- tailor_resume(resume_text, job_description) -> structured result (resume JSON, summary, cover letter, ATS score, missing skills)
- analyze_job_description(job_description)    -> structured JD intelligence JSON
- analyze_ats(resume_json, jd_json)           -> match breakdown (overall/keyword/skill/experience/education/project)
- missing_skills(resume_json, jd_json)        -> critical/important/optional + learning roadmap
"""
import json
from app.engines.gemini_client import GeminiClient, QuotaError


class ResumeEngine:
    def __init__(self, client: GeminiClient):
        self.gemini = client

    # ------------------------------------------------------------------ #
    def _extract_json(self, raw: str) -> dict:
        """Pull a JSON object out of an LLM response (handles ```json fences)."""
        txt = raw.strip()
        if txt.startswith("```"):
            txt = txt.split("```", 2)[1]
            if txt.lower().startswith("json"):
                txt = txt[4:]
        start = txt.find("{")
        end = txt.rfind("}")
        if start == -1 or end == -1:
            raise ValueError("No JSON found in model response")
        return json.loads(txt[start:end + 1])

    # ------------------------------------------------------------------ #
    def analyze_job_description(self, job_description: str) -> dict:
        sys = (
            "You are a job-description analyst. Extract structured intelligence from a job "
            "posting. Output ONLY JSON with keys: "
            "company, position, requiredSkills[], preferredSkills[], responsibilities[], "
            "technologies[], softSkills[], experience (string), atsKeywords[], education[], "
            "benefits[]. If a field is unknown, use an empty array/string. Be factual."
        )
        prompt = f"JOB DESCRIPTION:\n<<<\n{job_description}\n>>>\nReturn the JSON only."
        raw = self.gemini.generate(prompt, system_instruction=sys, temperature=0.2)
        return self._extract_json(raw)

    # ------------------------------------------------------------------ #
    def tailor_resume(self, resume_text: str, job_description: str) -> dict:
        """
        Single combined Gemini call: parse raw resume -> tailor -> ATS score ->
        missing skills -> cover letter. ~3x faster than sequential calls.
        """
        sys = (
            "You are a senior resume consultant and ATS optimization expert. From the RAW resume "
            "text and a job description, produce a tailored, ATS-friendly resume plus a cover letter.\n\n"
            "STRICT RULES:\n"
            "1. NEVER fabricate experience, employers, degrees, dates, or metrics. Use ONLY facts "
            "present in the raw resume. If absent, do not invent it.\n"
            "2. REFRAME/REWRITE bullets to mirror the job description's language and prioritized "
            "skills, adding relevant keywords naturally while keeping real accomplishments/metrics.\n"
            "3. Reorder and emphasize the most relevant experience and skills.\n"
            "4. ATS-friendly: standard headings, keyword-rich but truthful, action-verb bullets.\n"
            "5. Keep the candidate's voice and structure.\n"
            "6. Output ONLY a JSON object with these keys:\n"
            "   - tailoredResume: structured resume JSON with keys: name, contact "
            "{email,phone,location,links[]}, experience[{title,company,dates,bullets[]}], "
            "projects[{name,bullets[],link?}], skills[], education[{degree,institution,dates,detail?}], "
            "certifications[] (optional). Bullets tailored/reordered.\n"
            "   - summary: 2-3 sentence tailored professional summary.\n"
            "   - changes: array of short strings describing what changed.\n"
            "   - atsScore: integer 0-100.\n"
            "   - missingSkills: array of important job skills the candidate lacks (honest; [] if none).\n"
            "   - requiresHumanReview: boolean.\n"
            "   - coverLetter: a concise (max 350 words) tailored cover letter referencing 2-3 real "
            "accomplishments; warm but professional; no fabrication."
        )
        prompt = (
            f"RAW RESUME TEXT:\n<<<\n{resume_text}\n>>>\n\n"
            f"JOB DESCRIPTION:\n<<<\n{job_description}\n>>>\n\n"
            "Return the JSON only."
        )
        raw = self.gemini.generate(prompt, system_instruction=sys, temperature=0.4)
        result = self._extract_json(raw)
        if isinstance(result.get("coverLetter"), (dict, list)):
            result["coverLetter"] = json.dumps(result["coverLetter"])
        return result

    # ------------------------------------------------------------------ #
    def analyze_ats(self, tailored_json: dict, jd_json: dict) -> dict:
        """Compute an ATS match breakdown (LLM-assisted, with deterministic fallback)."""
        sys = (
            "You are an ATS (Applicant Tracking System) evaluator. Given a tailored resume JSON and "
            "a parsed job description JSON, output ONLY JSON with keys: "
            "overall (0-100), keywordMatch (0-100), skillMatch (0-100), experienceMatch (0-100), "
            "educationMatch (0-100), projectMatch (0-100), and explanation (short string). "
            "Be honest and base scores on real overlap."
        )
        prompt = (
            f"TAILLORED RESUME:\n{json.dumps(tailored_json, indent=2)}\n\n"
            f"JOB DESCRIPTION JSON:\n{json.dumps(jd_json, indent=2)}\n\nReturn the JSON only."
        )
        try:
            raw = self.gemini.generate(prompt, system_instruction=sys, temperature=0.2)
            return self._extract_json(raw)
        except Exception:
            # Deterministic fallback: crude keyword overlap
            jd_skills = set(s.lower() for s in jd_json.get("requiredSkills", []) + jd_json.get("technologies", []))
            r_skills = set(s.lower() for s in tailored_json.get("skills", []))
            overlap = len(jd_skills & r_skills)
            denom = max(len(jd_skills), 1)
            score = int(round(100 * overlap / denom))
            return {
                "overall": score, "skillMatch": score, "keywordMatch": score,
                "experienceMatch": score, "educationMatch": score, "projectMatch": score,
                "explanation": "Fallback score based on skill keyword overlap (LLM call failed).",
            }

    # ------------------------------------------------------------------ #
    def missing_skills(self, resume_json: dict, jd_json: dict) -> dict:
        """Identify critical/important/optional missing skills + learning roadmap."""
        sys = (
            "You are a career coach. Compare a candidate resume JSON to a parsed job description. "
            "Output ONLY JSON with keys: critical[] (must-have for the role, missing), "
            "important[] (strongly preferred, missing), optional[] (nice-to-have, missing), and "
            "roadmap[] (3-6 concrete steps: courses/projects/certs to close gaps). Be honest; "
            "only list genuinely missing items. Do not invent resume content."
        )
        prompt = (
            f"RESUME JSON:\n{json.dumps(resume_json, indent=2)}\n\n"
            f"JOB JSON:\n{json.dumps(jd_json, indent=2)}\n\nReturn the JSON only."
        )
        raw = self.gemini.generate(prompt, system_instruction=sys, temperature=0.3)
        return self._extract_json(raw)

    # ------------------------------------------------------------------ #
    def cover_letter_from_tailored(self, tailored_json: dict, jd_json: dict) -> str:
        """Generate a fresh cover letter from already-tailored content (used standalone)."""
        sys = (
            "You are a professional career coach. Write a concise, tailored cover letter (max 350 "
            "words) for the candidate based on their tailored resume and the job description. Warm "
            "but professional, reference 2-3 specific truthful accomplishments, no fabrication."
        )
        prompt = (
            f"CANDIDATE (tailored):\n{json.dumps(tailored_json, indent=2)}\n\n"
            f"JOB:\n{json.dumps(jd_json, indent=2)}\n\nWrite the cover letter."
        )
        return self.gemini.generate(prompt, system_instruction=sys, temperature=0.5).strip()
