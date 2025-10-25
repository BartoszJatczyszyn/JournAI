from __future__ import annotations

import os
import time
from typing import List, Dict, Any, Optional

import asyncio
import httpx

DEFAULT_TIMEOUT = float(os.getenv("LLM_HTTP_TIMEOUT", "60"))


class LLMService:
    
    def __init__(self, base_url: Optional[str] = None, model: Optional[str] = None, timeout: Optional[float] = None) -> None:
        self.base_url = (base_url or os.getenv("LLM_BASE_URL") or "http://localhost:8080/v1").rstrip("/")
        self.model = model or os.getenv("LLM_MODEL") or "local-gguf"
        self.timeout = timeout or DEFAULT_TIMEOUT

    async def health(self) -> Dict[str, Any]:
        # Try models list endpoint if available
        url = f"{self.base_url}/models"
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(url)
                r.raise_for_status()
                return {"status": "ok", "models": (r.json().get("data") if r.headers.get("content-type", "").startswith("application/json") else None)}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    async def chat(self, messages: List[Dict[str, str]], temperature: float = 0.3, max_tokens: int = 512, top_p: float = 0.95) -> Dict[str, Any]:
        """Send a chat completion request to the LLM.

        messages: [{role: system|user|assistant, content: str}, ...]
        Returns { content: str, raw: full_response }
        """
        # Prefer OpenAI-compatible endpoint
        url = f"{self.base_url}/chat/completions" if self.base_url.endswith("/v1") else f"{self.base_url}/v1/chat/completions"
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": float(temperature),
            "max_tokens": int(max_tokens),
            "top_p": float(top_p),
            "stream": False,
        }
        headers = {"content-type": "application/json"}
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                r = await client.post(url, json=payload, headers=headers)
                r.raise_for_status()
                data = r.json()
            content = None
            try:
                content = data.get("choices", [{}])[0].get("message", {}).get("content")
            except Exception:
                content = None
            if not content:
                # Fallback: some llama.cpp builds respond with {content} at top-level
                content = data.get("content") if isinstance(data, dict) else None
            return {"content": content or "", "raw": data}
        except Exception as e:
            
            try:
                fallback_url = f"{self.base_url}/completion" if self.base_url.endswith("/v1") else f"{self.base_url}/completion"
                prompt = self._messages_to_prompt(messages)
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    r = await client.post(fallback_url, json={
                        "prompt": prompt,
                        "n_predict": max_tokens,
                        "temperature": temperature,
                        "top_p": top_p,
                    }, headers=headers)
                    r.raise_for_status()
                    data = r.json()
                content = data.get("content") or data.get("completion") or ""
                return {"content": content, "raw": data}
            except Exception as ee:
                raise RuntimeError(f"LLM request failed: {e}; fallback error: {ee}")

    @staticmethod
    def _messages_to_prompt(messages: List[Dict[str, str]]) -> str:
        # Simple conversion for fallback completion API
        out = []
        for m in messages:
            role = m.get("role", "user")
            content = m.get("content", "")
            if role == "system":
                out.append(f"[SYSTEM]\n{content}\n")
            elif role == "assistant":
                out.append(f"[ASSISTANT]\n{content}\n")
            else:
                out.append(f"[USER]\n{content}\n")
        out.append("[ASSISTANT]\n")
        return "\n".join(out)


__all__ = ["LLMService"]
