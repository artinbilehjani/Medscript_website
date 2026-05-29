const apiUrl = window.APP_CONFIG.categoryApiUrl;
const skillsGrid = document.getElementById('skillsGrid');

let navigationStack = [];
let currentPath = null;
let currentTitle = 'Categories';

function handleCategoryClick(category) {
    if (category.has_children) {
        openCategory(category);
        return;
    }

    const categoryName = encodeURIComponent(category.name);
    window.location.href = `/content/posts/?category=${categoryName}`;
}

function createElement(tag, options = {}) {
    const el = document.createElement(tag);

    if (options.className) el.className = options.className;
    if (options.text != null) el.textContent = options.text;
    if (options.attrs) {
        Object.entries(options.attrs).forEach(([key, value]) => {
            el.setAttribute(key, value);
        });
    }
    if (options.style) {
        Object.entries(options.style).forEach(([key, value]) => {
            el.style[key] = value;
        });
    }
    if (options.on) {
        Object.entries(options.on).forEach(([event, handler]) => {
            el.addEventListener(event, handler);
        });
    }
    if (options.children) {
        options.children.forEach(child => {
            if (child) el.appendChild(child);
        });
    }

    return el;
}

function buildUrl(parentPath = null) {
    if (!parentPath) return apiUrl;

    const url = new URL(apiUrl, window.location.origin);
    url.searchParams.set('parent_path', parentPath);
    return url.toString();
}

async function fetchCategories(parentPath = null) {
    const response = await fetch(buildUrl(parentPath), {
        method: 'GET',
        headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }

    return response.json();
}

function clearGrid() {
    skillsGrid.innerHTML = '';
}

function createMessageHexagon(message, icon = '•') {
    return createElement('div', {
        className: 'skill-hexagon',
        children: [
            createElement('div', {
                className: 'hexagon-inner',
                children: [
                    createElement('div', {
                        className: 'hexagon-content',
                        children: [
                            createElement('div', {
                                className: 'skill-icon-hex',
                                text: icon
                            }),
                            createElement('div', {
                                className: 'skill-name-hex',
                                text: message
                            }),
                            createElement('div', {
                                className: 'skill-level',
                                children: [
                                    createElement('div', {
                                        className: 'skill-level-fill',
                                        style: { width: '100%' }
                                    })
                                ]
                            })
                        ]
                    })
                ]
            })
        ]
    });
}

function createCategoryHexagon(category, index) {
    const hasChildren = Boolean(category.has_children);

    return createElement('div', {
        className: 'skill-hexagon',
        style: {
            animationDelay: `${index * 0.1}s`,
            cursor: hasChildren ? 'pointer' : 'default'
        },
        on: {
            click: () => handleCategoryClick(category)
        },
        children: [
            createElement('div', {
                className: 'hexagon-inner',
                children: [
                    createElement('div', {
                        className: 'hexagon-content',
                        children: [
                            createElement('div', {
                                className: 'skill-icon-hex',
                                text: hasChildren ? '📘' : '🐳'
                            }),
                            createElement('div', {
                                className: 'skill-name-hex',
                                text: category.name
                            }),
                            createElement('div', {
                                className: 'skill-level',
                                children: [
                                    createElement('div', {
                                        className: 'skill-level-fill',
                                        style: { width: '100%' }
                                    })
                                ]
                            })
                        ]
                    })
                ]
            })
        ]
    });
}

function createBackHexagon() {
    return createElement('div', {
        className: 'skill-hexagon back-hexagon',
        on: {
            click: goBack
        },
        children: [
            createElement('div', {
                className: 'hexagon-inner',
                children: [
                    createElement('div', {
                        className: 'hexagon-content',
                        children: [
                            createElement('div', {
                                className: 'skill-icon-hex',
                                text: '←'
                            }),
                            createElement('div', {
                                className: 'skill-name-hex',
                                text: 'Back'
                            }),
                            createElement('div', {
                                className: 'skill-level',
                                children: [
                                    createElement('div', {
                                        className: 'skill-level-fill',
                                        style: { width: '100%' }
                                    })
                                ]
                            })
                        ]
                    })
                ]
            })
        ]
    });
}

function renderCategories(data) {
    clearGrid();

    if (navigationStack.length > 0) {
        skillsGrid.appendChild(createBackHexagon());
    }

    if (!data.results || data.results.length === 0) {
        skillsGrid.appendChild(createMessageHexagon('No categories found', '∅'));
        return;
    }

    data.results.forEach((category, index) => {
        skillsGrid.appendChild(createCategoryHexagon(category, index));
    });
}

async function loadCategories(parentPath = null, title = 'Categories', pushToStack = false) {
    try {
        clearGrid();
        skillsGrid.appendChild(createMessageHexagon('Loading...', '…'));

        if (pushToStack) {
            navigationStack.push({
                path: currentPath,
                title: currentTitle
            });
        }

        const data = await fetchCategories(parentPath);

        currentPath = parentPath;
        currentTitle = title;

        renderCategories(data);
    } catch (error) {
        console.error(error);
        clearGrid();
        skillsGrid.appendChild(createMessageHexagon('Could not load categories', '!'));
    }
}

function openCategory(category) {
    if (!category.has_children) return;
    loadCategories(category.path, category.name, true);
}

function goBack() {
    if (navigationStack.length === 0) {
        loadCategories(null, 'Categories', false);
        return;
    }

    const previous = navigationStack.pop();
    loadCategories(previous.path, previous.title, false);
}

document.addEventListener('DOMContentLoaded', () => {
    loadCategories();
});