document.addEventListener("DOMContentLoaded", function () {
  const config = window.APP_CONFIG || {};
  const slug = config.currentSlug;
  const apiBaseUrl = config.postDetailApiBaseUrl;

  const loadingEl = document.getElementById("post-loading");
  const errorEl = document.getElementById("post-error");
  const contentEl = document.getElementById("post-content");

  const imageEl = document.getElementById("post-image");
  const titleEl = document.getElementById("post-title");
  const authorEl = document.getElementById("post-author");
  const publishedDateEl = document.getElementById("post-published-date");
  const hitCountEl = document.getElementById("post-hit-count");
  const categoriesEl = document.getElementById("post-categories");
  const tagsEl = document.getElementById("post-tags");
  const contentHtmlEl = document.getElementById("post-content-html");
  const linksEl = document.getElementById("post-links");
  const filesEl = document.getElementById("post-files");


  if (!slug || !apiBaseUrl) {
    showError("تنظیمات صفحه کامل نیست.");
    return;
  }

  fetchPostDetail();

  function fetchPostDetail() {
    const url = buildDetailUrl(apiBaseUrl, slug);

    fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    })
      .then(handleResponse)
      .then(function (data) {
        renderPost(data);
      })
      .catch(function (error) {
        showError(error.message || "خطا در دریافت اطلاعات پست.");
      });
  }

  function buildDetailUrl(baseUrl, slugValue) {
    let normalizedBase = baseUrl;
    if (!normalizedBase.endsWith("/")) {
      normalizedBase += "/";
    }
    return normalizedBase + encodeURIComponent(slugValue) + "/";
  }

  function handleResponse(response) {
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("پست پیدا نشد.");
      }
      throw new Error("خطا در دریافت اطلاعات از سرور.");
    }
    return response.json();
  }

  function renderPost(post) {
    loadingEl.hidden = true;
    errorEl.hidden = true;
    contentEl.hidden = false;

    titleEl.textContent = post.title || "-";
    authorEl.textContent = post.author || "-";
    publishedDateEl.textContent = formatDate(post.published_date);
    hitCountEl.textContent = formatNumber(post.hit_count);

    renderImage(post.image, post.title);
    renderCategories(post.category || []);
    renderTags(post.tag || []);
    renderContent(post.content);
    renderLinks(post.links);
    renderFiles(post.files || []);

    document.title = post.title ? post.title : "جزئیات پست";
  }

  function renderImage(imageUrl, title) {
    if (imageUrl) {
      imageEl.src = imageUrl;
      imageEl.alt = title || "";
      imageEl.style.display = "block";
    } else {
      imageEl.style.display = "none";
    }
  }

  function renderCategories(categories) {
    categoriesEl.innerHTML = "";

    if (!categories.length) {
      categoriesEl.innerHTML = '<span class="empty-text">دسته‌بندی ندارد.</span>';
      return;
    }

    categories.forEach(function (category) {
      const item = document.createElement("span");
      item.className = "tag-item";
      item.textContent = category.title || category.name || "بدون عنوان";
      categoriesEl.appendChild(item);
    });
  }

  function renderTags(tags) {
    tagsEl.innerHTML = "";

    if (!tags.length) {
      tagsEl.innerHTML = '<span class="empty-text">برچسب ندارد.</span>';
      return;
    }

    tags.forEach(function (tag) {
      const item = document.createElement("span");
      item.className = "tag-item";
      item.textContent = tag.title || tag.name || "بدون عنوان";
      tagsEl.appendChild(item);
    });
  }

  function renderContent(content) {
    contentHtmlEl.innerHTML = content || "<p>محتوایی ثبت نشده است.</p>";
  }

  function renderLinks(links) {
    linksEl.innerHTML = "";

    if (!links) {
      linksEl.innerHTML = '<span class="empty-text">لینکی وجود ندارد.</span>';
      return;
    }

    if (Array.isArray(links)) {
      if (!links.length) {
        linksEl.innerHTML = '<span class="empty-text">لینکی وجود ندارد.</span>';
        return;
      }

      links.forEach(function (linkItem) {
        const linkEl = createLinkElementFromUnknown(linkItem);
        if (linkEl) {
          linksEl.appendChild(linkEl);
        }
      });
      return;
    }

    if (typeof links === "string") {
      const a = document.createElement("a");
      a.href = links;
      a.textContent = links;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.className = "link-item";
      linksEl.appendChild(a);
      return;
    }

    if (typeof links === "object") {
      const linkEl = createLinkElementFromUnknown(links);
      if (linkEl) {
        linksEl.appendChild(linkEl);
        return;
      }
    }

    linksEl.innerHTML = '<span class="empty-text">لینکی وجود ندارد.</span>';
  }

  function createLinkElementFromUnknown(item) {
    if (!item) return null;

    let url = "";
    let text = "";

    if (typeof item === "string") {
      url = item;
      text = item;
    } else if (typeof item === "object") {
      url = item.url || item.link || item.href || "";
      text = item.title || item.name || item.label || url;
    }

    if (!url) return null;

    const a = document.createElement("a");
    a.href = url;
    a.textContent = text || url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = "link-item";

    return a;
  }

  function renderFiles(files) {
    filesEl.innerHTML = "";

    if (!files.length) {
      filesEl.innerHTML = '<span class="empty-text">فایلی وجود ندارد.</span>';
      return;
    }

    files.forEach(function (file) {
      const fileUrl = file.file || file.url || "";
      const fileName = file.title || file.name || extractFileName(fileUrl) || "دانلود فایل";

      if (!fileUrl) return;

      const a = document.createElement("a");
      a.href = fileUrl;
      a.textContent = fileName;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.className = "file-item";

      filesEl.appendChild(a);
    });
  }

  function extractFileName(url) {
    if (!url) return "";
    const parts = url.split("/");
    return parts[parts.length - 1];
  }

  function formatDate(value) {
    if (!value) return "-";
    return value;
  }

  function formatNumber(value) {
    if (value === null || value === undefined) return "۰";
    return String(value);
  }

  function showError(message) {
    loadingEl.hidden = true;
    contentEl.hidden = true;
    errorEl.hidden = false;
    errorEl.textContent = message || "خطایی رخ داده است.";
  }
});
