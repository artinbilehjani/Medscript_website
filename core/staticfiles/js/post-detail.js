/**
 * post-detail.js — MedScript Post Detail Page
 * Fetches post data, renders files/videos, handles comments + reactions.
 * Namespace: pd (post-detail) to avoid global collisions.
 */

(() => {
  "use strict";

  // ── Config ────────────────────────────────────────────────
  const ROOT         = document.getElementById("post-detail-root");
  const SLUG         = ROOT?.dataset.slug;
  const IS_AUTH      = ROOT?.dataset.authenticated === "true";
  const BLANK_AVATAR = "/media/images/system/blank_profile_picture.svg";
  const LOGIN_URL    = "/accounts/login/";

  /* Static default hero image — purely a frontend fallback for posts
     with no upload (post.image can be null/empty, same nullable design
     used on the list/coverflow pages). This is the detail page, so we
     intentionally use the full-resolution default file here rather than
     a reduced-size derivative — same reasoning as why the real `image`
     field (not `thumbnail`) is used for posts that DO have an upload.
     Never written to any model field, so nothing for backend cleanup
     logic to ever delete. */
  const MEDIA_URL = window.APP_CONFIG?.mediaUrl || "/media/";
  const DEFAULT_POST_IMAGE = MEDIA_URL + "images/default_images/blank_post_thumbnail.png";

  const API = {
    post:     `/content/api/v1/post/${SLUG}/`,
    comments: (page = 1) => `/interactions/api/v1/post/${SLUG}/comments/?page=${page}`,
    react:    (pk) => `/interactions/api/v1/comments/${pk}/reaction/`,
    replies:  (pk, page = 1) => `/interactions/api/v1/comments/${pk}/replies/?page=${page}`,
  };

  // ── CSRF helper ───────────────────────────────────────────
  function getCookie(name) {
    const v = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
    return v ? v.pop() : "";
  }

  async function apiFetch(url, options = {}) {
    const defaults = {
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken":  getCookie("csrftoken"),
      },
    };
    const res = await fetch(url, { ...defaults, ...options, headers: { ...defaults.headers, ...options.headers } });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw Object.assign(new Error(body.detail || "Request failed"), { status: res.status, body });
    }
    return res.json();
  }

  // ── Toast ─────────────────────────────────────────────────
  let toastTimer = null;
  function showToast(msg, isError = false) {
    let toast = document.getElementById("pd-toast-el");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "pd-toast-el";
      toast.className = "pd-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.toggle("pd-toast-error", isError);
    toast.classList.add("pd-toast-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("pd-toast-show"), 3000);
  }

  // ── Modal (login warning) ─────────────────────────────────
  const backdrop  = document.getElementById("pd-modal-backdrop");
  const modalCancel = document.getElementById("pd-modal-cancel");
  const modalLogin  = document.getElementById("pd-modal-login-link");

  function showLoginModal(next = window.location.pathname) {
    backdrop.classList.add("pd-modal-visible");
    if (modalLogin) modalLogin.href = `${LOGIN_URL}?next=${encodeURIComponent(next)}`;
  }

  function hideLoginModal() {
  backdrop.classList.remove("pd-modal-visible");
}

  modalCancel?.addEventListener("click", hideLoginModal);
backdrop?.addEventListener("click", (e) => {
  if (e.target === backdrop) hideLoginModal();
});

  // ── File type helpers ─────────────────────────────────────
  const FILE_TYPE_MAP = { 1: "pdf", 2: "word", 3: "pptx", 4: "image", 5: "excel" };
  const FILE_ICONS = {
    pdf:   { cls: "icon-pdf",   icon: "📄" },
    word:  { cls: "icon-word",  icon: "📝" },
    pptx:  { cls: "icon-pptx",  icon: "📊" },
    image: { cls: "icon-image", icon: "🖼️" },
    excel: { cls: "icon-excel", icon: "📈" },
    other: { cls: "icon-other", icon: "📎" },
  };

  function fileTypeLabel(typeInt) {
    const map = { 1: "PDF", 2: "Word", 3: "PowerPoint", 4: "Image", 5: "Excel", 6: "File" };
    return map[typeInt] || "File";
  }

  // ── Accordion logic ───────────────────────────────────────
  function initAccordion(triggerId, panelId) {
    const trigger = document.getElementById(triggerId);
    const panel   = document.getElementById(panelId);
    if (!trigger || !panel) return;

    trigger.addEventListener("click", () => {
      const expanded = trigger.getAttribute("aria-expanded") === "true";
      trigger.setAttribute("aria-expanded", !expanded);
      if (expanded) {
        panel.hidden = true;
      } else {
        panel.hidden = false;
        // Restart EKG animation
        const ekgPath = panel.querySelector(".pd-ekg-path");
        if (ekgPath) {
          ekgPath.style.animation = "none";
          ekgPath.getBoundingClientRect(); // reflow
          ekgPath.style.animation = "";
        }
      }
    });
  }

  // ── Render post ───────────────────────────────────────────
  function renderPost(post) {
    // Hero image — always render a real <img>, falling back to the
    // static default when the post has no upload (post.image is null).
    const heroImg = document.getElementById("pd-hero-img");
    if (heroImg) {
      heroImg.src = post.image || DEFAULT_POST_IMAGE;
      heroImg.alt = post.title || "";
      // Safety net: if the real upload URL ever 404s, fall back to the
      // default instead of showing a broken-image icon. Clear the
      // handler after it fires once so we don't loop if the default
      // itself is ever missing.
      heroImg.onerror = () => {
        heroImg.onerror = null;
        heroImg.src = DEFAULT_POST_IMAGE;
      };
    }

    // Title
    const titleEl = document.getElementById("pd-title");
    if (titleEl) titleEl.textContent = post.title;

    // Author
    if (post.author) {
      const avatarEl = document.getElementById("pd-author-avatar");
      const nameEl   = document.getElementById("pd-author-name");
      if (avatarEl) {
        avatarEl.src = post.author.thumbnail || BLANK_AVATAR;
        avatarEl.alt = post.author.display_name;
        avatarEl.onerror = () => { avatarEl.src = BLANK_AVATAR; };
      }
      if (nameEl) nameEl.textContent = post.author.display_name;
    }

    // Date & views
    const dateEl  = document.getElementById("pd-date-text");
    const viewsEl = document.getElementById("pd-views-text");
    if (dateEl)  dateEl.textContent  = post.display_date || "—";
    if (viewsEl) viewsEl.textContent = `${post.hit_count ?? 0} views`;

    // Categories
    const catEl = document.getElementById("pd-categories");
    if (catEl && post.categories?.length) {
      catEl.innerHTML = post.categories
        .map(c => `<span class="pd-cat-pill">${c.name}</span>`)
        .join("");
    }

    // Tags
    const tagsRow = document.getElementById("pd-tags-row");
    if (tagsRow && post.tags?.length) {
      tagsRow.innerHTML = post.tags
        .map(t => `<span class="pd-tag-pill"># ${t.name}</span>`)
        .join("");
    }

    // Content
    const bodyEl = document.getElementById("pd-content-body");
    if (bodyEl) bodyEl.textContent = post.content;

    // Files
    renderFiles(post.files || []);

    // Videos
    renderVideos(post.video_links || []);
  }

  // ── Render files ──────────────────────────────────────────
  function renderFiles(files) {
    const grid  = document.getElementById("pd-files-grid");
    const badge = document.getElementById("pd-files-badge");
    if (badge) badge.textContent = files.length;
    if (!grid) return;

    if (!files.length) {
      grid.innerHTML = `<p class="pd-empty">No files available for this post.</p>`;
      return;
    }

    grid.innerHTML = files.map((f, idx) => {
      const typeKey = FILE_TYPE_MAP[f.file_type] || "other";
      const iconDef = FILE_ICONS[typeKey] || FILE_ICONS.other;
      const label   = fileTypeLabel(f.file_type);
      const title   = f.title || `Session ${idx + 1}`;

      const openBtn = f.file_url
        ? `<a class="pd-file-btn" href="${f.file_url}" target="_blank" rel="noopener" title="Open file">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
           </a>`
        : "";

      const dlBtn = f.download_url
        ? `<a class="pd-file-btn" href="${f.download_url}" title="Download" download>
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
           </a>`
        : "";

      return `
        <div class="pd-file-card">
          <div class="pd-file-icon ${iconDef.cls}">${iconDef.icon}</div>
          <div class="pd-file-info">
            <span class="pd-file-title" title="${title}">${title}</span>
            <span class="pd-file-sub">${label}${f.description ? " · " + f.description : ""}</span>
          </div>
          <div class="pd-file-actions">${openBtn}${dlBtn}</div>
        </div>`;
    }).join("");
  }

  // ── Render videos ─────────────────────────────────────────
  function renderVideos(links) {
    const list  = document.getElementById("pd-videos-list");
    const badge = document.getElementById("pd-videos-badge");
    if (badge) badge.textContent = links.length;
    if (!list) return;

    if (!links.length) {
      list.innerHTML = `<p class="pd-empty">No recordings available.</p>`;
      return;
    }

    list.innerHTML = links.map((v, idx) => {
      const title = v.title || `Session ${idx + 1}`;
      const url   = v.url   || "#";
      return `
        <a class="pd-video-row" href="${url}" target="_blank" rel="noopener">
          <div class="pd-video-thumb">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
          <div class="pd-video-info">
            <div class="pd-video-title" title="${title}">${title}</div>
            <div class="pd-video-sub">Class Recording · Aparat</div>
          </div>
          <div class="pd-video-open">
            Watch
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </div>
        </a>`;
    }).join("");
  }

  // ── Comment state ─────────────────────────────────────────
  let currentPage = 1;
  let replyingToId   = null;
  let replyingToName = null;

  function setReplyContext(commentId, authorName) {
    replyingToId   = commentId;
    replyingToName = authorName;
    const banner = document.getElementById("pd-reply-banner");
    const label  = document.getElementById("pd-reply-to-label");
    if (banner && label) {
      label.textContent = `Replying to ${authorName}`;
      banner.hidden = false;
    }
    document.getElementById("pd-comment-input")?.focus();
  }

  function clearReplyContext() {
    replyingToId   = null;
    replyingToName = null;
    const banner = document.getElementById("pd-reply-banner");
    if (banner) banner.hidden = true;
  }

  // ── Build comment HTML ────────────────────────────────────
  function buildCommentHTML(c, isReply = false) {
    const initials = (c.author?.display_name || "?")[0].toUpperCase();
    const reactionLike    = c.user_reaction == 1;
    const reactionDislike = c.user_reaction == 2;
    const edited = c.is_edited ? `<span class="pd-comment-edited">(edited)</span>` : "";
    const repliesBtn = (!isReply && c.replies_count > 0)
      ? `<button class="pd-load-replies-btn" data-comment-id="${c.id}" data-replies-count="${c.replies_count}">
           Show ${c.replies_count} ${c.replies_count === 1 ? "reply" : "replies"}
         </button>`
      : "";

    return `
      <div class="pd-comment-item${isReply ? " pd-is-reply" : ""}" data-comment-id="${c.id}">
        <div class="pd-comment-header">
          <div class="pd-comment-avatar">${initials}</div>
          <span class="pd-comment-author-name">${c.author?.display_name || "Unknown"}</span>
          ${edited}
          <span class="pd-comment-date">${c.display_date || ""}</span>
        </div>
        <div class="pd-comment-body">${escapeHtml(c.body)}</div>
        <div class="pd-comment-footer">
          <button class="pd-reaction-btn ${reactionLike ? "active-like" : ""}"
            data-comment-id="${c.id}" data-reaction="1">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
            <span class="pd-like-count-${c.id}">${c.like_count ?? 0}</span>
          </button>
          <button class="pd-reaction-btn ${reactionDislike ? "active-dislike" : ""}"
            data-comment-id="${c.id}" data-reaction="2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
            <span class="pd-dislike-count-${c.id}">${c.dislike_count ?? 0}</span>
          </button>
          ${!isReply
            ? `<button class="pd-reply-btn" data-comment-id="${c.id}" data-author-name="${escapeHtml(c.author?.display_name || "user")}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                Reply
               </button>`
            : ""}
          ${repliesBtn}
        </div>
        ${!isReply ? `<div class="pd-replies-container" id="pd-replies-${c.id}"></div>` : ""}
      </div>`;
  }

  function escapeHtml(str = "") {
    return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  // ── Load comments ─────────────────────────────────────────
  async function loadComments(page = 1) {
    const list    = document.getElementById("pd-comments-list");
    const loading = document.getElementById("pd-comments-loading");
    const countEl = document.getElementById("pd-comment-count");
    if (!list) return;

    if (loading) {
      loading.style.display = "flex";
      list.innerHTML = "";
      list.appendChild(loading);
    }

    try {
      const data = await apiFetch(API.comments(page));
      currentPage = page;

      if (countEl) countEl.textContent = data.total_objects ?? 0;

      if (loading) loading.style.display = "none";
      list.innerHTML = "";

      if (!data.results?.length) {
        list.innerHTML = `<p class="pd-empty" style="text-align:center;padding:40px 0">Be the first to comment on this session!</p>`;
      } else {
        list.innerHTML = data.results.map(c => buildCommentHTML(c)).join("");
      }

      renderCommentPagination(data);
    } catch (err) {
      if (loading) loading.style.display = "none";
      list.innerHTML = `<p class="pd-empty" style="color:#ef4444;text-align:center;padding:30px 0">Failed to load comments. Please refresh.</p>`;
    }
  }

  // ── Pagination render ─────────────────────────────────────
  function renderCommentPagination(data) {
    const container = document.getElementById("pd-comment-pagination");
    if (!container || data.total_pages <= 1) { if (container) container.innerHTML = ""; return; }

    const { current_page_number: cur, total_pages: total } = data;
    let html = "";

    html += `<button class="pd-page-btn" data-page="${cur - 1}" ${cur <= 1 ? "disabled" : ""}>‹ Prev</button>`;
    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || Math.abs(i - cur) <= 1) {
        html += `<button class="pd-page-btn ${i === cur ? "active" : ""}" data-page="${i}">${i}</button>`;
      } else if (Math.abs(i - cur) === 2) {
        html += `<span class="pd-page-btn" style="pointer-events:none;opacity:0.4">…</span>`;
      }
    }
    html += `<button class="pd-page-btn" data-page="${cur + 1}" ${cur >= total ? "disabled" : ""}>Next ›</button>`;

    container.innerHTML = html;
  }

  // ── Load replies ──────────────────────────────────────────
  async function loadReplies(commentId, btn) {
    const container = document.getElementById(`pd-replies-${commentId}`);
    if (!container) return;
    if (container.dataset.loaded === "true") {
      container.style.display = container.style.display === "none" ? "" : "none";
      btn.textContent = container.style.display === "none" ? `Show ${btn.dataset.repliesCount} ${parseInt(btn.dataset.repliesCount) === 1 ? "reply" : "replies"}` : "Hide replies";
      return;
    }

    btn.textContent = "Loading…";
    btn.disabled = true;

    try {
      const data = await apiFetch(API.replies(commentId));
      container.dataset.loaded = "true";
      if (data.results?.length) {
        container.innerHTML = data.results.map(r => buildCommentHTML(r, true)).join("");
      }
      btn.textContent = "Hide replies";
      btn.disabled = false;
    } catch {
      btn.textContent = "Failed to load";
      btn.disabled = false;
    }
  }

  // ── React to comment ──────────────────────────────────────
  async function handleReaction(commentId, reactionType) {
    if (!IS_AUTH) { showLoginModal(); return; }

    try {
      const data = await apiFetch(API.react(commentId), {
        method: "POST",
        body: JSON.stringify({ reaction_type: reactionType }),
      });

      // Update counts
      const likeEl    = document.querySelector(`.pd-like-count-${commentId}`);
      const dislikeEl = document.querySelector(`.pd-dislike-count-${commentId}`);
      if (likeEl)    likeEl.textContent    = data.like_count ?? 0;
      if (dislikeEl) dislikeEl.textContent = data.dislike_count ?? 0;

      // Update button active states
      const commentItem = document.querySelector(`[data-comment-id="${commentId}"].pd-comment-item`);
      if (commentItem) {
        const btns = commentItem.querySelectorAll(".pd-reaction-btn");
        btns.forEach(b => {
          b.classList.remove("active-like", "active-dislike");
          if (data.status === "ok") {
            if (parseInt(b.dataset.reaction) === 1 && data.user_reaction === 1) b.classList.add("active-like");
            if (parseInt(b.dataset.reaction) === 2 && data.user_reaction === 2) b.classList.add("active-dislike");
          }
        });
      }
    } catch (err) {
      showToast("Failed to update reaction.", true);
    }
  }

  // ── Post comment ──────────────────────────────────────────
  async function handleCommentSubmit() {
    if (!IS_AUTH) { showLoginModal(); return; }

    const input = document.getElementById("pd-comment-input");
    const body  = input?.value.trim();
    if (!body) { showToast("Please write something before posting.", true); return; }

    const submitBtn = document.getElementById("pd-comment-submit");
    submitBtn.disabled = true;
    submitBtn.textContent = "Posting…";

    try {
      await apiFetch(API.comments(), {
        method: "POST",
        body: JSON.stringify({ body, parent: replyingToId || null }),
      });

      input.value = "";
      document.getElementById("pd-char-count").textContent = "0 / 255";
      clearReplyContext();
      showToast("Comment submitted! It will appear after approval.");
      await loadComments(currentPage);
    } catch (err) {
      const msg = err.body?.body?.[0] || err.body?.detail || "Failed to post comment.";
      showToast(msg, true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Post Comment`;
    }
  }

  // ── Event delegation ──────────────────────────────────────
  function attachDelegation() {
    // Comment list: reactions, replies, load replies
    document.getElementById("pd-comments-list")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      if (btn.classList.contains("pd-reaction-btn")) {
        handleReaction(btn.dataset.commentId, parseInt(btn.dataset.reaction));
        return;
      }

      if (btn.classList.contains("pd-reply-btn")) {
        if (!IS_AUTH) { showLoginModal(); return; }
        setReplyContext(btn.dataset.commentId, btn.dataset.authorName);
        return;
      }

      if (btn.classList.contains("pd-load-replies-btn")) {
        loadReplies(btn.dataset.commentId, btn);
        return;
      }
    });

    // Pagination
    document.getElementById("pd-comment-pagination")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".pd-page-btn");
      if (!btn || btn.disabled) return;
      const page = parseInt(btn.dataset.page);
      if (page) { loadComments(page); window.scrollTo({ top: document.getElementById("pd-comments-section")?.offsetTop - 120, behavior: "smooth" }); }
    });

    // Comment submit
    document.getElementById("pd-comment-submit")?.addEventListener("click", handleCommentSubmit);

    // Enter key in textarea
    document.getElementById("pd-comment-input")?.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key === "Enter") handleCommentSubmit();
    });

    // Char counter
    document.getElementById("pd-comment-input")?.addEventListener("input", (e) => {
      const len = e.target.value.length;
      const el  = document.getElementById("pd-char-count");
      if (el) el.textContent = `${len} / 255`;
    });

    // Cancel reply
    document.getElementById("pd-cancel-reply")?.addEventListener("click", clearReplyContext);
  }

  // ── Auth-aware form setup ─────────────────────────────────
  function setupCommentForm() {
    const formWrap = document.getElementById("pd-comment-form-wrap");
    const loginCta = document.getElementById("pd-login-cta");

    if (IS_AUTH) {
      if (formWrap) formWrap.hidden = false;
      if (loginCta) loginCta.hidden = true;
    } else {
      if (formWrap) formWrap.hidden = true;
      if (loginCta) loginCta.hidden = false;
    }
  }

  // ── Init ──────────────────────────────────────────────────
  async function init() {
    if (!SLUG) return;

    // Accordions
    initAccordion("pd-files-trigger",  "pd-files-panel");
    initAccordion("pd-videos-trigger", "pd-videos-panel");

    // Form auth state
    setupCommentForm();

    // Delegation
    attachDelegation();

    // Fetch post
    try {
      const post = await apiFetch(API.post);
      renderPost(post);
    } catch {
      showToast("Failed to load post data.", true);
    }

    // Fetch comments
    await loadComments(1);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();