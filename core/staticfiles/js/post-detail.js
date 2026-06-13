/* =========================================================
   CONFIGURATION
   ---------------------------------------------------------
   Replace these API endpoints with the real endpoints
   from your backend.
========================================================= */
const config = window.API_CONFIG || {};
const postSlug = (config.currentSlug || "").trim();
const postApiBaseUrl = (config.postDetailApiBaseUrl || "/content/api/v1/post/").trim();
const commentsApiBaseUrl = (config.postCommentsApiBaseUrl || "/interactions/api/v1/post/").trim();
const commentsDetailApiBaseUrl = (config.commentsDetailApiBaseUrl || "/interactions/api/v1/comments/").trim();

if (!postSlug) {
  throw new Error("Post slug is missing.");
}

const POST_DETAIL_URL = `${postApiBaseUrl}${encodeURIComponent(postSlug)}/`;
const POST_COMMENTS_URL = `${commentsApiBaseUrl}${encodeURIComponent(postSlug)}/comments/`;
const POST_LATEST_COMMENT_URL = `${commentsApiBaseUrl}${encodeURIComponent(postSlug)}/latest-comments/`;
const POST_COMMENTS_URL = `${commentsApiBaseUrl}${encodeURIComponent(postSlug)}/comments/`;

/* =========================
   CSRF helper
   Reads Django CSRF token from cookies for POST requests
========================= */
function getCSRFToken() {
  const cookies = document.cookie.split(";").map(c => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith("csrftoken=")) {
      return cookie.split("=")[1];
    }
  }
  return "";
}


/* =========================
   Auth redirect helper
   Sends anonymous users to login page and preserves return URL
========================= */
function redirectToLogin() {
  const next = encodeURIComponent(window.location.pathname + window.location.search + "#comments");
  window.location.href = `${commentsState.loginUrl}?next=${next}`;
}

/* =========================
   Auth guard
   Prevents protected actions for guests
========================= */
function requireAuth() {
  if (!commentsState.isLoggedIn) {
    redirectToLogin();
    return false;
  }
  return true;
}
/* =========================================================
   DOM REFERENCES
========================================================= */

// Post section elements
const postLoadingEl = document.getElementById("post-loading");
const postErrorEl = document.getElementById("post-error");
const postContentEl = document.getElementById("post-content");

// Comments section elements
const commentsLoadingEl = document.getElementById("comments-loading");
const commentsErrorEl = document.getElementById("comments-error");
const commentsListEl = document.getElementById("comments-list");

// Comment form elements
const commentFormEl = document.getElementById("comment-form");
const commentBodyEl = document.getElementById("comment-body");
const parentIdEl = document.getElementById("parent-id");
const replyIndicatorEl = document.getElementById("reply-indicator");
const replyToIdEl = document.getElementById("reply-to-id");
const cancelReplyEl = document.getElementById("cancel-reply");
const commentFormMessageEl = document.getElementById("comment-form-message");

/* =========================================================
   STATE
========================================================= */

// Store post data if needed later
let currentPost = null;

// Store comments data in memory for rerendering after actions
let currentComments = [];

const commentsState = {
  post: null,
  postId: null,
  latestComment: null,
  comments: [],
  currentPage: 1,
  totalPages: 1,
  isExpanded: false,
  isLoading: false,
  isLoggedIn: false,
  loginUrl: "/login/",
};
/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  if (!postSlug) {
    showPostError("Post slug is missing in URL.");
    showCommentsError("Post slug is missing in URL.");
    return;
  }
  commentsState.postId = postSlug;

  try {
    await Promise.all([
      loadPostDetails(),
      fetchLatestComment()
    ]);
  } catch (error) {
    console.error(error);
  }

  bindCommentsEvents();
});

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCsrfToken(),
      ...(options.headers || {}),
    },
    credentials: "include",
    ...options,
  });

  if (response.status === 401 || response.status === 403) {
    redirectToLogin();
    throw new Error("Authentication required");
  }

  if (!response.ok) {
    let errorText = "Request failed";
    try {
      const data = await response.json();
      errorText = data.detail || JSON.stringify(data);
    } catch (_) {}
    throw new Error(errorText);
  }

  if (response.status === 204) return null;
  return response.json();
}

