FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY gps_simulator.py can_simulator.py ./

CMD ["sh", "-c", "if [ \"$SIMULATOR_TYPE\" = \"gps\" ]; then exec python -u gps_simulator.py; else exec python -u can_simulator.py; fi"]
