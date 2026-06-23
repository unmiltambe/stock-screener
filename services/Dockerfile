# Interim demo container: runs the FastAPI app (JSON /v1 API + /ui demo) under
# uvicorn. Built from the services/ directory so core, adapters, and api import
# via the working directory — no editable install needed.
FROM python:3.12-slim

WORKDIR /app

# Install deps first for layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code.
COPY core ./core
COPY adapters ./adapters
COPY api ./api

# Render (and most PaaS) inject $PORT; default to 8000 locally.
ENV PORT=8000 DATA_BACKEND=yfinance STORE_BACKEND=memory
EXPOSE 8000

# Shell form so $PORT expands at runtime.
CMD uvicorn api.app:app --host 0.0.0.0 --port ${PORT}
