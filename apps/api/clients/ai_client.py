"""Single wrapper for all LLM calls, per AI Context Core §3:
'All LLM calls go through a single ai_client.py wrapper — never called ad hoc
from route handlers.' This is where retries, logging, and prompt-version
tagging live centrally.
"""

import json
import logging
from pathlib import Path

from apps.api.config import settings
from google import genai
from google.genai import errors as genai_errors
from google.genai import types as genai_types

logger = logging.getLogger("leadforge.ai_client")

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
MODEL = settings.LEADFORGE_MODEL

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    """Created on first use, from settings (which reads .env). Building it at import
    time crashed the whole API when no key was set, and os.environ ignored keys
    that were only in .env."""
    global _client
    if _client is None:
        if not settings.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is not set; AI research and drafting are unavailable.")
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


def _load_prompt(name: str) -> str:
    path = PROMPTS_DIR / f"{name}.md"
    if not path.exists():
        raise FileNotFoundError(f"Prompt file not found: {path}")
    return path.read_text(encoding="utf-8")


def _split_system_and_template(prompt_md: str) -> tuple[str, str]:
    """Prompt files use '## System' and '## User message template' headers."""
    system_part = prompt_md.split("## System")[1].split("## Output schema")[0].strip()
    template_part = prompt_md.split("## User message template")[1].strip()
    output_schema = prompt_md.split("## Output schema")[1].split("## User message template")[0].strip()
    system = f"{system_part}\n\nOutput schema:\n{output_schema}"
    return system, template_part


def _generation_config(system: str) -> genai_types.GenerateContentConfig:
    kwargs = dict(
        system_instruction=system,
        response_mime_type="application/json",
        # Gemini 2.5 counts "thinking" tokens against max_output_tokens; a 1000-token
        # cap could be spent entirely on thinking and return an empty/cut-off reply.
        max_output_tokens=2048,
    )
    if "flash" in MODEL:
        # Flash models allow turning thinking off; these prompts don't need it.
        kwargs["thinking_config"] = genai_types.ThinkingConfig(thinking_budget=0)
    return genai_types.GenerateContentConfig(**kwargs)


def _parse_json(text: str | None) -> dict:
    text = (text or "").strip()
    # strip accidental code fences
    text = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    data = json.loads(text)
    if not isinstance(data, dict):
        raise json.JSONDecodeError("expected a JSON object", text, 0)
    return data


async def call_structured(prompt_name: str, template_vars: dict, max_retries: int = 3) -> dict:
    """Loads a versioned prompt file, fills the template, calls Gemini, and
    parses a JSON response. Retries on transient failures or malformed JSON.
    Async, so a slow model call never blocks other API requests.
    Returns the parsed dict; caller is responsible for validating against
    its own Pydantic model.
    """
    prompt_md = _load_prompt(prompt_name)
    system, template = _split_system_and_template(prompt_md)
    user_message = template.format(**template_vars)
    config = _generation_config(system)

    last_error: Exception | None = None
    for attempt in range(1, max_retries + 1):
        try:
            response = await _get_client().aio.models.generate_content(
                model=MODEL,
                contents=user_message,
                config=config,
            )
            return _parse_json(response.text)
        except (json.JSONDecodeError, genai_errors.APIError) as exc:
            last_error = exc
            logger.warning(
                "ai_client call failed (attempt %s/%s) for prompt=%s: %s",
                attempt, max_retries, prompt_name, exc,
            )

    raise RuntimeError(
        f"ai_client.call_structured failed after {max_retries} attempts "
        f"for prompt={prompt_name}: {last_error}"
    )


async def probe() -> str:
    """Cheap check that the key works and the model exists (no tokens generated)."""
    await _get_client().aio.models.get(model=MODEL)
    return MODEL
