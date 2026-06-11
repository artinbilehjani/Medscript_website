(function () {
  const root = document.querySelector(".mgp-profile");
  if (!root) return;

  const api = {
    profile: root.dataset.profileApi || "/accounts/api/v1/me/profile/",
    changePassword: root.dataset.changePasswordApi || "/accounts/api/v1/me/change-password/",
    del: root.dataset.deleteApi || "/accounts/api/v1/me/delete/",
  };

  const el = {
    avatar: document.getElementById("mgpAvatar"),
    imageInput: document.getElementById("mgpImageInput"),
    uploadBtn: document.getElementById("mgpUploadBtn"),

    form: document.getElementById("mgpProfileForm"),
    reloadBtn: document.getElementById("mgpReloadBtn"),
    status: document.getElementById("mgpStatus"),

    username: document.getElementById("mgpUsername"),
    displayName: document.getElementById("mgpDisplayName"),
    email: document.getElementById("mgpEmail"),
    position: document.getElementById("mgpPosition"),
    description: document.getElementById("mgpDescription"),

    pwdForm: document.getElementById("mgpPasswordForm"),
    oldPwd: document.getElementById("mgpOldPassword"),
    newPwd: document.getElementById("mgpNewPassword"),
    newPwd2: document.getElementById("mgpNewPassword2"),
    pwdStatus: document.getElementById("mgpPasswordStatus"),

    deleteBtn: document.getElementById("mgpDeleteBtn"),
    deleteStatus: document.getElementById("mgpDeleteStatus"),
  };

  function setStatus(node, msg) {
    if (!node) return;
    node.textContent = msg || "";
  }

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
    return null;
  }

  async function readJsonSafe(res) {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  try { return await res.json(); } catch { return null; }
}

function formatApiError(data, fallback) {
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (data.detail) return String(data.detail);

  // Flatten {field: ["msg"]} shapes
  if (typeof data === "object") {
    const parts = [];
    for (const [k, v] of Object.entries(data)) {
      if (Array.isArray(v)) parts.push(`${k}: ${v.join(", ")}`);
      else if (v && typeof v === "object") parts.push(`${k}: ${JSON.stringify(v)}`);
      else parts.push(`${k}: ${String(v)}`);
    }
    if (parts.length) return parts.join(" | ");
  }
  return fallback;
}

  async function apiFetch(url, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const unsafe = !["GET", "HEAD", "OPTIONS", "TRACE"].includes(method);

    const headers = new Headers(options.headers || {});

    const isSameOrigin = (() => {
    try {
      return new URL(url, window.location.href).origin === window.location.origin;
    } catch {
      return true; // relative URL
    }
    })();

    if (unsafe && isSameOrigin) {
    const csrf = getCookie("csrftoken");
    if (csrf) headers.set("X-CSRFToken", csrf);
  }

    return fetch(url, {
    ...options,
    credentials: "same-origin",
    headers,
  });
  }

  function pick(obj, keys) {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

function toAbsoluteUrl(u) {
  if (!u) return "";
  return new URL(u, window.location.origin).toString();
}

  function applyProfile(data) {
  const root = data ?? {};
  const profileObj = root.profile ?? root;
  const userObj = root.user ?? root;

  el.username.value = userObj?.username ?? "";
  el.displayName.value = pick(profileObj, ["display_name", "displayName", "name"]) ?? "";
  el.email.value = pick(profileObj, ["email"]) ?? "";
  el.description.value = pick(profileObj, ["description", "about"]) ?? "";

  el.position.value =
    pick(root.user_position, ["name"]) ??
    pick(userObj?.user_position, ["name"]) ??
    pick(root.position, ["name"]) ??
    "";

  const rawImageUrl =
    pick(profileObj, ["image_url", "image"]) ??
    pick(root, ["image_url", "image"]) ??
    "";

  const imageUrl = toAbsoluteUrl(rawImageUrl);
  if (imageUrl) el.avatar.src = imageUrl;
}

  async function loadProfile() {
  setStatus(el.status, "Loading...");
  const res = await apiFetch(api.profile);

  const data = await readJsonSafe(res);

  if (!res.ok) {
    const msg = formatApiError(data, `Failed to load (${res.status})`);
    setStatus(el.status, msg);
    return;
  }

  if (data) applyProfile(data);
  setStatus(el.status, "Loaded");
  setTimeout(() => setStatus(el.status, ""), 1200);
}

  async function saveProfile() {
  setStatus(el.status, "Saving...");
  const payload = {
    display_name: el.displayName.value.trim(),
    email: el.email.value.trim() || null,
    description: el.description.value.trim() || null,
  };

  const res = await apiFetch(api.profile, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await readJsonSafe(res);

  if (!res.ok) {
    setStatus(el.status, formatApiError(data, `Save failed (${res.status})`));
    return;
  }

  if (data) applyProfile(data);
  setStatus(el.status, "Saved");
  setTimeout(() => setStatus(el.status, ""), 1200);
}


  async function uploadImage() {
  const file = el.imageInput.files && el.imageInput.files[0];
  if (!file) {
    setStatus(el.status, "Choose an image first");
    return;
  }

  const previewUrl = URL.createObjectURL(file);
  el.avatar.src = previewUrl;

  setStatus(el.status, "Uploading...");
  const form = new FormData();
  form.append("image", file);

  const res = await apiFetch(api.profile, { method: "PATCH", body: form });
  const data = await readJsonSafe(res);

  URL.revokeObjectURL(previewUrl);

  if (!res.ok) {
    setStatus(el.status, formatApiError(data, `Upload failed (${res.status})`));
    return;
  }

  if (data) applyProfile(data);
  setStatus(el.status, "Uploaded");
  setTimeout(() => setStatus(el.status, ""), 1200);
}

  async function changePassword() {
  const old_password = el.oldPwd.value;
  const new_password = el.newPwd.value;
  const new_password2 = el.newPwd2.value;

  if (new_password !== new_password2) {
    setStatus(el.pwdStatus, "New passwords do not match");
    return;
  }

  setStatus(el.pwdStatus, "Updating...");
  const res = await apiFetch(api.changePassword, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ old_password, new_password, new_password2 }),
  });

  const data = await readJsonSafe(res);

  if (!res.ok) {
    setStatus(el.pwdStatus, formatApiError(data, `Failed (${res.status})`));
    return;
  }

  el.oldPwd.value = "";
  el.newPwd.value = "";
  el.newPwd2.value = "";
  setStatus(el.pwdStatus, "Password updated");
  setTimeout(() => setStatus(el.pwdStatus, ""), 1500);
}

  async function deleteAccount() {
  const ok = confirm("Delete your account permanently?");
  if (!ok) return;

  el.deleteBtn.disabled = true;
  try {
    setStatus(el.deleteStatus, "Deleting...");
    const res = await apiFetch(api.del, { method: "DELETE" });
    const data = await readJsonSafe(res);

    if (!res.ok) {
      setStatus(el.deleteStatus, formatApiError(data, `Failed (${res.status})`));
      return;
    }

    window.location.href = "/";
  } finally {
    el.deleteBtn.disabled = false;
  }
}

  el.form.addEventListener("submit", (e) => {
    e.preventDefault();
    saveProfile();
  });

  el.reloadBtn.addEventListener("click", () => loadProfile());
  el.uploadBtn.addEventListener("click", () => uploadImage());

  el.pwdForm.addEventListener("submit", (e) => {
    e.preventDefault();
    changePassword();
  });

  el.deleteBtn.addEventListener("click", () => deleteAccount());

  loadProfile().catch(() => setStatus(el.status, "Failed to load"));
})();