# Hardware daemon for the 16x2 LCD + 4 GPIO buttons. arm64 (Raspberry Pi).
# RPi.GPIO compiles from source on arm, so build tools + headers are needed.
FROM python:3.11-slim

RUN apt-get update
RUN apt-get install -y --no-install-recommends build-essential python3-dev
RUN rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY daemon.py .

CMD ["python", "-u", "daemon.py"]
