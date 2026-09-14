FROM python:3.12-slim

RUN pip install --no-cache-dir mcp-korea-tourism-api==0.1.2

EXPOSE 8000
CMD ["python", "-m", "mcp_tourism.server", "--transport", "streamable-http", "--host", "0.0.0.0", "--port", "8000"]
