document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const filterMenuButton = document.getElementById('filter-menu-button');
    const filterMenu = document.getElementById('filter-menu');
    const applyFiltersButton = document.getElementById('apply-filters-button');
    const clearFiltersButton = document.getElementById('clear-filters-button');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const displayListButton = document.getElementById("display-list-button");
    const displayGridButton = document.getElementById("display-grid-button");
    const postGrid = document.getElementById('post-grid');
    const postList = document.getElementById('post-list');
    const categoryFiltersContainer = document.getElementById('category-filters');
    const tagFiltersContainer = document.getElementById('tag-filters');

    // --- State Variables ---
    let currentView = 'grid'; // 'grid' or 'list'
    let currentPage = 1; // For potential future pagination
    let totalPages = 1;
    let currentFilters = { // Stores currently active filters
        categories: [],
        tags: []
    };
    let currentSearchTerm = '';

    // --- API Endpoint ---
    // IMPORTANT: Replace with your actual API endpoint URL
    const API_URL = "/content/api/v1/posts/search/";

    // --- Functions ---

    /*
     * Fetches posts from the API based on current filters and search term.
     */
    let postsData = [];
    async function fetchPosts(page = 1, { append = false } = {}) {
        currentPage = page; // Update current page
        // Build the URL with query parameters
        const url = new URL(API_URL, window.location.origin);
        const params = url.searchParams;

        if (currentSearchTerm) params.set("search", currentSearchTerm);

        // Add category filters
        currentFilters.categories.forEach((categorySlug) => {
            params.append("category", categorySlug);
        });

        // Add tag filters
        currentFilters.tags.forEach((tagSlug) => {
            params.append("tag", tagSlug);
        });

        params.set("page", String(currentPage));

        // Future: Add pagination parameter: url += `&page=${currentPage}`;

        try {
            const response = await fetch(url.toString());
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json(); // Assuming API returns JSON list of posts

            // Assuming the API returns a structure like { results: [...], count: N, ... }
            // Adjust if your API structure is different
            const posts = data.results || data; // Use data.results if paginated, else data directly

            totalPages = data.total_pages ?? 1;
            currentPage = data.current_page_number ?? currentPage;
            window.paginationLinks = data.links;

            //  keep postsData in sync
            postsData = append ? postsData.concat(posts) : posts;

            displayPosts(postsData, false);
            renderPaginationControls();
            // Future: Update totalPages based on API response if paginated
            // totalPages = Math.ceil(data.count / postsPerPage);
            
        } catch (error) {
            console.error("Error fetching posts:", error);
            // Display error message to the user
            showError("Failed to load posts. Please try again later.");
        }
    }

    /**
     * Renders the fetched posts into the appropriate view (grid or list).
     * @param {Array} posts - Array of post objects from the API.
     * @param {boolean} append - If true, appends posts; otherwise, replaces existing posts.
     */
    // Render pagination controls
