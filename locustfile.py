"""
locustfile.py — load test simulating MedScript launch hour.

Run with:
    locust -f locustfile.py --host=http://localhost

Then open http://localhost:8089 in your browser to configure
user count, spawn rate, and watch results live.

Simulates your actual traffic pattern:
  - Most users browse the homepage and post lists (read-heavy)
  - Some open individual posts (triggers hit counting — a DB write)
  - A few download files (the thing you're most worried about)
  - Very few post comments (rare writes)

Adjust weights to match what you expect on launch day.
"""

from locust import HttpUser, task, between


class MedScriptStudent(HttpUser):
    """Simulates one student browsing the site."""

    # Wait 2-8 seconds between actions — realistic browsing pace.
    # Locust spawns many of these simultaneously to simulate load.
    wait_time = between(2, 8)

    @task(10)  # weight 10 — most common action
    def browse_homepage(self):
        """Load the home page + its API call (coverflow data)."""
        self.client.get("/home/", name="/home/")
        self.client.get("/dashboard/api/v1/home/", name="home API")

    @task(8)  # weight 8 — very common
    def browse_post_list(self):
        """Load the search/filter page + its API call."""
        self.client.get("/content/posts/search/", name="/posts/search/")
        self.client.get(
            "/content/api/v1/posts/search/?page=1",
            name="post list API",
        )

    @task(5)  # weight 5 — moderately common
    def view_post_detail(self):
        """
        View a single post — triggers a hit count DB write.
        You'll need at least one published post in the DB for this
        to return 200. Replace the slug below with a real one, or
        use the on_start() method to discover slugs dynamically.
        """
        # Fetch post list first to get a real slug
        with self.client.get(
            "/content/api/v1/posts/?page=1",
            name="get slugs",
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure("Could not fetch post list")
                return
            data = resp.json()
            posts = data.get("results", [])
            if not posts:
                resp.failure("No posts in DB")
                return

        slug = posts[0].get("slug") or posts[0].get("title", "test")
        self.client.get(
            f"/content/api/v1/post/{slug}/",
            name="post detail API",
        )

    @task(2)  # weight 2 — less common, but the dangerous one
    def download_file(self):
        """
        Attempt to download a PostFile. This is the scenario you're
        most worried about — many students downloading lecture PDFs
        simultaneously on launch day.

        For this to work, you need at least one PostFile with
        is_downloadable=True in the DB. Create one via Django admin
        before running the load test.

        Replace the pk below, or fetch it dynamically from a post's
        file list.
        """
        # Try pk=1 — adjust if your first file has a different pk
        with self.client.get(
            "/mediafiles/api/v1/post-files/1/download/",
            name="file download",
            catch_response=True,
        ) as resp:
            if resp.status_code == 404:
                resp.failure("No file with pk=1 — create one in admin first")
            elif resp.status_code == 503:
                # Rate limited — this is EXPECTED under heavy load,
                # it means nginx/django-ratelimit is working correctly.
                resp.success()
            elif resp.status_code == 200:
                resp.success()

    @task(3)  # weight 3
    def load_static_assets(self):
        """
        Simulates the browser loading CSS/JS. These should be served
        entirely by nginx — you should see ZERO Django/gunicorn log
        entries for these requests, even under heavy load.
        """
        self.client.get("/static/css/base.css", name="static CSS")
        self.client.get("/static/js/home.js", name="static JS")

    @task(1)  # weight 1 — rare
    def load_filters(self):
        """Load the category/tag filter options."""
        self.client.get("/content/api/v1/filters/", name="filters API")