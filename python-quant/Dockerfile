FROM python:3.9-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    QUANT_SERVICE_PORT=8735

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8735
CMD ["sh", "-c", "uvicorn src.main:app --host 0.0.0.0 --port ${QUANT_SERVICE_PORT:-8735}"]
