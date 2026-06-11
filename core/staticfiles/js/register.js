// Adjust if your API is on another origin, e.g. "http://localhost:8000"
const API_BASE = "/accounts/api/v1";
const REGISTER_URL = `${API_BASE}/auth/register/`;
const CAPTCHA_URL = `${API_BASE}/auth/captcha/`;


function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
}

// SessionAuthentication needs CSRF for POST.
// This expects Django to set "csrftoken" cookie (via middleware / ensure_csrf_cookie).
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
  if (!data) return "Request failed.";
  if (typeof data === "string") return data;
  if (data.detail && typeof data.detail === "string") return data.detail;

  const lines = [];

  const push = (path, val) => {
    const key = path || "error";

    if (val == null) return;

    if (typeof val === "string") {
      lines.push(path ? `${key}: ${val}` : val);
      return;
    }

    if (Array.isArray(val)) {
      for (const item of val) push(path, item);
      return;
    }

    if (typeof val === "object") {
      // common DRF shape: {message, code}
      if (typeof val.message === "string") {
        lines.push(path ? `${key}: ${val.message}` : val.message);
        return;
      }

      for (const [k, v] of Object.entries(val)) {
        const nextPath =
          k === "non_field_errors" ? path : (path ? `${path}.${k}` : k);
        push(nextPath, v);
      }
      return;
    }

    lines.push(`${key}: ${String(val)}`);
  };

  push("", data);
  return lines.length ? [...new Set(lines)].join("\n") : "Request failed.";
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
  const form = document.getElementById("mgRegisterForm");
  const msg = document.getElementById("mgMsg");
  const submitBtn = form.querySelector('button[type="submit"]');

  if (!form || !msg || !submitBtn) return;

  // --- Show/Hide password toggle (works for both password + confirm) ---
form.addEventListener("click", (e) => {
  const btn = e.target.closest(".mgTogglePassword");
  if (!btn) return;

  const wrapper = btn.closest(".mg-password");
  const input = wrapper?.querySelector("input");
  if (!input) return;

  const show = input.type === "password";
  input.type = show ? "text" : "password";
  btn.textContent = show ? "Hide" : "Show";
  btn.setAttribute("aria-pressed", String(show));
});

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
    const passwordConfirm = (fd.get("password2") || "").toString();
    const captcha_key = (fd.get("captcha_key") || "").toString().trim();
    const captcha_value = (fd.get("captcha_value") || "").toString().trim();

    if (!username || !password) {
      setMsg(msg, "Username and password are required.", "mg-error");
      return;
    }
    if (password !== passwordConfirm) {
      setMsg(msg, "Passwords do not match.", "mg-error");
      return;
    }
    if (!captcha_key || !captcha_value) {
      setMsg(msg, "CAPTCHA is required.", "mg-error");
      return;
    }

    submitBtn.disabled = true;
    try {
      const res = await fetch(REGISTER_URL, {
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
        // always refresh captcha after a failed attempt (prevents replay)
        form.querySelector('input[name="captcha_value"]').value = "";
        await loadCaptcha();
        return;
      }

      setMsg(msg, "Registered successfully. You can log in now.", "mg-ok");
      // Redirect after a moment
      setTimeout(() => {
        window.location.href = "/accounts/login/";
      }, 400);
    } catch (err) {
      setMsg(msg, "Network error. Check API_BASE / server.", "mg-error");
    } finally {
      submitBtn.disabled = false;
    }
  });
});