// Handle comment form submit
commentFormEl.addEventListener("submit", handleCommentSubmit);

// Cancel reply mode and return to top-level comment mode
cancelReplyEl.addEventListener("click", resetReplyMode);

/* =========================================================
   API CALLS
========================================================= */

// Fetch post details from backend
async function loadPostDetails() {
  showElement(postLoadingEl);
  hideElement(postErrorEl);
  hideElement(postContentEl);

  try {
    const data = await apiFetch(POST_DETAIL_URL);

    commentsState.post = data;
    renderPost(data);

    hideElement(postLoadingEl);
    showElement(postContentEl);
  } catch (error) {
    hideElement(postLoadingEl);
    showPostError(error.message || "Failed to load post details.");
  }
}

// Fetch all comments for current post
async function fetchLatestComment() {
  showElement(commentsLoadingEl);
  hideElement(commentsErrorEl);

  try {
    const data = await apiFetch(POST_LATEST_COMMENT_URL);

    commentsState.latestComment = data;
    renderLatestCommentPreview(data);

    hideElement(commentsLoadingEl);
  } catch (error) {
    hideElement(commentsLoadingEl);
    showCommentsError(error.message || "Failed to load latest comment.");
  }
}
//Fetch root Comments// 
async function fetchComments(page = 1) {
  showElement(commentsLoadingEl);
  hideElement(commentsErrorEl);
  hideElement(commentsListEl);

  try {
    const data = await apiFetch(`${POST_COMMENTS_URL}?page=${page}`);

    commentsState.comments = Array.isArray(data) ? data : (data.results || []);
    commentsState.currentPage = data.page || page;
    commentsState.totalPages = data.total_pages || 1;

    renderComments(commentsState.comments);
    renderCommentsPagination(commentsState.currentPage, commentsState.totalPages);

    hideElement(commentsLoadingEl);
    showElement(commentsListEl);
  } catch (error) {
    hideElement(commentsLoadingEl);
    showCommentsError(error.message || "Failed to load comments.");
  }
}
// Create a new comment or reply
async function createComment(payload) {
  const url = payload.parent
    ? API_CONFIG.commentReplies.replace("{commentId}", payload.parent)
    : API_CONFIG.comments;

  if (!response.ok) {
    throw new Error(data.detail || data.body?.[0] || "Failed to submit comment.");
  }

  return apiFetch(url, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Send like/dislike reaction for a specific comment
async function reactToComment(commentId, reactionType) {
  const url = API_CONFIG.commentReaction.replace("{commentId}", commentId);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCSRFToken(),
    },
    credentials: "include",
    body: JSON.stringify({
      reaction_type: reactionType, // expected: "like" or "dislike"
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || "Failed to react to comment.");
  }

  return data;
}

/* =========================================================
   RENDER: POST
========================================================= */

// Render post details into the page
function renderPost(post) {
  const authorName = post.author?.display_name || "Unknown author";
  const authorImage = post.author?.image || "core\media\images\default_images\blank_profile_picture.png";
  const imageHtml = post.image
    ? `<img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title || "Post image")}" class="post-image" />`
    : "";

  const categoriesHtml = Array.isArray(post.categories) && post.categories.length
    ? `
      <div class="meta-block">
        <h4>Categories</h4>
        <div class="category-list">
          ${post.categories.map(category => `<span class="category">${escapeHtml(String(category))}</span>`).join("")}
        </div>
      </div>
    `
    : "";

  const tagsHtml = Array.isArray(post.tags) && post.tags.length
    ? `
      <div class="meta-block">
        <h4>Tags</h4>
        <div class="tag-list">
          ${post.tags.map(tag => `<span class="tag">${escapeHtml(String(tag))}</span>`).join("")}
        </div>
      </div>
    `
    : "";

  const filesHtml = Array.isArray(post.files) && post.files.length
    ? `
      <div class="meta-block">
        <h4>Files</h4>
        <div class="file-list">
          ${post.files.map(file => {
            const fileUrl = typeof file === "string" ? file : file.file || file.url || "#";
            return `<a class="file-item" href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener noreferrer">Download file</a>`;
          }).join("")}
        </div>
      </div>
    `
    : "";

  const videoLinksHtml = Array.isArray(post.video_links) && post.video_links.length
    ? `
      <div class="meta-block">
        <h4>Video Links</h4>
        <div class="video-list">
          ${post.video_links.map(link => `
            <a class="video-item" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">
              ${escapeHtml(link)}
            </a>
          `).join("")}
        </div>
      </div>
    `
    : "";

  postContentEl.innerHTML = `
    <h1 class="post-title">${escapeHtml(post.title || "")}</h1>

    <div class="post-meta">
    <strong>Author image:</strong><img src="${escapeHtml(authorImage)}" alt="" class="post-image" />
      <span><strong>Author:</strong> ${escapeHtml(authorName)}</span>
      <span><strong>Published:</strong> ${escapeHtml(post.display_date || post.published_date || "")}</span>
      <span><strong>Views:</strong> ${escapeHtml(String(post.hit_count ?? 0))}</span>
    </div>

    ${imageHtml}

    <div class="post-content">
      ${post.content || ""}
    </div>

    ${categoriesHtml}
    ${tagsHtml}
    ${filesHtml}
    ${videoLinksHtml}
  `;
}

/* =========================================================
   RENDER: COMMENTS
========================================================= */

// Render full comments tree
function renderComments(comments) {
  if (!comments.length) {
    commentsListEl.innerHTML = `<div class="state">No comments yet.</div>`;
    return;
  }

  commentsListEl.innerHTML = comments.map(comment => renderCommentItem(comment, false)).join("");

  // After HTML is injected, bind all interactive buttons
  bindCommentActionEvents();
}

// Render one comment item recursively.
// isReply controls indentation/styling for nested comments.
function renderCommentItem(comment, isReply = false) {
  const authorName = comment.author?.display_name || "Unknown user";
  const createdDate = comment.display_date || comment.created_date || "";
  const isLiked = comment.user_reaction === "like";
  const isDisliked = comment.user_reaction === "dislike";

  const repliesHtml = Array.isArray(comment.replies) && comment.replies.length
    ? `
      <div class="comment-children">
        ${comment.replies.map(reply => renderCommentItem(reply, true)).join("")}
      </div>
    `
    : "";

  return `
    <div class="comment ${isReply ? "reply" : ""}" data-comment-id="${comment.id}">
      <div class="comment-header">
        <div>
          <div class="comment-author">${escapeHtml(authorName)}</div>
          <div class="comment-date">${escapeHtml(createdDate)}${comment.is_edited ? " • edited" : ""}</div>
        </div>
      </div>

      <div class="comment-body">${escapeHtml(comment.body || "")}</div>

      <div class="comment-actions">
        <!-- Reply button only for top-level comments,
             because backend allows one reply level only -->
        ${!isReply ? `<button class="btn secondary reply-btn" data-comment-id="${comment.id}">Reply</button>` : ""}

        <!-- Like button -->
        <button
          class="reaction-btn ${isLiked ? "active-like" : ""}"
          data-reaction-btn="like"
          data-comment-id="${comment.id}"
        >
          👍 Like (${comment.like_count ?? 0})
        </button>

        <!-- Dislike button -->
        <button
          class="reaction-btn ${isDisliked ? "active-dislike" : ""}"
          data-reaction-btn="dislike"
          data-comment-id="${comment.id}"
        >
          👎 Dislike (${comment.dislike_count ?? 0})
        </button>
      </div>

      ${repliesHtml}
    </div>
  `;
}

/* =========================================================
   EVENTS
========================================================= */

// Attach click handlers to reply / reaction buttons after comments render
function bindCommentActionEvents() {
  // Reply buttons
  document.querySelectorAll(".reply-btn").forEach(button => {
    button.addEventListener("click", () => {
      const commentId = button.dataset.commentId;
      setReplyMode(commentId);
    });
  });

  // Reaction buttons
  document.querySelectorAll("[data-reaction-btn]").forEach(button => {
    button.addEventListener("click", async () => {
      const commentId = button.dataset.commentId;
      const reactionType = button.dataset.reactionBtn;

      try {
        await reactToComment(commentId, reactionType);

        // Reload comments to get exact updated counts and user_reaction
        await loadComments();
      } catch (error) {
        alert(error.message || "Could not update reaction.");
      }
    });
  });
}

// Submit top-level comment or reply
async function handleCommentSubmit(event) {
  event.preventDefault();

  const body = commentBodyEl.value.trim();
  const parent = parentIdEl.value ? Number(parentIdEl.value) : null;

  if (!body) {
    showCommentFormMessage("Comment body cannot be empty.", true);
    return;
  }

  const payload = { body };

  // Include parent only when replying
  if (parent) {
    payload.parent = parent;
  }

  try {
    setCommentFormDisabled(true);
    hideCommentFormMessage();

    await createComment(payload);

    commentBodyEl.value = "";
    resetReplyMode();
    showCommentFormMessage("Comment submitted successfully.", false);

    // Reload comments so new item appears in exact backend format
    await loadComments();
  } catch (error) {
    showCommentFormMessage(error.message || "Failed to submit comment.", true);
  } finally {
    setCommentFormDisabled(false);
  }
}

/* =========================================================
   REPLY MODE HELPERS
========================================================= */

// Enable reply mode for a specific top-level comment
function setReplyMode(commentId) {
  // Store selected parent comment id in hidden input
  parentIdEl.value = String(commentId);

  // Show small UI indicator so user knows they are replying
  replyToIdEl.textContent = String(commentId);
  showElement(replyIndicatorEl);

  // Move cursor to textarea for better UX
  commentBodyEl.focus();
}

// Disable reply mode and return form to normal comment mode
function resetReplyMode() {
  // Clear hidden parent field so next submit becomes top-level comment
  parentIdEl.value = "";

  // Clear visible reply target text
  replyToIdEl.textContent = "";

  // Hide reply indicator block
  hideElement(replyIndicatorEl);
}

/* =========================================================
   FORM HELPERS
========================================================= */

// Disable/enable form controls during async submit
function setCommentFormDisabled(disabled) {
  commentBodyEl.disabled = disabled;

  // Disable all buttons inside the form while request is in progress
  const buttons = commentFormEl.querySelectorAll("button");
  buttons.forEach(button => {
    button.disabled = disabled;
  });
}

// Show success/error message under comment form
function showCommentFormMessage(message, isError = false) {
  commentFormMessageEl.textContent = message;
  commentFormMessageEl.classList.remove("hidden", "error");

  if (isError) {
    commentFormMessageEl.classList.add("error");
  }
}

// Hide comment form message box
function hideCommentFormMessage() {
  commentFormMessageEl.textContent = "";
  commentFormMessageEl.classList.add("hidden");
  commentFormMessageEl.classList.remove("error");
}

/* =========================================================
   ERROR HELPERS
========================================================= */

// Show error message for post section
function showPostError(message) {
  postErrorEl.textContent = message;
  showElement(postErrorEl);
  hideElement(postContentEl);
}

// Show error message for comments section
function showCommentsError(message) {
  commentsErrorEl.textContent = message;
  showElement(commentsErrorEl);
  hideElement(commentsListEl);
}

/* =========================================================
   GENERIC UI HELPERS
========================================================= */

// Show any DOM element by removing hidden utility class
function showElement(element) {
  element.classList.remove("hidden");
}

// Hide any DOM element by adding hidden utility class
function hideElement(element) {
  element.classList.add("hidden");
}

/* =========================================================
   SECURITY / OUTPUT HELPERS
========================================================= */

// Escape raw text before injecting into HTML
// Prevents accidental HTML injection in text-based fields
function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value == null ? "" : String(value);
  return div.innerHTML;
}
