"""
Scam-indicator lexicon and detectors shared by the feature pipeline and the
rule engine. Centralised so both stay in sync.
"""
from __future__ import annotations

import re
from typing import Dict, List

# Categorised scam phrases. Key = human-readable reason; value = regex patterns.
# Patterns sourced from FTC/BBB/FBI job-scam guides, university career-services
# red-flag lists, and India-specific internship-scam awareness reporting.
SCAM_INDICATORS: Dict[str, List[str]] = {
    "Requested payment / fee": [
        r"registration fee", r"training kit", r"training fee", r"security deposit",
        r"interview fee", r"processing fee", r"visa fee", r"refundable",
        r"application fee", r"onboarding fee", r"enrol?lment fee", r"kit fee",
        r"placement fee", r"joining fee", r"caution deposit", r"one[- ]time fee",
        r"pay (?:now|the|a|an|via|rs|inr|\$|us\$|₹)", r"upfront payment",
        r"advance payment", r"pay to (?:join|register|start|confirm)",
        r"amount (?:to be paid|is refundable)", r"deposit (?:of|rs|₹|\$)",
        r"nominal (?:fee|amount|charge)", r"minimal (?:fee|charge)",
    ],
    "Pay-to-work / fee-before-offer": [
        # the specific pattern the user described
        r"stipend (?:is |will be |)?based on (?:your )?performance",
        r"performance[- ]based stipend", r"performance[- ]based (?:pay|salary)",
        r"stipend after (?:completion|training|\d+ (?:days|weeks|months))",
        r"pay (?:first|before)[,.]? (?:join|start|offer|and)",
        r"fee (?:before|prior to) (?:the |your |)?(?:offer|joining|onboarding)",
        r"pay (?:the |a |)?(?:fee|amount|deposit) (?:to (?:get|receive|unlock)|before)",
        r"refundable (?:after|on) (?:joining|completion|\d+)",
        r"deposit (?:will be |is |)?(?:refunded|returned) (?:after|on|once)",
        r"unlock (?:your )?(?:earnings|stipend|payment|withdrawal)",
        r"complete (?:the )?tasks? to (?:earn|unlock|withdraw)",
    ],
    "Fill-form / data-harvest before offer": [
        r"fill (?:out |in |up |)?(?:this |the |our |)?form",
        r"fill (?:the |this |)?(?:google )?form", r"registration form",
        r"complete (?:this |the |your )?(?:registration|onboarding|application) form",
        r"submit (?:the |your |this )?form", r"details? in (?:the |this )?form",
        r"forms?\.gle", r"docs\.google\.com/forms", r"google form",
    ],
    "Personal banking / financial request": [
        r"bank account", r"account number", r"ifsc", r"upi", r"scanned cheque",
        r"credit card", r"debit card", r"net banking", r"card (?:number|details)",
        r"cvv", r"wire (?:transfer|the money)", r"deposit (?:the |this )?check",
    ],
    "OTP request": [r"\botp\b", r"one[- ]time password", r"verification code"],
    "Aadhaar / PAN misuse": [r"aadhaar", r"aadhar", r"pan card", r"\bpan\b",
                             r"passport (?:copy|number|details)",
                             r"(?:ssn|social security)", r"driver'?s? licen[cs]e"],
    "Password request": [r"password", r"login credentials", r"pin number"],
    "Telegram / WhatsApp-only recruitment": [
        r"whatsapp", r"telegram", r"contact us only on", r"message us on",
        r"chat (?:with us |)on (?:whatsapp|telegram)", r"google hangouts?",
        r"reach (?:us |me |)on (?:whatsapp|telegram)", r"dm (?:us|me) on",
    ],
    "Crypto / gift-card payment": [
        r"crypto", r"usdt", r"bitcoin", r"btc\b", r"gift cards?", r"amazon gift",
        r"cryptocurrency", r"binance", r"wallet address",
    ],
    "Unrealistic salary": [
        r"earn rs\.?\s?\d{4,}", r"\d{4,}\s?daily", r"guaranteed (?:income|placement)",
        r"50000 daily", r"rs\.?\s?\d{2,3},?\d{3}\s?/?\s?(?:day|daily|month|week)",
        r"\$\s?\d{3,}\s?/?\s?(?:day|week)", r"unlimited earning",
        r"high (?:pay|salary|stipend) for (?:little|less|minimal) (?:work|effort)",
        r"earn (?:up to |)?(?:rs|₹|\$)\s?\d", r"too good to be true",
    ],
    "No interview process": [
        r"no interview", r"without any interview", r"direct(?:ly)? selected",
        r"immediate joining", r"no interview required", r"instant (?:selection|offer|hire)",
        r"selected without", r"offer (?:letter )?without (?:interview|test)",
    ],
    "Urgent / pressure language": [
        r"\burgent\b", r"act now", r"limited seats", r"last chance",
        r"expires today", r"within 24 hours", r"final reminder",
        r"immediate action required", r"reserve your (?:seat|spot)",
        r"only \d+ (?:seats|spots|slots) (?:left|remaining)", r"hurry",
        r"offer valid (?:till|until|for)", r"start (?:by |from )?(?:monday|tomorrow|today)",
    ],
    "Too-good-to-be-true selection": [
        r"congratulations", r"you (?:have been|are) (?:shortlisted|selected)",
        r"dear winner", r"you are directly selected", r"you'?ve been selected",
        r"selected for (?:the |our )?(?:internship|position|role|program)",
    ],
    "Free email / unofficial domain": [
        r"@gmail\.com", r"@yahoo\.(?:com|in)", r"@outlook\.com", r"@hotmail\.com",
        r"@rediffmail\.com", r"reply (?:from|using) your personal email",
    ],
}

# Pre-compile
_COMPILED = {
    reason: [re.compile(p, re.I) for p in pats]
    for reason, pats in SCAM_INDICATORS.items()
}

SCAM_CATEGORIES: List[str] = list(SCAM_INDICATORS.keys())


def detect_indicators(text: str) -> Dict[str, int]:
    """Return {category: match_count} for a piece of text."""
    text = text if isinstance(text, str) else ""
    out: Dict[str, int] = {}
    for reason, patterns in _COMPILED.items():
        count = sum(len(p.findall(text)) for p in patterns)
        out[reason] = count
    return out


def matched_reasons(text: str) -> List[str]:
    """Return the list of scam categories that matched at least once."""
    counts = detect_indicators(text)
    return [reason for reason, c in counts.items() if c > 0]
