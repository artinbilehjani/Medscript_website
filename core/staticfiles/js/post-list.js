const postsApiUrl = window.APP_CONFIG.postsApiUrl;

const statusBox = document.getElementById("status-box");
const activeFiltersBox = document.getElementById("active-filters");
const postListBox = document.getElementById("post-list");
const postsContainer = document.getElementById("posts-container");
const loadingMessage = document.getElementById("loading-message");
const errorMessage = document.getElementById("error-message");
const filterForm = document.getElementById("filter-form");
const clearFiltersButton = document.getElementById("clear-filters");
const categoryInput = document.getElementById("category");
const tagInput = document.getElementById("tag");


function setStatus(message = "", type = "") {
    statusBox.className = "";
    statusBox.textContent = message;
    if (type) {
        statusBox.classList.add(type);
    }
}

function getFiltersFromPageUrl() {
    const params = new URLSearchParams(window.location.search);

    return {
        category: params.get("category") || "",
        tag: params.get("tag") || ""
    };
}

function showLoading() {
    loadingMessage.classList.remove("hidden");
    errorMessage.classList.add("hidden");
}

function hideLoading() {
    loadingMessage.classList.add("hidden");
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove("hidden");
}

function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function renderBadges(items, fieldName = "title") {
    if (!items || !items.length) return "";
    return items
        .map(item => `<span class="badge">${escapeHtml(item[fieldName] || item.name || item.slug || "")}</span>`)
        .join("");
}

function renderPostCard(post) {
    const imageHtml = post.image
        ? `<img src="${post.image}" alt="${escapeHtml(post.title)}" class="post-image">`
        : `<div class="post-image"></div>`;

    return `
        <article class="post-card">
            ${imageHtml}
            <div class="post-body">
                <h2 class="post-title">${escapeHtml(post.title)}</h2>

                <div class="post-meta">
                    <span>By ${escapeHtml(post.author || "Unknown")}</span> |
                    <span>Hits: ${escapeHtml(post.hit_count ?? 0)}</span>
                </div>

                <p class="post-snippet">${escapeHtml(post.snippet || "")}</p>

                <div class="post-categories">
                    ${renderBadges(post.category)}
                </div>

                <div class="post-tags">
                    ${renderBadges(post.tag)}
                </div>

                <a href="${post.relative_url}" class="post-link">View API detail</a>
            </div>
        </article>
    `;
}

function renderActiveFilters() {
    const filters = getFiltersFromPageUrl();
    const items = [];

    if (filters.category) {
        items.push(`<span><strong>Category:</strong> ${filters.category}</span>`);
    }

    if (filters.tag) {
        items.push(`<span><strong>Tag:</strong> ${filters.tag}</span>`);
    }

    if (items.length === 0) {
        activeFiltersBox.innerHTML = `<p>No active filters</p>`;
        return;
    }

    activeFiltersBox.innerHTML = items.join(" | ");
}

function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}

function renderPosts(posts) {
    if (!posts || posts.length === 0) {
        postsContainer.innerHTML = `<p>No posts found.</p>`;
        return;
    }

    postsContainer.innerHTML = posts.map(renderPostCard).join("");
}


function buildApiUrl() {
    const params = new URLSearchParams();

    const category = categoryInput.value.trim();
    const tag = tagInput.value.trim();

    if (category) params.append("category", category);
    if (tag) params.append("tag", tag);

    const queryString = params.toString();
    return queryString
    ? `/content/api/v1/posts/?${queryString}`
    : `/content/api/v1/posts/`;
}


async function loadPosts() {
    showLoading();
    postsContainer.innerHTML = "";

    try {
        const data = await apiRequest(buildApiUrl());
        renderPosts(data);
    } catch (error) {
        showError(error.message || "Something went wrong while loading posts.");
    } finally {
        hideLoading();
    }
}

filterForm.addEventListener("submit", function (event) {
    event.preventDefault();
    loadPosts();
});

clearFiltersButton.addEventListener("click", function () {
    categoryInput.value = "";
    tagInput.value = "";
    loadPosts();
});

loadPosts();