function renderPaginationControls() {
  const el = document.getElementById("pagination-controls");
  if (!el) return;

  if (totalPages <= 1) {
    el.innerHTML = "";
    return;
  }

  const makeBtn = (page) => `
    <button
      class="page-btn ${page === currentPage ? "is-active" : ""}"
      data-page="${page}"
      ${page === currentPage ? "disabled" : ""}>
      ${page}
    </button>
  `;

  const pages = [];

  if (totalPages <= 4) {
    for (let p = 1; p <= totalPages; p++) pages.push(p);
  } else if (currentPage <= 3) {
    // show 1 2 3 4 ... last
    pages.push(1, 2, 3, 4, "…", totalPages);
  } else if (currentPage >= totalPages - 2) {
    // show 1 ... last-3 last-2 last-1 last
    pages.push(1, "…", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
  } else {
    // middle: 1 ... p-1 p p+1 ... last
    pages.push(1, "…", currentPage - 1, currentPage, currentPage + 1, "…", totalPages);
  }

  // clean up: remove out-of-range pages and duplicate ellipses
  const cleaned = [];
  for (const x of pages) {
    if (typeof x === "number" && (x < 1 || x > totalPages)) continue;
    if (x === "…" && cleaned[cleaned.length - 1] === "…") continue;
    if (typeof x === "number" && cleaned.includes(x)) continue;
    cleaned.push(x);
  }

  const prevHtml =
    currentPage === 1
      ? ""
      : `<button class="nav-btn" data-page="${currentPage - 1}">Previous</button>`;

  const nextHtml =
    currentPage === totalPages
      ? ""
      : `<button class="nav-btn" data-page="${currentPage + 1}">Next</button>`;

  el.innerHTML = `
    ${prevHtml}
    ${cleaned
      .map((x) => (x === "…" ? `<span class="ellipsis">...</span>` : makeBtn(x)))
      .join("")}
    ${nextHtml}
  `;

  el.onclick = (e) => {
    const btn = e.target.closest("button[data-page]");
    if (!btn) return;
    const page = Number(btn.dataset.page);
    if (!Number.isFinite(page) || page < 1 || page > totalPages || page === currentPage) return;
    fetchPosts(page, { append: false });
  };
}
    function displayPosts(posts, append = false) {
        const postsContainer = currentView === 'grid' ? postGrid : postList;

        // Clear existing posts if not appending
        if (!append) {
            postsContainer.innerHTML = '';
        }

        if (posts.length === 0) {
            postsContainer.innerHTML = '<p class="no-results">No posts found matching your criteria.</p>';
            return;
        }

        posts.forEach(post => {
            const postElement = createPostElement(post);
            postsContainer.appendChild(postElement);
        });
    }

    //////////////////////////////////////////////////////////////
    function getActiveContainer(view = currentView) {
        return view === "grid" ? postGrid : postList;
        }

    function displayPosts(posts, append = false, view = currentView) {
        const postsContainer = getActiveContainer(view);

        if (!append) postsContainer.innerHTML = "";

        if (!posts || posts.length === 0) {
            postsContainer.innerHTML = '<p class="no-results">No posts found matching your criteria.</p>';
            return;
        }

        const frag = document.createDocumentFragment();
        posts.forEach((post) => frag.appendChild(createPostElement(post, view)));
        postsContainer.appendChild(frag);
        }
    /**
     * Creates a single post element (div) based on the post data.
     * @param {Object} post - A single post object.
     * @returns {HTMLElement} The created post element.
     */
    function createPostElement(post, view) {
        const postItem = document.createElement('div');
        postItem.classList.add("post-item", view === "grid" ? "grid-item" : "list-item");

        // --- Image Handling ---
        let imageHtml = '';
        if (post.image) {
            // Use placeholder if image URL is missing or invalid (optional)
            const imageUrl = post.image;
            imageHtml = `<img src="${imageUrl}" alt="${post.title || 'Post Image'}">`;
        } else {
            // Add a placeholder image or skip if no image
            imageHtml = '<div class="post-image-placeholder">No Image</div>';
        }

        // --- Tags and Categories HTML ---
        let tagsHtml = '';
        if (post.tag && post.tag.length > 0) {
            tagsHtml = `
                <div class="post-tags">
                    ${post.tag.map(tag => `<span>${tag.name}</span>`).join('')}
                </div>
            `;
        }
        let categoriesHtml = '';
        if (post.category && post.category.length > 0) {
            categoriesHtml = `
                <div class="post-categories">
                    ${post.category.map(cat => `<span>${cat.name}</span>`).join('')}
                </div>
            `;
        }

        // --- Constructing the Post Element ---
        postItem.innerHTML = `
            ${view  === 'grid' ? imageHtml : ''}
            <div class="post-content">
                ${view  === 'list' ? imageHtml : ''}
                <h2><a href="${post.absolute_url || '#'}" target="_blank">${post.title}</a></h2>
                <div class="post-meta">
                    ${post.author ? `<span>Author: ${post.author}</span>` : ''}
                    ${post.display_date ? `<span>Published: ${(post.display_date)}</span>` : ''}
                </div>
                ${post.snippet ? `<p class="post-snippet">${post.snippet}</p>` : ''}
                ${categoriesHtml}
                ${tagsHtml}
                <p><em>Views ${post.hit_count || 0}</em></p>
            </div>
        `;
        return postItem;
    }

    /**
     * Fetches available categories and tags from the API (or a dedicated endpoint)
     * This assumes you have endpoints like '/api/categories/' and '/api/tags/'
     * If not, you might need to adjust how you get this data.
     */
    async function fetchCategoryAndTagFilters() {
  try {
    const res = await fetch("/content/api/v1/filters/"); // <-- your FilterOptionsView
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    // Tags (single pocket)
    renderFilterOptions(data.tags || [], tagFiltersContainer, "tag", { clear: true });

    // Categories (many pockets grouped by root)
    renderCategoryBuckets(data.category_buckets || [], categoryFiltersContainer);
  } catch (err) {
    console.error("Error fetching filter options:", err);
  }
}
   /**
 * Renders filter checkboxes for categories or tags.
 * @param {Array} items
 * @param {HTMLElement} container
 * @param {string} type - 'category' or 'tag'
 * @param {Object} opts
 */
function renderFilterOptions(items, container, type, opts = {}) {
  const { clear = true, labelKey = "name" } = opts;

  if (clear) container.innerHTML = "";
  (items || []).sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  items.forEach((item) => {
    const label = document.createElement("label");
    label.className = "filter-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.slug = item.slug;
    checkbox.dataset.type = type;

    const key = type === "category" ? "categories" : "tags";
    if (currentFilters[key].includes(item.slug)) checkbox.checked = true;

    const text = item[labelKey] || item.name || item.slug;
    const countText = item.post_count != null ? ` (${item.post_count})` : "";

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${text}${countText}`));
    container.appendChild(label);
  });
}

function renderCategoryBuckets(buckets, container) {
  container.innerHTML = "";

  (buckets || []).forEach(({ root, leaves }) => {
    const details = document.createElement("details");
    details.className = "category-pocket";
    // details.open = true; // uncomment if you want them open by default

    const summary = document.createElement("summary");
    summary.className = "category-pocket-button";
    summary.textContent = root?.name || "Category";

    const body = document.createElement("div");
    body.className = "category-pocket-body filter-options";

    renderFilterOptions(leaves || [], body, "category", {
      clear: true,
      labelKey: "full_name", // falls back to name inside your function
    });

    details.appendChild(summary);
    details.appendChild(body);
    container.appendChild(details);
  });
}

    /*
     * Handles the opening and closing of the filter menu.
     */
    categoryFiltersContainer.addEventListener(
  "toggle",
  (e) => {
    const details = e.target;
    if (details.tagName !== "DETAILS" || !details.classList.contains("category-pocket")) return;
    if (!details.open) return;

    categoryFiltersContainer
      .querySelectorAll("details.category-pocket[open]")
      .forEach((d) => {
        if (d !== details) d.open = false;
      });
  },
  true // <-- capture
);
    function toggleFilterMenu() {
        filterMenu.classList.toggle('open');
        // Optional: Close menu if clicking outside of it
        if (filterMenu.classList.contains('open')) {
            document.addEventListener('click', closeFilterMenuOutside);
        } else {
            document.removeEventListener('click', closeFilterMenuOutside);
        }
    }

    /**
     * Closes the filter menu if the click target is outside the menu itself.
     */
    function closeFilterMenuOutside(event) {
        if (!filterMenu.contains(event.target) && !filterMenuButton.contains(event.target)) {
            filterMenu.classList.remove('open');
            document.removeEventListener('click', closeFilterMenuOutside);
        }
    }

    /**
     * Applies the selected filters and reloads posts.
     */
    function applyFilters() {
        const selectedCategories = Array.from(filterMenu.querySelectorAll('input[data-type="category"]:checked'))
                                         .map(cb => cb.dataset.slug);
        const selectedTags = Array.from(filterMenu.querySelectorAll('input[data-type="tag"]:checked'))
                                   .map(cb => cb.dataset.slug);

        currentFilters.categories = selectedCategories;
        currentFilters.tags = selectedTags;

        filterMenu.classList.remove('open'); // Close menu after applying
        document.removeEventListener('click', closeFilterMenuOutside);
        fetchPosts(); // Reload posts with new filters
    }

    /**
     * Clears all selected filters and reloads posts.
     */
    function clearFilters() {
        currentFilters = { categories: [], tags: [] };
        // Uncheck all checkboxes
        filterMenu.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        fetchPosts(); // Reload posts with no filters
    }

    /**
     * Handles the search input and button click.
     */
    function handleSearch() {
        currentSearchTerm = searchInput.value.trim();
        fetchPosts(1, { append: false }); // Reload posts with the new search term
    }

    /**
     * Toggles between grid and list view.
     */

    function setView(view) {
        if (currentView === view) return;

        currentView = view;

        const isGrid = view === "grid";
        postGrid.style.display = isGrid ? "grid" : "none";
        postList.style.display = isGrid ? "none" : "grid";

        displayGridButton?.classList.toggle("active", isGrid);
        displayListButton?.classList.toggle("active", !isGrid);
        displayPosts(postsData || [], false);
        renderPosts(isGrid ? postGrid : postList, postsData, view);
        }

    function renderPosts(container, posts, view) {
        container.innerHTML = "";
        const frag = document.createDocumentFragment();
        posts.forEach((post) => frag.appendChild(createPostElement(post, view)));
        container.appendChild(frag);
        }
    
    /**
     * Displays an error message to the user.
     * @param {string} message - The error message.
     */
    function showError(message) {
        // You could implement a more sophisticated error display, e.g., a modal or toast
        alert(message); // Simple alert for now
    }

    // --- Event Listeners ---

    // Filter menu toggle
    filterMenuButton.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent immediate closing by document listener
        toggleFilterMenu();
    });

    // Apply filters button
    applyFiltersButton.addEventListener('click', applyFilters);

    // Clear filters button
    clearFiltersButton.addEventListener('click', clearFilters);

    // Search button / Enter key in search input
    searchButton.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            handleSearch();
        }
    });
    

    // Display toggle button
    displayGridButton?.addEventListener("click", () => setView("grid"));
    displayListButton?.addEventListener("click", () => setView("list"));
    setView("grid");
    // --- Initialization ---
    fetchCategoryAndTagFilters(); // Load filter options when the page loads
    fetchPosts(); // Load initial set of posts
});