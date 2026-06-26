# AWS Lambda container image: the FastAPI app served via the Mangum handler.
# Built by CDK (DockerImageFunction); build context is services/ (see the CDK
# stack). Distinct from deploy/render/Dockerfile (uvicorn) — this uses AWS's
# Lambda base image and the handler entrypoint, not a web server.
FROM public.ecr.aws/lambda/python:3.12

# Deps first for layer caching. $LAMBDA_TASK_ROOT is /var/task.
COPY deploy/aws/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code into the task root so `api.handler` is importable as a top-level package.
COPY app/core      ${LAMBDA_TASK_ROOT}/core
COPY app/adapters  ${LAMBDA_TASK_ROOT}/adapters
COPY app/api       ${LAMBDA_TASK_ROOT}/api

# Lambda handler: module.path.object → api/handler.py defines `handler = Mangum(app)`.
CMD [ "api.handler.handler" ]
