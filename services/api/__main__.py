"""Local runner: `python -m api` starts uvicorn with reload.

Equivalent to: uvicorn api.app:app --reload --port 8000
"""
from __future__ import annotations

import os

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "api.app:app",
        host="127.0.0.1",
        port=int(os.getenv("PORT", "8000")),
        reload=True,
    )
