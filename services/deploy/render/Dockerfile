# Render (and local) container: the FastAPI app served by uvicorn.
# Build context is services/ (see render.yaml dockerContext). Distinct from
# deploy/aws/Dockerfile, which targets AWS Lambda via Mangum.
FROM python:3.12-slim

WORKDIR /app

# Deps first for layer caching.
COPY deploy/render/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code — copied to top-level packages so imports stay `api`, `core`, `adapters`.
COPY app/core      ./core
COPY app/adapters  ./adapters
COPY app/api       ./api

# Render (and most PaaS) inject $PORT; default to 8000 locally.
ENV PORT=8000 DATA_BACKEND=yfinance STORE_BACKEND=memory
EXPOSE 8000

# Shell form so $PORT expands at runtime.
CMD uvicorn api.app:app --host 0.0.0.0 --port ${PORT}
