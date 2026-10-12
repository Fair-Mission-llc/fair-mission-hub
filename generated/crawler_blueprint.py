import os
import re
import time
from playwright.sync_api import sync_playwright

LOCAL_HOST = "http://localhost:3000"
BASE_OUTPUT_DIR = ["generated", "dashboard_visual_catalog"]
APP_DIR = os.path.join("apps", "web", "app")
OUTPUT_PATH_DIR = os.path.join(*BASE_OUTPUT_DIR)

# Wipe out old thumbnail remnants to ensure a completely fresh run
if os.path.exists(OUTPUT_PATH_DIR):
    import shutil
    try:
        shutil.rmtree(OUTPUT_PATH_DIR)
    except Exception:
        pass
os.makedirs(OUTPUT_PATH_DIR, exist_ok=True)

def discover_all_production_routes(base_dir):
    """Surgically scans the Next.js app directory to discover all valid static routes."""
    routes = []
    for root, dirs, files in os.walk(base_dir):
        if "page.tsx" in files or "page.jsx" in files:
            relative_path = os.path.relpath(root, base_dir)
            if relative_path == ".":
                continue # Skips root / to prevent landing page 404 errors during crawl
            clean_route = "/" + relative_path.replace("\\", "/")
            clean_route = re.sub(r'/\([^)]+\)', '', clean_route)
            if "[" not in clean_route and "]" not in clean_route:
                routes.append(clean_route)
    return sorted(list(set(routes)))

# Development credentials from the memory driver's sign-in hint (Shell.tsx). Super Admin reaches every route.
CRAWLER_EMAIL = os.environ.get("CRAWLER_EMAIL", "testsuperadmin@kofc.org")
CRAWLER_PASSWORD = os.environ.get("CRAWLER_PASSWORD", "dev-pass-secure-9912")
KEY_DELAY_MS = 50
SIGNED_IN_SELECTOR = "nav, main"  # Only the signed-in Frame renders these; the sign-in card has neither.
SIGN_IN_TIMEOUT_MS = 12000


def sign_in(page):
    """Types the credentials with human key delays and blocks until the portal frame has replaced the sign-in card.

    The portal's session lives in React state backed by the in-tab memory database (apps/web/lib/session.tsx),
    not in cookies, so a full page load signs the crawler out. Sign in once, then navigate client-side only.
    """
    page.goto(f"{LOCAL_HOST}/", wait_until="load", timeout=30000)
    email = page.get_by_label("Email")
    email.wait_for(state="visible", timeout=30000)  # The seeded database must be ready before the form renders.
    email.click()
    email.press_sequentially(CRAWLER_EMAIL, delay=KEY_DELAY_MS)
    password = page.get_by_label("Password")
    password.click()
    password.press_sequentially(CRAWLER_PASSWORD, delay=KEY_DELAY_MS)
    page.get_by_role("button", name="Sign in").click()
    page.wait_for_selector(SIGNED_IN_SELECTOR, timeout=SIGN_IN_TIMEOUT_MS)
    print(f"✓ Signed in as {CRAWLER_EMAIL}. Route captures starting.")


def client_navigate(page, route_path):
    """Pushes the route through the Next.js app router so the in-memory session survives the navigation."""
    page.evaluate(
        """(route) => {
            if (window.next && window.next.router) window.next.router.push(route);
            else window.history.pushState(null, '', route);
        }""",
        route_path,
    )
    page.wait_for_url(f"{LOCAL_HOST}{route_path}", timeout=8000)
    page.wait_for_selector(SIGNED_IN_SELECTOR, timeout=SIGN_IN_TIMEOUT_MS)


def execute_universal_visual_crawl():
    print("🚀 Booting Signed-In Production Layout Crawler...")
    discovered_routes = discover_all_production_routes(APP_DIR)
    print(f"🎯 Discovered {len(discovered_routes)} production routes to capture!")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        sign_in(page)

        # Cycle through all discovered static system paths and capture clean frames
        for idx, route_path in enumerate(discovered_routes, 1):
            if route_path == "/login":
                continue

            safe_filename = route_path.strip("/").replace("/", "_")
            if safe_filename == "":
                safe_filename = "Root_Landing_Page"
            safe_filename = f"{safe_filename}.png"

            print(f"📸 [{idx}/{len(discovered_routes)}] Capturing: {route_path} ➔ {safe_filename}")
            try:
                client_navigate(page, route_path)
                time.sleep(2.5) # Settle budget bars, progress lines, and gauges completely before snap

                # Cross-platform safe path constructor prevents Windows Errno 22 crashes
                output_file_path = os.path.join(OUTPUT_PATH_DIR, safe_filename)
                page.screenshot(path=output_file_path, full_page=True)
            except Exception as capture_error:
                print(f"  ❌ Error capturing layout path {route_path}: {capture_error}")
                # A failed navigation may have reloaded the tab and dropped the session; sign back in.
                if page.query_selector(SIGNED_IN_SELECTOR) is None:
                    sign_in(page)

        context.close()
        browser.close()
        print(f"\n🏆 Universal Visual Catalog Generation Complete! View your clean assets inside: /{OUTPUT_PATH_DIR}/")

if __name__ == "__main__":
    if not os.path.exists(APP_DIR):
        if os.path.exists(os.path.join("..", "..", APP_DIR)):
            APP_DIR = os.path.join("..", "..", APP_DIR)
    execute_universal_visual_crawl()
