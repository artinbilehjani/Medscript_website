
// Adjust these endpoints if your URLs differ
const API_BASE = "/accounts/api/v1";
const PROFILE_URL = `${API_BASE}/me/profile/`;
const CHANGEPASSWORD_URL = `${API_BASE}/me/change-password/`;
const DELETE_URL = `${API_BASE}/me/delete/`;
const LOGOUT_URL = `${API_BASE}/me/logout/`;
const CSRF_URL = `${API_BASE}/me/csrf/`;

const el = (id) => document.getElementById(id);

const ui = {
  refreshBtn: el("mgp-refresh-btn"),
  logoutBtn: el("mgp-logout-btn"),
  deleteBtn: el("mgp-delete-btn"),

  avatar: el("mgp-avatar"),
  imageInput: el("mgp-image-input"),
  statusPill: el("mgp-status-pill"),
  fullName:el("mgp-full-name"),
  username: el("mgp-username"),
  emailText: el("mgp-email"),
  position: el("mgp-position"),

  profileForm: el("mgp-profile-form"),
  displayName: el("mgp-display-name"),
  firstName: el("mgp-first-name"),
  lastName: el("mgp-last-name"),
  bio: el("mgp-bio"),
  saveBtn: el("mgp-save-btn"),
  resetBtn: el("mgp-reset-btn"),
  formStatus: el("mgp-form-status"),

  passForm: el("mgp-password-form"),
  oldPass: el("mgp-old-password"),
  newPass: el("mgp-new-password"),
  confirmPass: el("mgp-confirm-password"),
  passStatus: el("mgp-pass-status"),

  toast: el("mgp-toast"),
  toastContent: el("mgp-toast-content"),
  toastClose: el("mgp-toast-close"),
};

let lastLoadedProfile = null;

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
}

function csrfHeader() {
  const token = getCookie("csrftoken");
  return token ? { "X-CSRFToken": decodeURIComponent(token) } : {};
}

async function ensureCsrfCookie() {
  await fetch(CSRF_URL, { credentials: "include" });
}

function showToast(message, tone = "info") {
  // tone: info | ok | warn | error
  const prefix = {
    info: "Info",
    ok: "Success",
    warn: "Warning",
    error: "Error",
  }[tone] || "Info";

  ui.toastContent.textContent = `${prefix}: ${message}`;
  ui.toast.hidden = false;

  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => {
    ui.toast.hidden = true;
  }, 4000);
}

function setStatus(text, tone = "info") {
  ui.statusPill.textContent = text;
  const map = {
    info: "rgba(255,255,255,0.18)",
    ok: "rgba(34,197,94,0.18)",
    warn: "rgba(245,158,11,0.20)",
    error: "rgba(239,68,68,0.20)",
  };
  ui.statusPill.style.background = map[tone] || map.info;
  ui.statusPill.style.borderColor = "rgba(255,255,255,0.12)";
}

function setInlineStatus(node, text, tone = "info") {
  node.textContent = text || "";
  const map = {
    info: "rgba(255,255,255,0.68)",
    ok: "rgba(34,197,94,0.95)",
    warn: "rgba(245,158,11,0.95)",
    error: "rgba(239,68,68,0.95)",
  };
  node.style.color = map[tone] || map.info;
}


async function apiFetch(url, options = {}) {
  const opts = { ...options, credentials: "include" };

  const headers = new Headers(opts.headers || {});
  headers.set("Accept", "application/json");

  const method = (opts.method || "GET").toUpperCase();
  const unsafe = !["GET", "HEAD", "OPTIONS", "TRACE"].includes(method);

  if (unsafe) {
    const token = getCookie("csrftoken");
    if (token) headers.set("X-CSRFToken", token);

    const isFormData = opts.body instanceof FormData;
    if (isFormData) headers.delete("Content-Type");
    else if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...opts, headers });

  let data = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) data = await res.json().catch(() => null);
  else data = await res.text().catch(() => null);

  if (!res.ok) {
    const message = extractErrorMessage(data) || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  setCanEditImage(!!data.can_edit_image);
  return data;
}

function extractErrorMessage(data) {
  if (!data) return null;
  if (typeof data === "string") return data;

  // DRF often returns {detail: "..."} or field errors {field: ["..."]}
  if (data.detail) return data.detail;

  const firstKey = Object.keys(data)[0];
  if (!firstKey) return null;

  const v = data[firstKey];
  if (Array.isArray(v)) return `${firstKey}: ${v[0]}`;
  if (typeof v === "string") return `${firstKey}: ${v}`;
  return null;
}

