FROM python:3.12-slim

# The code imports itself as the `apps.api` package, so it lives at /srv/apps/api
WORKDIR /srv
COPY requirements.txt /srv/requirements.txt
RUN pip install --no-cache-dir -r /srv/requirements.txt

COPY . /srv/apps/api
RUN touch /srv/apps/__init__.py

ENV PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["uvicorn", "apps.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
