# Hardware daemon for the 16x2 LCD + 4 GPIO buttons. arm64 (Raspberry Pi).
# lgpio builds its C extension from source on arm (needs swig + build tools).
FROM python:3.11-slim

RUN apt-get update
RUN apt-get install -y --no-install-recommends build-essential python3-dev swig
RUN rm -rf /var/lib/apt/lists/*

# Use gpiozero's lgpio backend (RPi.GPIO edge detection is broken on Bookworm).
ENV GPIOZERO_PIN_FACTORY=lgpio

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY daemon.py .

CMD ["python", "-u", "daemon.py"]
