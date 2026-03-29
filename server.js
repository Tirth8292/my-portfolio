require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const SESSION_COOKIE_NAME = "portfolio_admin_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 12;
const projectRoot = __dirname;
const dataDirectory = path.join(projectRoot, "data");
const databasePath = path.join(dataDirectory, "portfolio.sqlite");
const sessions = new Map();

if (!fs.existsSync(dataDirectory)) {
  fs.mkdirSync(dataDirectory, { recursive: true });
}

const database = new sqlite3.Database(databasePath, (error) => {
  if (error) {
    console.error("Database connection failed:", error.message);
    return;
  }

  console.log(`Connected to SQLite database at ${databasePath}`);
});

database.serialize(() => {
  database.run(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

const mailTransporter = createMailTransporter();

app.use(express.json());
app.use(express.static(projectRoot));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    authRequired: Boolean(ADMIN_PASSWORD)
  });
});

app.post("/api/contact", (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({
      message: "Name, email, and message are required."
    });
  }

  const trimmedPayload = {
    name: String(name).trim(),
    email: String(email).trim(),
    message: String(message).trim()
  };

  const insertSql = `
    INSERT INTO contact_messages (name, email, message)
    VALUES (?, ?, ?)
  `;

  database.run(
    insertSql,
    [trimmedPayload.name, trimmedPayload.email, trimmedPayload.message],
    async function onInsert(error) {
      if (error) {
        console.error("Failed to save contact message:", error.message);
        return res.status(500).json({
          message: "Failed to save your message."
        });
      }

      const emailResult = await sendNotificationEmail({
        id: this.lastID,
        ...trimmedPayload
      });

      return res.status(201).json({
        message: "Message saved successfully.",
        id: this.lastID,
        emailNotification: emailResult.sent
      });
    }
  );
});

app.get("/api/admin/session", (req, res) => {
  const sessionToken = getSessionToken(req);

  return res.json({
    authRequired: Boolean(ADMIN_PASSWORD),
    authenticated: Boolean(sessionToken || !ADMIN_PASSWORD)
  });
});

app.post("/api/admin/login", (req, res) => {
  const providedPassword = req.body?.password || "";

  if (ADMIN_PASSWORD && providedPassword !== ADMIN_PASSWORD) {
    return res.status(401).json({
      message: "Incorrect admin password."
    });
  }

  const sessionToken = createSession();
  setSessionCookie(res, sessionToken);

  return res.json({
    message: "Logged in successfully."
  });
});

app.post("/api/admin/logout", (req, res) => {
  const sessionToken = getSessionToken(req);

  if (sessionToken) {
    sessions.delete(sessionToken);
  }

  clearSessionCookie(res);
  return res.json({ message: "Logged out successfully." });
});

app.get("/api/admin/messages", requireAdmin, (_req, res) => {
  const sql = `
    SELECT id, name, email, message, created_at
    FROM contact_messages
    ORDER BY created_at DESC
  `;

  database.all(sql, [], (error, rows) => {
    if (error) {
      console.error("Failed to load messages:", error.message);
      return res.status(500).json({
        message: "Failed to load messages."
      });
    }

    return res.json(rows);
  });
});

app.delete("/api/admin/messages/:id", requireAdmin, (req, res) => {
  const messageId = Number(req.params.id);

  if (!Number.isInteger(messageId) || messageId <= 0) {
    return res.status(400).json({
      message: "Invalid message id."
    });
  }

  database.run(
    "DELETE FROM contact_messages WHERE id = ?",
    [messageId],
    function onDelete(error) {
      if (error) {
        console.error("Failed to delete message:", error.message);
        return res.status(500).json({
          message: "Failed to delete message."
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          message: "Message not found."
        });
      }

      return res.json({
        message: "Message deleted successfully."
      });
    }
  );
});

