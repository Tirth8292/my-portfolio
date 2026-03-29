const adminLogin = document.getElementById("adminLogin");
const adminDashboard = document.getElementById("adminDashboard");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminPassword = document.getElementById("adminPassword");
const adminNote = document.getElementById("adminNote");
const logoutButton = document.getElementById("logoutButton");
const messagesGrid = document.getElementById("messagesGrid");
const messageSearch = document.getElementById("messageSearch");
const totalMessages = document.getElementById("totalMessages");
const uniqueEmails = document.getElementById("uniqueEmails");
const latestMessageDate = document.getElementById("latestMessageDate");
const adminEmpty = document.getElementById("adminEmpty");

let allMessages = [];

initializeAdmin();

async function initializeAdmin() {
  try {
    const sessionResponse = await fetch("/api/admin/session");
    const session = await sessionResponse.json();

    if (session.authenticated) {
      showDashboard();
      await loadDashboardData();
    } else {
      showLogin();

      if (!session.authRequired) {
        setAdminNote("No admin password is configured. Click open dashboard to continue.", "is-success");
      }
    }
  } catch (_error) {
    showLogin();
    setAdminNote("Unable to connect to the admin service.", "is-error");
  }
}

if (adminLoginForm) {
  adminLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    setAdminNote("Opening dashboard...", "");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          password: adminPassword ? adminPassword.value : ""
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Login failed.");
      }

      showDashboard();
      await loadDashboardData();
      setAdminNote("", "");
    } catch (error) {
      setAdminNote(error.message || "Login failed.", "is-error");
    }
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    await fetch("/api/admin/logout", {
      method: "POST"
    });

    showLogin();
    setAdminNote("Logged out successfully.", "is-success");

    if (adminPassword) {
      adminPassword.value = "";
    }
  });
}

if (messageSearch) {
  messageSearch.addEventListener("input", () => {
    renderMessages(filterMessages(messageSearch.value));
  });
}

async function loadDashboardData() {
  const [statsResponse, messagesResponse] = await Promise.all([
    fetch("/api/admin/stats"),
    fetch("/api/admin/messages")
  ]);

  if (statsResponse.status === 401 || messagesResponse.status === 401) {
    showLogin();
    setAdminNote("Your admin session expired. Please log in again.", "is-error");
    return;
  }

  const stats = await statsResponse.json();
  const messages = await messagesResponse.json();

  allMessages = Array.isArray(messages) ? messages : [];

  totalMessages.textContent = stats.totalMessages ?? 0;
  uniqueEmails.textContent = stats.uniqueEmails ?? 0;
  latestMessageDate.textContent = stats.latestMessage
    ? formatDate(stats.latestMessage)
    : "-";

  renderMessages(allMessages);
}

function renderMessages(messages) {
  if (!messagesGrid || !adminEmpty) return;

  messagesGrid.innerHTML = "";

  if (!messages.length) {
    adminEmpty.hidden = false;
    return;
  }

  adminEmpty.hidden = true;

  messages.forEach((message) => {
    const card = document.createElement("article");
    card.className = "message-card";
    card.innerHTML = `
      <div class="message-head">
        <div>
          <h3>${escapeHtml(message.name)}</h3>
          <a class="message-email" href="mailto:${escapeAttribute(message.email)}">${escapeHtml(message.email)}</a>
        </div>
        <div class="message-actions">
          <span class="message-meta">${formatDate(message.created_at)}</span>
          <button class="message-delete-button" type="button" data-message-id="${message.id}">
            Delete
          </button>
        </div>
      </div>
      <p class="message-body">${escapeHtml(message.message)}</p>
    `;

    const deleteButton = card.querySelector(".message-delete-button");
    if (deleteButton) {
      deleteButton.addEventListener("click", () => {
        deleteMessage(message.id, deleteButton);
      });
    }

    messagesGrid.appendChild(card);
  });
}

async function deleteMessage(messageId, button) {
  const confirmed = window.confirm("Delete this message permanently?");

  if (!confirmed) {
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Deleting...";

  try {
    const response = await fetch(`/api/admin/messages/${messageId}`, {
      method: "DELETE"
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Delete failed.");
    }

    allMessages = allMessages.filter((message) => message.id !== messageId);
    renderMessages(filterMessages(messageSearch ? messageSearch.value : ""));
    await refreshStats();
  } catch (error) {
    window.alert(error.message || "Unable to delete this message.");
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function refreshStats() {
  const response = await fetch("/api/admin/stats");

  if (response.status === 401) {
    showLogin();
    setAdminNote("Your admin session expired. Please log in again.", "is-error");
    return;
  }

  const stats = await response.json();
  totalMessages.textContent = stats.totalMessages ?? 0;
  uniqueEmails.textContent = stats.uniqueEmails ?? 0;
  latestMessageDate.textContent = stats.latestMessage
    ? formatDate(stats.latestMessage)
    : "-";
}

function filterMessages(searchTerm) {
  const query = searchTerm.trim().toLowerCase();

  if (!query) {
    return allMessages;
  }

  return allMessages.filter((message) => {
    return [message.name, message.email, message.message]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query));
  });
}

function showLogin() {
  if (adminLogin) {
    adminLogin.hidden = false;
  }

  if (adminDashboard) {
    adminDashboard.hidden = true;
  }
}

function showDashboard() {
  if (adminLogin) {
    adminLogin.hidden = true;
  }

  if (adminDashboard) {
    adminDashboard.hidden = false;
  }
}

function setAdminNote(text, stateClass) {
  if (!adminNote) return;

  adminNote.textContent = text;
  adminNote.className = "admin-note";

  if (stateClass) {
    adminNote.classList.add(stateClass);
  }
}

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
