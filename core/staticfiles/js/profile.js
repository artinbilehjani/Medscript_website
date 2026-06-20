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
  deleteImageBtn: el("btn-delete-image"),
  statusPill: el("mgp-status-pill"),
  fullName: el("mgp-full-name"),
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

// Holds the *server* state — never put blob:/data: URIs in here.
let lastLoadedProfile = null;

// Holds a locally-picked File object pending upload. This — NOT ui.avatar.src —
// is the single source of truth for "does the user want to change their image".
let pendingImageFile = null;
// Tracks the blob: URL we created for preview so we can revoke it later.
let pendingPreviewUrl = null;

const DEFAULT_AVATAR = "/media/images/system/blank_profile_picture.svg";

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

  // Some endpoints (delete, logout, etc.) won't return profile-shaped data.
  if (data && typeof data === "object" && "can_edit_image" in data) {
    setCanEditImage(!!data.can_edit_image);
  }
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
  setCanEditImage(canEditImage);

  ui.fullName.textContent = fullName;
  ui.username.textContent = profile.username ?? "—";
  ui.emailText.textContent = profile.email ?? "—";
  ui.position.textContent = profile.user_position?.name ?? "—";

  ui.displayName.value = profile.display_name ?? "";
  ui.firstName.value = first;
  ui.lastName.value = last;
  ui.bio.value = profile.description ?? "";

  // Use full-resolution `image` on the profile page itself (this is the
  // editor for that image). post-detail/list pages should use `thumbnail`.
  setAvatarSrc(profile.image || DEFAULT_AVATAR);

  // Clear any pending local file/preview now that we have fresh server state.
  clearPendingImage();

  // lastLoadedProfile stores ONLY plain server values — never a blob: URL —
  // so Reset always restores what the server actually has.
  lastLoadedProfile = {
    image: profile.image || DEFAULT_AVATAR,
    display_name: ui.displayName.value,
    first_name: ui.firstName.value,
    last_name: ui.lastName.value,
    description: ui.bio.value,
  };
}

function setAvatarSrc(src) {
  ui.avatar.src = src;
}

function clearPendingImage() {
  if (pendingPreviewUrl) {
    URL.revokeObjectURL(pendingPreviewUrl);
    pendingPreviewUrl = null;
  }
  pendingImageFile = null;
  if (ui.imageInput) ui.imageInput.value = "";
}

/**
 * IMPORTANT: the JSON-body save path must NEVER include `image`.
 * `ui.avatar.src` is always a full URL (or blob:/data: URI for a pending
 * preview) — sending that string as `image` is what produces:
 *   "Ensure this filename has at most 100 characters."
 * The image is only ever sent as a real File via FormData, in saveProfile().
 */
function collectProfilePayload() {
  return {
    display_name: ui.displayName.value.trim(),
    first_name: ui.firstName.value.trim(),
    last_name: ui.lastName.value.trim(),
    description: ui.bio.value.trim(),
  };
}

function resetFormToLastLoaded() {
  if (!lastLoadedProfile) return;
  clearPendingImage();
  setAvatarSrc(lastLoadedProfile.image ?? DEFAULT_AVATAR);
  ui.displayName.value = lastLoadedProfile.display_name ?? "";
  ui.firstName.value = lastLoadedProfile.first_name ?? "";
  ui.lastName.value = lastLoadedProfile.last_name ?? "";
  ui.bio.value = lastLoadedProfile.description ?? "";
}

function setCanEditImage(canEdit) {
  document.getElementById("image-edit-controls").hidden = !canEdit;
  document.getElementById("mgp-position-div").hidden = !canEdit;
  if (ui.imageInput) ui.imageInput.disabled = !canEdit;
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

/**
 * Local instant preview the moment a file is picked.
 * This is what was missing — previously nothing listened to "change"
 * on the file input, so picking an image appeared to do nothing.
 */
function onImageFileChosen(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showToast("Please choose an image file.", "warn");
    clearPendingImage();
    return;
  }
  const MAX_BYTES = 8 * 1024 * 1024; // 8MB guard, adjust to taste
  if (file.size > MAX_BYTES) {
    showToast("Image is too large (max 8MB).", "warn");
    clearPendingImage();
    return;
  }

  // Revoke any previous preview URL before creating a new one.
  if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);

  pendingImageFile = file;
  pendingPreviewUrl = URL.createObjectURL(file);
  setAvatarSrc(pendingPreviewUrl);

  setInlineStatus(ui.formStatus, "New photo selected — click Save changes to upload.", "info");
}

async function saveProfile(e) {
  e.preventDefault();
  setInlineStatus(ui.formStatus, "Saving…", "info");
  ui.saveBtn.disabled = true;

  try {
    await ensureCsrfCookie();

    const canEditImage = !ui.imageInput.disabled;
    const fields = collectProfilePayload();

    let body;
    let headers = {};

    if (canEditImage && pendingImageFile) {
      // Only path that ever sends image data — as a real File in FormData.
      const fd = new FormData();
      fd.append("first_name", fields.first_name);
      fd.append("last_name", fields.last_name);
      fd.append("display_name", fields.display_name);
      fd.append("description", fields.description);
      fd.append("image", pendingImageFile);
      body = fd; // do NOT JSON.stringify; do NOT set Content-Type manually
    } else {
      body = JSON.stringify(fields); // never includes `image`
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
    window.setTimeout(() => setInlineStatus(ui.formStatus, "", "info"), 1500);
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
    showToast("Logged out.", "ok");

    window.setTimeout(() => {
      window.location.href = "/accounts/login/";
    }, 700);
  } catch (err) {
    showToast(err.message || "Logout failed.", "error");
  } finally {
    ui.logoutBtn.disabled = false;
  }
}

async function deleteProfileImage() {
  const ok = window.confirm("Are you sure you want to remove your profile image?");
  if (!ok) return;

  try {
    await ensureCsrfCookie();
    const updated = await apiFetch(PROFILE_URL, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remove_image: true }),
    });
    hydrateProfile(updated);
    showToast("Profile image removed.", "ok");
  } catch (err) {
    showToast(err.message || "Failed to remove image.", "error");
  }
}

// --- Show/Hide password toggle (works for both password + confirm) ---
function wirePasswordToggle() {
  const form = document.getElementById("mgp-password-form");
  if (!form) return;

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
}

function wireEvents() {
  ui.profileForm.addEventListener("submit", saveProfile);
  ui.resetBtn.addEventListener("click", () => {
    resetFormToLastLoaded();
    setInlineStatus(ui.formStatus, "Reset.", "info");
    window.setTimeout(() => setInlineStatus(ui.formStatus, "", "info"), 1500);
  });

  // THE FIX for bug #2: listen for file selection and preview instantly.
  ui.imageInput.addEventListener("change", onImageFileChosen);

  ui.passForm.addEventListener("submit", changePassword);

  ui.refreshBtn.addEventListener("click", loadProfile);
  ui.deleteBtn.addEventListener("click", deleteAccount);
  ui.logoutBtn.addEventListener("click", logoutAccount);
  ui.toastClose.addEventListener("click", () => {
    ui.toast.hidden = true;
  });

  if (ui.deleteImageBtn) {
    ui.deleteImageBtn.addEventListener("click", deleteProfileImage);
  }

  wirePasswordToggle();
}

// Init
wireEvents();
loadProfile();