app.get("/api/admin/stats", requireAdmin, (_req, res) => {
  const statsSql = `
    SELECT
      COUNT(*) AS totalMessages,
      COUNT(DISTINCT email) AS uniqueEmails,
      MAX(created_at) AS latestMessage
    FROM contact_messages
  `;

  database.get(statsSql, [], (error, row) => {
    if (error) {
      console.error("Failed to load stats:", error.message);
      return res.status(500).json({
        message: "Failed to load dashboard stats."
      });
    }

    return res.json(row);
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

function requireAdmin(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return next();
  }

  const sessionToken = getSessionToken(req);

  if (!sessionToken) {
    return res.status(401).json({
      message: "Unauthorized."
    });
  }

  return next();
}

function createSession() {
  const token = crypto.randomUUID();
  sessions.set(token, {
    expiresAt: Date.now() + SESSION_DURATION_MS
  });
  return token;
}

function getSessionToken(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies[SESSION_COOKIE_NAME];

  if (!token) {
    return null;
  }

  const session = sessions.get(token);

  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }

  return token;
}

function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${SESSION_DURATION_MS / 1000}; SameSite=Lax`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
  );
}

function parseCookies(cookieHeader) {
  return cookieHeader
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .reduce((cookies, pair) => {
      const separatorIndex = pair.indexOf("=");

      if (separatorIndex === -1) {
        return cookies;
      }

      const key = pair.slice(0, separatorIndex);
      const value = pair.slice(separatorIndex + 1);
      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
}

function createMailTransporter() {
  const emailService = process.env.EMAIL_SERVICE;
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const rejectUnauthorized = process.env.EMAIL_TLS_REJECT_UNAUTHORIZED !== "false";

  if ((emailService && emailService.toLowerCase() === "gmail") || (gmailUser && gmailAppPassword)) {
    return nodemailer.createTransport({
      service: "gmail",
      tls: {
        rejectUnauthorized
      },
      auth: {
        user: gmailUser,
        pass: gmailAppPassword
      }
    });
  }

  if (!smtpHost || !smtpUser || !smtpPass) {
    return null;
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    tls: {
      rejectUnauthorized
    },
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });
}

async function sendNotificationEmail(entry) {
  if (!mailTransporter) {
    return { sent: false, reason: "not-configured" };
  }

  const recipient =
    process.env.CONTACT_NOTIFICATION_EMAIL ||
    process.env.OWNER_EMAIL ||
    process.env.GMAIL_USER ||
    process.env.SMTP_USER;

  const senderAddress =
    process.env.SMTP_FROM ||
    process.env.GMAIL_USER ||
    process.env.SMTP_USER;

  if (!recipient || !senderAddress) {
    return { sent: false, reason: "missing-recipient" };
  }

  try {
    await mailTransporter.sendMail({
      from: senderAddress,
      to: recipient,
      subject: `New portfolio contact from ${entry.name}`,
      replyTo: entry.email,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.7; color: #111827;">
          <h2 style="margin-bottom: 16px;">New portfolio message received</h2>
          <p><strong>Name:</strong> ${escapeEmailHtml(entry.name)}</p>
          <p><strong>Email:</strong> ${escapeEmailHtml(entry.email)}</p>
          <p><strong>Message ID:</strong> ${escapeEmailHtml(String(entry.id))}</p>
          <div style="margin-top: 20px; padding: 16px; border-radius: 12px; background: #f3f4f6;">
            <strong>Message</strong>
            <p style="margin-top: 10px; white-space: pre-wrap;">${escapeEmailHtml(entry.message)}</p>
          </div>
        </div>
      `,
      text: [
        "New portfolio message received.",
        "",
        `Name: ${entry.name}`,
        `Email: ${entry.email}`,
        `Message: ${entry.message}`,
        `Database ID: ${entry.id}`
      ].join("\n")
    });

    return { sent: true };
  } catch (error) {
    console.error("Email notification failed:", error.message);
    return { sent: false, reason: "send-failed" };
  }
}

function escapeEmailHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