function hydrateProfile(profile) {
  // Adjust these mappings to your actual serializer fields
  const first = profile.first_name ?? "";
  const last = profile.last_name ?? "";
  const fullName = (first || last) ? `${first} ${last}`.trim() : (profile.username ?? "—");

  const canEditImage = !!profile.can_edit_image;
  ui.imageInput.disabled = !canEditImage;          // or hide it

  ui.fullName.textContent = fullName;
  ui.username.textContent = profile.username ?? "—";
  ui.emailText.textContent = profile.email ?? "—";
  ui.position.textContent = profile.user_position.name ?? "—";

  ui.displayName.value = profile.display_name ?? "";
  ui.firstName.value = first;
  ui.lastName.value = last;
  ui.bio.value = profile.description ?? "";

  if (profile.image) ui.avatar.src = profile.image;

  lastLoadedProfile = {
    image: ui.avatar.src,
    display_name: ui.displayName.value, 
    first_name: ui.firstName.value,
    last_name: ui.lastName.value,
    description: ui.bio.value,
  };
}

function collectProfilePayload() {
  // Send only the fields you support server-side
  return {
    image: ui.avatar.src,
    display_name: ui.displayName.value.trim(),
    first_name: ui.firstName.value.trim(),
    last_name: ui.lastName.value.trim(),
    description: ui.bio.value.trim(),
  };
}

function resetFormToLastLoaded() {
  if (!lastLoadedProfile) return;
  ui.avatar.src = lastLoadedProfile.image ?? "/media/images/system/blank_profile_picture.svg";
  ui.displayName.value = lastLoadedProfile.display_name ?? "";
  ui.firstName.value = lastLoadedProfile.first_name ?? "";
  ui.lastName.value = lastLoadedProfile.last_name ?? "";
  ui.bio.value = lastLoadedProfile.description ?? "";
}

function setCanEditImage(canEdit) {
  document.getElementById("image-edit-controls").hidden = !canEdit;
  document.getElementById("mgp-position-div").hidden = !canEdit;
}

async function loadProfile() {
  setStatus("Loading…", "info");
  setInlineStatus(ui.formStatus, "", "info");

  try {
    await ensureCsrfCookie();
    const profile = await apiFetch(PROFILE_URL, { method: "GET" });
    hydrateProfile(profile);
    setStatus("Signed in", "ok");
  } catch (e) {
    setStatus("Not available", "error");
    showToast(e.message || "Failed to load profile.", "error");
  }
}

async function saveProfile(e) {
  e.preventDefault();
  setInlineStatus(ui.formStatus, "Saving…", "info");
  ui.saveBtn.disabled = true;

  try {
    await ensureCsrfCookie();

    const canEditImage = !ui.imageInput.disabled;
    const file = ui.imageInput.files?.[0] ?? null;

    let body;
    let headers = {}; // let apiFetch merge csrf header etc.

    if (canEditImage && file) {
      const fd = new FormData();
      fd.append("first_name", ui.firstName.value.trim());
      fd.append("last_name", ui.lastName.value.trim());
      fd.append("display_name", ui.displayName.value.trim());
      fd.append("description", ui.bio.value); // <-- NOT "bio"
      fd.append("image", file);
      body = fd; // do NOT JSON.stringify
      // do NOT set Content-Type manually for FormData
    } else {
      body = JSON.stringify({
        first_name: ui.firstName.value.trim(),
        last_name: ui.lastName.value.trim(),
        display_name: ui.displayName.value.trim(),
        description: ui.bio.value, // <-- NOT "bio"
      });
      headers["Content-Type"] = "application/json";
    }

    const updated = await apiFetch(PROFILE_URL, {
      method: "PATCH",
      headers,
      body,
    });

    hydrateProfile(updated);
    setInlineStatus(ui.formStatus, "Saved.", "ok");
    showToast("Profile updated successfully.", "ok");
  } catch (err) {
    setInlineStatus(ui.formStatus, err.message || "Save failed.", "error");
    showToast(err.message || "Save failed.", "error");
  } finally {
    ui.saveBtn.disabled = false;
    window.setTimeout(() => setInlineStatus(ui.formStatus, "", "info"), 1000);
  }
}

