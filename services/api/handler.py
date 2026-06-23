"""AWS Lambda entrypoint — wraps the FastAPI app with Mangum.

Referenced by the CDK Lambda definition (infra). Importing this module is cheap;
the heavy adapter wiring is lazy (see deps._build_service).
"""
from __future__ import annotations

from mangum import Mangum

from .app import app

handler = Mangum(app)
