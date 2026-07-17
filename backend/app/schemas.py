"""
Pydantic schemas for request/response validation.
"""
from pydantic import BaseModel, Field
from typing import Optional, Any


# ---- Profile (Master Career Profile) ----
class ProfileIn(BaseModel):
    fullName: str
    email: str
    phone: Optional[str] = None
    location: Optional[str] = None
    links: Optional[dict] = Field(default_factory=dict)  # github, portfolio, linkedin
    education: Optional[list] = []
    skills: Optional[list] = []
    projects: Optional[list] = []
    experience: Optional[list] = []
    certifications: Optional[list] = []
    achievements: Optional[list] = []
    careerPreferences: Optional[dict] = Field(default_factory=dict)
    preferredLocations: Optional[list] = []
    salaryExpectation: Optional[str] = None


# ---- Job description intelligence ----
class JobAnalyzeIn(BaseModel):
    jobDescription: str = Field(..., min_length=20)


class JobUrlIn(BaseModel):
    url: str
    notes: Optional[str] = None


# ---- Resume tailoring ----
class TailorIn(BaseModel):
    resumeText: Optional[str] = None          # raw text (alternative to file upload)
    jobDescription: str = Field(..., min_length=20)


class AnalyzeAtsIn(BaseModel):
    tailoredResume: dict
    jobJson: dict


# ---- Scam shield ----
class ScamCheckIn(BaseModel):
    text: Optional[str] = None
    url: Optional[str] = None
    type: Optional[str] = "job_posting"  # job_posting | email | offer_letter | website


# ---- Interview ----
class InterviewQIn(BaseModel):
    jobJson: dict
    resumeJson: Optional[dict] = None
    company: Optional[str] = ""
    style: Optional[str] = "mixed"


class InterviewFeedbackIn(BaseModel):
    question: str
    answer: str


# ---- Learning ----
class LearningIn(BaseModel):
    goal: str
    missing: dict
    marketDemand: Optional[str] = ""


# ---- Career advisor (chat) ----
class AdvisorIn(BaseModel):
    userId: Optional[str] = None
    email: Optional[str] = None
    question: str
    docs: Optional[str] = ""


# ---- Generic JSON response ----
class ResultOut(BaseModel):
    ok: bool = True
    data: Any = None
    error: Optional[str] = None