async function changePassword(e) {
  e.preventDefault();
  setInlineStatus(ui.passStatus, "Updating…", "info");

  const oldPassword = ui.oldPass.value;
  const newPassword = ui.newPass.value;
  const confirm = ui.confirmPass.value;

  if (!newPassword || newPassword.length < 8) {
    setInlineStatus(ui.passStatus, "New password must be at least 8 characters.", "warn");
    return;
  }
  if (newPassword !== confirm) {
    setInlineStatus(ui.passStatus, "Passwords do not match.", "warn");
    return;
  }

  try {
    await ensureCsrfCookie();
    await apiFetch(CHANGEPASSWORD_URL, {
      method: "POST",
      body: JSON.stringify({
        old_password: oldPassword,
        new_password1: newPassword,
        new_password2: confirm,
      }),
    });

    ui.oldPass.value = "";
    ui.newPass.value = "";
    ui.confirmPass.value = "";

    setInlineStatus(ui.passStatus, "Password updated.", "ok");
    showToast("Password changed successfully.", "ok");
  } catch (err) {
    setInlineStatus(ui.passStatus, err.message || "Password update failed.", "error");
    showToast(err.message || "Password update failed.", "error");
  } finally {
    window.setTimeout(() => setInlineStatus(ui.passStatus, "", "info"), 2500);
  }
}

async function deleteAccount() {
  const ok = window.confirm("This will permanently delete your account. Continue?");
  if (!ok) return;

  ui.deleteBtn.disabled = true;

  try {
    await ensureCsrfCookie();
    await apiFetch(DELETE_URL, { method: "DELETE" });
    showToast("Account deleted.", "ok");

    // You may want to redirect to login/landing after deletion
    window.setTimeout(() => {
      window.location.href = "/accounts/login/";
    }, 700);
  } catch (err) {
    showToast(err.message || "Delete failed.", "error");
  } finally {
    ui.deleteBtn.disabled = false;
  }
}

async function logoutAccount() {
  const ok = window.confirm("Logout from your account, Continue?");
  if (!ok) return;

  ui.logoutBtn.disabled = true;

  try {
    await ensureCsrfCookie();
    await apiFetch(LOGOUT_URL, { method: "POST" });
    showToast("Account deleted.", "ok");

    // You may want to redirect to login/landing after deletion
    window.setTimeout(() => {
      window.location.href = "/accounts/login/";
    }, 700);
  } catch (err) {
    showToast(err.message || "Logout failed.", "error");
  } finally {
    ui.logoutBtn.disabled = false;
  }
}

  // --- Show/Hide password toggle (works for both password + confirm) ---
const form = document.getElementById("mgp-password-form");
form.addEventListener("click", (e) => {
  const showIcon = `/media/images/system/visibility_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg`;
  const hideIcon = `/media/images/system/visibility_off_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg`;
  const togglePwBtn = e.target.closest(".mgTogglePassword");
  if (!togglePwBtn) return;

  const wrapper = togglePwBtn.closest(".mg-password");
  const input = wrapper?.querySelector("input");
  if (!input) return;

  const img = togglePwBtn.querySelector("img.mg-show-btn");
  if (!img) return;

  const isHidden = input.type === "password";
  input.type = isHidden ? "text" : "password";

  img.src = isHidden ? hideIcon : showIcon;
  img.alt = isHidden ? "Hide password" : "Show password";

  togglePwBtn.setAttribute("aria-pressed", String(isHidden));
  togglePwBtn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
});

function wireEvents() {
  ui.profileForm.addEventListener("submit", saveProfile);
  ui.resetBtn.addEventListener("click", () => {
    resetFormToLastLoaded();
    setInlineStatus(ui.formStatus, "Reset.", "info");
    window.setTimeout(() => setInlineStatus(ui.formStatus, "", "info"), 1500);
  });

  ui.passForm.addEventListener("submit", changePassword);

  ui.refreshBtn.addEventListener("click", loadProfile);
  ui.deleteBtn.addEventListener("click", deleteAccount);
  ui.logoutBtn.addEventListener("click", logoutAccount);
  ui.toastClose.addEventListener("click", () => {
    ui.toast.hidden = true;
  });
}

document.getElementById("btn-delete-image").addEventListener("click", async () => {
  const ok = window.confirm("Are you sure you want to remove your profile image?");
  if (!ok) return;

  const res = await fetch(PROFILE_URL, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken"),
      "Accept": "application/json",
    },
    body: JSON.stringify({ remove_image: true }),
  });

  if (!res.ok) throw new Error(await res.text());
   window.location.reload();
});

// Init
wireEvents();
loadProfile();
;