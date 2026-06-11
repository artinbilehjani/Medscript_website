// Adjust if your API is on another origin, e.g. "http://localhost:8000"
const API_BASE = "/accounts/api/v1";
const LOGIN_URL = `${API_BASE}/auth/login/`;
const CAPTCHA_URL = `${API_BASE}/auth/captcha/`;

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
}

function csrfHeader() {
  const token = getCookie("csrftoken");
  return token ? { "X-CSRFToken": token } : {};
}

function setMsg(el, text, type) {
  el.textContent = text || "";
  el.classList.remove("mg-error", "mg-ok");
  if (type) el.classList.add(type);
}

function normalizeDrfErrors(data) {
  if (!data) return "Login failed.";
  if (typeof data === "string") return data;
  if (data.detail) return data.detail;

  if (typeof data === "object") {
    const lines = [];
    for (const [k, v] of Object.entries(data)) {
      if (Array.isArray(v)) lines.push(`${k}: ${v.join(" ")}`);
      else if (typeof v === "string") lines.push(`${k}: ${v}`);
      else lines.push(`${k}: ${JSON.stringify(v)}`);
    }
    if (lines.length) return lines.join("\n");
  }
  return "Login failed.";
}

async function loadCaptcha() {
  const captchaQuestionEl = document.getElementById("mgCaptchaQuestion");
  const captchaKeyEl = document.getElementById("mgCaptchaKey");
  const captchaMsg = document.getElementById("mgCaptchaMsg");

  if (!captchaQuestionEl || !captchaKeyEl || !captchaMsg) return;

  setMsg(captchaMsg, "Loading CAPTCHA...", null);

  try {
    const res = await fetch(CAPTCHA_URL, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.captcha_key || !data?.captcha_question) {
      setMsg(captchaMsg, "Failed to load CAPTCHA.", "mg-error");
      return;
    }

    captchaKeyEl.value = data.captcha_key;
    captchaQuestionEl.textContent = data.captcha_question;
    setMsg(captchaMsg, "", null);
  } catch {
    setMsg(captchaMsg, "Failed to load CAPTCHA (network).", "mg-error");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("mgLoginForm");
  const msg = document.getElementById("mgMsg");
  const submitBtn = form?.querySelector('button[type="submit"]');

  if (!form || !msg || !submitBtn) return;

  // --- Show/Hide password toggle ---
  const pwInput = form.querySelector('input[name="password"]');
  const togglePwBtn = document.getElementById("mgTogglePassword");

  if (pwInput && togglePwBtn) {
    togglePwBtn.addEventListener("click", () => {
      const show = pwInput.type === "password";
      pwInput.type = show ? "text" : "password";
      togglePwBtn.textContent = show ? "Hide" : "Show";
      togglePwBtn.setAttribute("aria-pressed", String(show));
    });
  }

  const refreshBtn =
    document.getElementById("mgCaptchaReload") ||
    document.getElementById("refreshCaptcha");

  refreshBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    loadCaptcha();
  });

  await loadCaptcha();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg(msg, "", null);

    const fd = new FormData(form);
    const username = (fd.get("username") || "").toString().trim();
    const password = (fd.get("password") || "").toString();
    const captcha_key = (fd.get("captcha_key") || "").toString().trim();
    const captcha_value = (fd.get("captcha_value") || "").toString().trim();

    if (!username || !password) {
      setMsg(msg, "Username and password are required.", "mg-error");
      return;
    }
    if (!captcha_key || !captcha_value) {
      setMsg(msg, "CAPTCHA is required.", "mg-error");
      return;
    }

    submitBtn.disabled = true;
    try {
      const res = await fetch(LOGIN_URL, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...csrfHeader(),
        },
        body: JSON.stringify({ username, password, captcha_key, captcha_value }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setMsg(msg, normalizeDrfErrors(data), "mg-error");
        form.querySelector('input[name="captcha_value"]').value = "";
        await loadCaptcha();
        return;
      }

      setMsg(msg, "Logged in.", "mg-ok");
      setTimeout(() => (window.location.href = "/accounts/profile/"), 400);
    } catch {
      setMsg(msg, "Network error. Check API_BASE / server.", "mg-error");
    } finally {
      submitBtn.disabled = false;
    }
  });
});