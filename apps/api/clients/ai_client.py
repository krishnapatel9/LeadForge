"""Single wrapper for all LLM calls, per AI Context Core §3:
'All LLM calls go through a single ai_client.py wrapper — never called ad hoc
from route handlers.' This is where retries, logging, and prompt-version
tagging live centrally.
"""

import json
import logging
import os
from pathlib import Path

from google import genai
from google.genai import errors as genai_errors
from google.genai import types as genai_types

logger = logging.getLogger("leadforge.ai_client")

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
MODEL = os.environ.get("LEADFORGE_MODEL", "gemini-2.5-flash")

_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))


def _load_prompt(name: str) -> str:
    path = PROMPTS_DIR / f"{name}.md"
    if not path.exists():
        raise FileNotFoundError(f"Prompt file not found: {path}")
    return path.read_text()


def _split_system_and_template(prompt_md: str) -> tuple[str, str]:
    """Prompt files use '## System' and '## User message template' headers."""
    system_part = prompt_md.split("## System")[1].split("## Output schema")[0].strip()
    template_part = prompt_md.split("## User message template")[1].strip()
    output_schema = prompt_md.split("## Output schema")[1].split("## User message template")[0].strip()
    system = f"{system_part}\n\nOutput schema:\n{output_schema}"
    return system, template_part


def call_structured(prompt_name: str, template_vars: dict, max_retries: int = 3) -> dict:
    """Loads a versioned prompt file, fills the template, calls Claude, and
    parses a JSON response. Retries on transient failures or malformed JSON.
    Returns the parsed dict; caller is responsible for validating against
    its own Pydantic model.
    """
    prompt_md = _load_prompt(prompt_name)
    system, template = _split_system_and_template(prompt_md)
    user_message = template.format(**template_vars)

    last_error: Exception | None = None
    for attempt in range(1, max_retries + 1):
        try:
            response = _client.models.generate_content(
                model=MODEL,
                contents=user_message,
                config=genai_types.GenerateContentConfig(
                    system_instruction=system,
                    max_output_tokens=1000,
                ),
            )
            text = (response.text or "").strip()
            # strip accidental code fences
            text = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            return json.loads(text)
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
