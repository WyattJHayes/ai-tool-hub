from playwright.sync_api import sync_playwright
import json, time
import sys

results = []

def test(name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    results.append({"name": name, "status": status, "detail": detail})
    print(f"[{status}] {name}" + (f" — {detail}" if detail else ""))

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})

    # ========== 1. 首页加载 ==========
    page.goto("https://weihub.cloud/", timeout=30000)
    page.wait_for_load_state("networkidle")
    test("首页加载", page.title() != "", f"title={page.title()}")

    # ========== 2. 关键元素存在 ==========
    hero = page.locator("h1")
    test("Hero 标题存在", hero.count() > 0, hero.first.text_content()[:50] if hero.count() > 0 else "")

    search = page.locator("input[type='text'], input[placeholder*='搜索'], input[placeholder*='Search']")
    test("搜索框存在", search.count() > 0)

    # ========== 3. 工具卡片渲染 ==========
    page.wait_for_timeout(2000)
    cards = page.locator("[class*='tool-card'], [class*='ToolCard'], a[href*='/tools/']")
    test("工具卡片渲染", cards.count() > 0, f"找到 {cards.count()} 个卡片元素")

    # ========== 4. 分类筛选 ==========
    cat_buttons = page.locator("button[class*='category'], [class*='category-btn'], [class*='CategoryFilter'] button")
    test("分类筛选按钮存在", cat_buttons.count() > 0, f"{cat_buttons.count()} 个分类")

    if cat_buttons.count() > 1:
        before = cards.count()
        clicked_category = cat_buttons.nth(1)
        clicked_category.click()
        page.wait_for_timeout(1000)
        after = page.locator("[class*='tool-card'], [class*='ToolCard'], a[href*='/tools/']").count()
        clicked_class = clicked_category.get_attribute("class") or ""
        clicked_aria = clicked_category.get_attribute("aria-pressed") or ""
        filter_changed = after != before or "active" in clicked_class.lower() or clicked_aria.lower() == "true"
        test("分类筛选生效", filter_changed, f"点击第2个分类后卡片数: {before} → {after}, class={clicked_class}")

    # ========== 5. 搜索功能 ==========
    if search.count() > 0:
        search.first.click()
        search.first.fill("ChatGPT")
        page.wait_for_timeout(1000)
        body_text = page.locator("body").text_content()
        test("搜索功能", "ChatGPT" in body_text, "搜索 ChatGPT 有结果")
        search.first.clear()
        search.first.fill("")
        page.wait_for_timeout(500)

    # ========== 6. 导航栏 ==========
    navbar = page.locator("nav, [class*='navbar'], [class*='Navbar']")
    test("导航栏存在", navbar.count() > 0)

    # ========== 7. 页脚 ==========
    footer = page.locator("footer, [class*='footer'], [class*='Footer']")
    test("页脚存在", footer.count() > 0)

    # ========== 8. 主题切换 ==========
    theme_btn = page.locator("button[class*='theme'], [class*='moon'], [class*='sun'], [aria-label*='主题'], [aria-label*='theme']")
    if theme_btn.count() > 0:
        html_before = page.locator("html").get_attribute("class") or ""
        theme_btn.first.click()
        page.wait_for_timeout(500)
        html_after = page.locator("html").get_attribute("class") or ""
        test("主题切换", html_before != html_after, f"class: {html_before} → {html_after}")
    else:
        test("主题切换按钮存在", False, "未找到主题切换按钮")

    # ========== 9. HTTP 状态码 ==========
    resp = page.goto("https://weihub.cloud/", timeout=15000)
    test("HTTP 200", resp.status == 200, f"status={resp.status}")

    # ========== 10. 性能检查 ==========
    page.goto("https://weihub.cloud/", timeout=30000)
    perf = page.evaluate("""() => {
        const [nav] = performance.getEntriesByType('navigation');
        return nav ? {
            domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
            load: Math.round(nav.loadEventEnd - nav.startTime),
            transferSize: nav.transferSize
        } : null;
    }""")
    if perf:
        test("页面加载 < 5s", perf["load"] < 5000, f"DOM: {perf['domContentLoaded']}ms, Load: {perf['load']}ms, Size: {perf['transferSize']}B")
    else:
        test("性能数据获取", False, "无法获取 performance 数据")

    # ========== 11. 移动端适配 ==========
    mobile_page = browser.new_page(viewport={"width": 375, "height": 812})
    mobile_page.goto("https://weihub.cloud/", timeout=30000)
    mobile_page.wait_for_load_state("networkidle")
    mobile_page.wait_for_timeout(2000)
    # 检查是否有移动端底部导航
    bottom_nav = mobile_page.locator("[class*='bottom-nav'], [class*='BottomNav'], nav[class*='fixed']")
    test("移动端底部导航", bottom_nav.count() > 0, f"找到 {bottom_nav.count()} 个底部导航")
    mobile_page.close()

    # ========== 12. 场景页面 ==========
    page.goto("https://weihub.cloud/scenes", timeout=15000)
    page.wait_for_load_state("networkidle")
    scene_cards = page.locator("a[href*='/scenes/'], [class*='scene'], [class*='Scene']")
    test("场景推荐页面", page.url == "https://weihub.cloud/scenes" or scene_cards.count() > 0, f"URL={page.url}, 场景卡片={scene_cards.count()}")

    # ========== 13. 控制台错误 ==========
    errors = []
    page2 = browser.new_page()
    page2.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
    page2.goto("https://weihub.cloud/", timeout=30000)
    page2.wait_for_load_state("networkidle")
    page2.wait_for_timeout(3000)
    critical_errors = [e for e in errors if "net::" not in e.lower() and "404" not in e and "sentry" not in e.lower()]
    test("无严重控制台错误", len(critical_errors) == 0, f"错误数: {len(critical_errors)}" + (f" — {critical_errors[:2]}" if critical_errors else ""))
    page2.close()

    browser.close()

# 汇总
passed = sum(1 for r in results if r["status"] == "PASS")
failed = sum(1 for r in results if r["status"] == "FAIL")
print(f"\n{'='*50}")
print(f"测试结果: {passed}/{len(results)} 通过, {failed} 失败")
for r in results:
    if r["status"] == "FAIL":
        print(f"  ❌ {r['name']}: {r['detail']}")

if failed:
    sys.exit(1)
