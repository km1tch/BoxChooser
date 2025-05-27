FROM python:3.9

# Install SQLite3 CLI
RUN apt-get update && apt-get install -y sqlite3 && rm -rf /var/lib/apt/lists/*

WORKDIR /code

# Create directories for mounted volumes
RUN mkdir -p /db /code/stores /code/floorplans && chmod 777 /db

COPY ./requirements.txt /code/requirements.txt

RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# Copy only the application code
COPY ./backend /code/backend

EXPOSE 8000

# Run FastAPI on port 8000 (standard uvicorn port)
CMD mkdir -p /db && chmod 777 /db && cd /code && uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload