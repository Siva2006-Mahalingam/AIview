import json
import os
from typing import Any

import requests


def _groq_headers() -> dict[str, str]:
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        raise ValueError("GROQ_API_KEY is not configured")
    return {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}


def _chat_completion(messages: list[dict[str, str]], max_tokens: int = 1024) -> str:
    response = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers=_groq_headers(),
        json={"model": "llama-3.1-8b-instant", "messages": messages, "max_tokens": max_tokens, "temperature": 0.7},
        timeout=45,
    )
    response.raise_for_status()
    data = response.json()
    return data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()


def generate_interview_reply(interview_type: str, role: str, resume_text: str, messages: list[dict[str, str]]) -> str:
    system_prompt = f"""You are an experienced AI interviewer for a {role} role.
Interview type: {interview_type}. Ask one concise question at a time.
Use resume context if available:
{resume_text or "No resume provided."}
Keep tone professional and encouraging."""
    try:
        return _chat_completion([{"role": "system", "content": system_prompt}] + messages, max_tokens=600)
    except (ValueError, requests.RequestException):
        return "Hello! Let's continue your interview. Tell me about your recent project and your specific impact."


def generate_feedback(payload: dict[str, Any]) -> dict[str, Any]:
    questions = payload.get("questions", [])
    prompt = f"""Analyze this interview and return ONLY JSON:
{{
  "atsScore": number|null,
  "performancePercentage": number,
  "overallFeedback": string,
  "improvements": string,
  "questionFeedback":[{{"questionNumber":number,"score":number,"feedback":string}}]
}}
Data:
interviewType={payload.get("interviewType")}
role={payload.get("role")}
resumeText={payload.get("resumeText")}
questions={questions}
emotionData={payload.get("emotionData", [])}
If no resumeText, atsScore must be null."""
    try:
        raw = _chat_completion([{"role": "user", "content": prompt}], max_tokens=2500)
        raw = raw.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(raw)
    except (ValueError, requests.RequestException, json.JSONDecodeError):
        parsed = {}
    parsed.setdefault("atsScore", None if not (payload.get("resumeText") or "").strip() else 65)
    parsed.setdefault("performancePercentage", 70)
    parsed.setdefault("overallFeedback", "Good effort. Improve structure and specificity.")
    parsed.setdefault("improvements", "Use STAR method and quantify outcomes.")
    if not parsed.get("questionFeedback"):
        parsed["questionFeedback"] = [
            {"questionNumber": idx + 1, "score": 70, "feedback": "Add concrete examples and measurable outcomes."}
            for idx, _ in enumerate(questions)
        ]
    return parsed


def generate_coach_tip(question: str, answer: str) -> str:
    prompt = f"""Give one coaching tip under 50 words.
Question: {question}
Answer: {answer}"""
    try:
        return _chat_completion([{"role": "user", "content": prompt}], max_tokens=80)
    except (ValueError, requests.RequestException):
        return "Use STAR: briefly frame Situation/Task, explain your Action, and end with a measurable Result."

