"""
Gemini client wrapper (ported + hardened from AI_Resume_Agent).

Calls Google Gemini's generateContent REST endpoint. Supports:
- system instruction + user prompt
- thinkingBudget: 0 (latency win on gemini-2.5-flash)
- typed QuotaError on HTTP 429 so callers can show a "change API key" alert
- automatic retry on transient 500/502/503/504
"""
import json
import time
import requests


class QuotaError(RuntimeError):
    """Raised when the Gemini API returns a 429 quota/rate-limit error."""
    pass


class GeminiClient:
    def __init__(self, api_key: str, model: str = "gemini-2.5-flash"):
        self.api_key = api_key
        self.model = model
        self.url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        )

    def generate(self, prompt: str, system_instruction: str = None,
                 temperature: float = 0.4, max_output_tokens: int = 8192) -> str:
        parts = [{"text": prompt}]
        contents = [{"role": "user", "parts": parts}]

        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "topP": 0.95,
                "topK": 40,
                "maxOutputTokens": max_output_tokens,
                # Disable "thinking" for gemini-2.5-flash — big latency win,
                # negligible quality loss for structured extraction/tailoring.
                "thinkingConfig": {"thinkingBudget": 0},
            },
        }
        if system_instruction:
            payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

        import time as _t
        last_err = None
        last_code = None
        for attempt in range(5):
            try:
                resp = requests.post(
                    self.url,
                    params={"key": self.api_key},
                    headers={"Content-Type": "application/json"},
                    data=json.dumps(payload),
                    timeout=120,
                )
            except requests.RequestException as e:
                last_err = f"network error: {e}"
                time.sleep(2 * (attempt + 1))
                continue

            if resp.status_code == 200:
                data = resp.json()
                try:
                    return data["candidates"][0]["content"]["parts"][0]["text"]
                except (KeyError, IndexError) as e:
                    raise RuntimeError(f"Unexpected Gemini response shape: {data}") from e
            # Retry on transient overload / rate limit
            if resp.status_code in (429, 500, 502, 503, 504):
                last_err = f"Gemini API error {resp.status_code}: {resp.text[:200]}"
                last_code = resp.status_code
                _t.sleep(2 * (attempt + 1))
                continue
            raise RuntimeError(f"Gemini API error {resp.status_code}: {resp.text[:500]}")

        if last_code == 429:
            raise QuotaError(
                "Gemini API quota exceeded (HTTP 429). The current API key has hit its "
                "rate/daily limit. Please switch to a different API key or enable billing."
            )
        raise RuntimeError(f"Gemini API failed after retries. Last: {last_err}")
