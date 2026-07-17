# CareerOS Backend Dockerfile
FROM python:3.11-slim

WORKDIR /app

# System deps for some ML libs (lightgbm/xgboost need libgomp)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libgomp1 wget && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Scam Shield engine loads trained .joblib from the original JobShieldAI dir.
# Mount that path at runtime (see docker-compose) or set JOBSHIELD_MODEL_DIR.
ENV PYTHONPATH=/app
ENV JOBSHIELD_MODEL_DIR=/models

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
