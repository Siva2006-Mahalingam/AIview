# InterviewAI (Django + MySQL + HTML/CSS/JS)

This project has been migrated to a Django full-stack application.

## Stack

- Backend: Python Django
- Database: MySQL
- Frontend: Django templates + static HTML/CSS/JavaScript

## Setup

1. Create and activate Python virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Configure environment from `.env.example`.
4. Create MySQL database (`interviewai` by default).
5. Run migrations:

```bash
python manage.py migrate
```

6. Create admin user (optional):

```bash
python manage.py createsuperuser
```

7. Run server:

```bash
python manage.py runserver
```

App routes include `/`, `/auth/`, `/dashboard/`, `/interview-setup/`, `/history/`, `/results/<id>/`.

## Notes

- Sensitive API keys are stored server-side in environment variables.
- Frontend calls Django JSON APIs under `/api/...`.
- Existing React source is retained in repository history/files, but app runtime now uses Django templates and static assets.
