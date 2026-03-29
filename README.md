# Tirth Shah Portfolio

Premium portfolio website with:

- Modern responsive frontend
- SQLite database for contact messages
- Admin dashboard to view submissions
- Optional Gmail or SMTP email notifications
- Deployment-ready Node server

## Run locally

```powershell
npm.cmd install
npm.cmd start
```

Open:

- `http://localhost:3000`
- `http://localhost:3000/admin.html`

Quick start files:

- `start-portfolio.bat`
- `stop-portfolio.bat`

## Environment variables

Copy `.env.example` to `.env` and update values if needed.

- `ADMIN_PASSWORD`: protects the admin dashboard
- `EMAIL_SERVICE=gmail`: enables Gmail mode
- `GMAIL_USER`, `GMAIL_APP_PASSWORD`: Gmail sender account and app password
- `OWNER_EMAIL`: Gmail inbox where portfolio messages are sent
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: email settings
- `CONTACT_NOTIFICATION_EMAIL`: where new message alerts are sent

If Gmail or SMTP variables are not set, the form still saves to the database, but email notifications stay disabled.

## Gmail setup

For Gmail, use these values in `.env`:

```env
EMAIL_SERVICE=gmail
GMAIL_USER=yourgmail@gmail.com
GMAIL_APP_PASSWORD=your-16-digit-app-password
OWNER_EMAIL=yourgmail@gmail.com
```

Important:

- turn on 2-Step Verification in your Google account
- create a Google App Password
- use the App Password in `GMAIL_APP_PASSWORD`, not your normal Gmail password

If your local machine shows a certificate error like `self-signed certificate in certificate chain`, add this to `.env`:

```env
EMAIL_TLS_REJECT_UNAUTHORIZED=false
```

That setting is mainly a local development workaround for machines or networks that inject their own certificates.

## Database

Messages are stored in:

- `data/portfolio.sqlite`

Table name:

- `contact_messages`

## Deploy

This project is ready to deploy as a standard Node app or with Docker.

### Docker

```powershell
docker build -t tirth-portfolio .
docker run -p 3000:3000 --env-file .env tirth-portfolio
```

### Node hosting

Use:

- Build command: `npm install`
- Start command: `npm start`

For public deployment, set `ADMIN_PASSWORD` and SMTP variables in your hosting dashboard.
