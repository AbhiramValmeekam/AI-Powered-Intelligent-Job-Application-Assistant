"""
Career-intelligence Gemini modules:
- Job discovery (analyze a pasted JD / career-page text)
- Company intelligence (public research summary)
- Interview coach (questions + feedback)
- Career advisor (chatbot over the user profile + docs)
- Learning recommendation engine
"""
import json
from app.engines.gemini_client import GeminiClient


class IntelligenceEngine:
    def __init__(self, client: GeminiClient):
        self.gemini = client

    def _extract_json(self, raw: str) -> dict:
        txt = raw.strip()
        if txt.startswith("```"):
            txt = txt.split("```", 2)[1]
            if txt.lower().startswith("json"):
                txt = txt[4:]
        s, e = txt.find("{"), txt.rfind("}")
        if s == -1 or e == -1:
            raise ValueError("No JSON in response")
        return json.loads(txt[s:e + 1])

    # ------------------------------------------------------------------ #
    def research_company(self, company: str, extra_context: str = "") -> dict:
        sys = (
            "You are a company-research analyst. Given a company name, return a concise, factual "
            "public-information summary. Output ONLY JSON with keys: name, oneLiner, techStack[], "
            "products[], engineeringCulture, recentNews[], hiringTrends, interviewReputation, "
            "references[] (public URLs). If you are unsure about a field, leave it empty. Do not "
            "invent specifics you cannot support."
        )
        ctx = ("EXTRA CONTEXT:\n" + extra_context) if extra_context else ""
        prompt = f"COMPANY: {company}\n{ctx}\nReturn the JSON only."
        raw = self.gemini.generate(prompt, system_instruction=sys, temperature=0.3)
        return self._extract_json(raw)

    # ------------------------------------------------------------------ #
    def interview_questions(self, job_json: dict, resume_json: dict = None,
                            company: str = "", style: str = "mixed") -> dict:
        sys = (
            "You are a technical interview coach. Given a job description and optionally the "
            "candidate resume, produce interview questions. Output ONLY JSON with keys: "
            "technical[] (coding/algo/domain), behavioral[], companySpecific[], systemDesign[]. "
            "Tailor to the role. Keep each question clear and specific."
        )
        prompt = (
            f"JOB JSON:\n{json.dumps(job_json, indent=2)}\n\n"
            f"COMPANY: {company or 'unknown'}\n"
            f"CANDIDATE RESUME: {json.dumps(resume_json, indent=2) if resume_json else 'n/a'}\n"
            f"STYLE: {style}\n\nReturn the JSON only."
        )
        raw = self.gemini.generate(prompt, system_instruction=sys, temperature=0.5)
        return self._extract_json(raw)

    def interview_feedback(self, question: str, answer: str) -> dict:
        sys = (
            "You are an interview coach giving kind, specific feedback. Output ONLY JSON with keys: "
            "score (0-100), strengths[] (short), improvements[] (short), modelAnswer (1-2 sentences "
            "showing a strong response). Be constructive and specific."
        )
        prompt = f"QUESTION:\n{question}\n\nCANDIDATE ANSWER:\n{answer}\n\nReturn the JSON only."
        raw = self.gemini.generate(prompt, system_instruction=sys, temperature=0.4)
        return self._extract_json(raw)

    # ------------------------------------------------------------------ #
    def learning_recommendations(self, goal: str, missing: dict, market_demand: str = "") -> dict:
        sys = (
            "You are a learning-path advisor. Given a career goal, a missing-skills structure, and "
            "optional market demand notes, recommend resources. Output ONLY JSON with keys: "
            "courses[] (name + provider + url?), books[], projects[] (concrete build ideas), "
            "openSource[], certifications[], roadmap[] (ordered steps). Prefer well-known, free or "
            "low-cost, reputable resources."
        )
        prompt = (
            f"CAREER GOAL: {goal}\n\nMISSING SKILLS:\n{json.dumps(missing, indent=2)}\n\n"
            f"MARKET DEMAND NOTES: {market_demand or 'n/a'}\n\nReturn the JSON only."
        )
        raw = self.gemini.generate(prompt, system_instruction=sys, temperature=0.4)
        return self._extract_json(raw)

    # ------------------------------------------------------------------ #
    def career_advice(self, profile_json: dict, question: str, docs: str = "") -> str:
        sys = (
            "You are CareerOS, an AI career advisor. Answer the user's question using ONLY their "
            "stored profile and any uploaded documents provided. Be specific, actionable, and "
            "honest. If the answer isn't supported by the profile/docs, say so. Never invent facts "
            "about the user."
        )
        prompt = (
            f"USER PROFILE:\n{json.dumps(profile_json, indent=2)}\n\n"
            f"UPLOADED DOCS:\n{docs or 'n/a'}\n\n"
            f"USER QUESTION: {question}\n\nAnswer directly."
        )
        return self.gemini.generate(prompt, system_instruction=sys, temperature=0.5).strip()
