from playwright.sync_api import sync_playwright
import json
import sys

results = []

def test(name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    results.append({"name": name, "status": status, "detail": detail})
    print(f"[{status}] {name}" + (f" — {detail}" if detail else ""))

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # 桌面端测试
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    home_resp = page.goto("https://weihub.cloud/", timeout=30000, wait_until="networkidle")
    # 等待 Next.js hydration 完成
    page.wait_for_timeout(5000)

    # ========== 基础加载 ==========
    test("首页标题", page.title() != "", f"title={page.title()}")
    test("HTTP 200", home_resp is not None and home_resp.status == 200, f"status={home_resp.status if home_resp else 'N/A'}")

    # ========== 搜索框 ==========
    inputs = page.locator("input").all()
    if inputs:
        test("搜索框存在", True, f"找到 {len(inputs)} 个 input")
        search_input = inputs[0]
        search_input.click()
        search_input.fill("ChatGPT")
        page.wait_for_timeout(1500)
        # 检查搜索结果
        body = page.locator("body").text_content()
        test("搜索 ChatGPT", "ChatGPT" in body, "搜索结果包含 ChatGPT")
        search_input.clear()
        page.wait_for_timeout(500)
    else:
        test("搜索框存在", False, "input 数量=0，可能未 hydration")

    # ========== 工具卡片 ==========
    tool_links = page.locator("a[href*='/tools/']").all()
    test("工具卡片渲染", len(tool_links) > 0, f"找到 {len(tool_links)} 个工具链接")

    # 点击工具详情
    if tool_links:
        tool_links[0].click()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)
        detail_text = page.locator("body").text_content()
        test("工具详情页", len(detail_text) > 100, f"详情页内容长度={len(detail_text)}")
        page.go_back()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)

    # ========== 分类筛选 ==========
    # 查找所有可能的分类元素
    all_buttons = page.locator("button").all()
    all_links = page.locator("a").all()
    print(f"\n  调试: buttons={len(all_buttons)}, links={len(all_links)}")

    # 查找分类区域
    cat_section = page.locator("section").all()
    for i, sec in enumerate(cat_section):
        text = sec.text_content()[:80] if sec.text_content() else ""
        print(f"  section[{i}]: {text[:60]}...")

    # 尝试点击热门推荐工具
    hot_tools = page.locator("a[href*='/tools/']").all()
    test("热门推荐工具", len(hot_tools) > 0, f"{len(hot_tools)} 个热门工具")

    # ========== 导航栏 ==========
    nav = page.locator("nav").all()
    test("导航栏", len(nav) > 0, f"找到 {len(nav)} 个 nav")

    # ========== 页脚 ==========
    footer = page.locator("footer").all()
    test("页脚", len(footer) > 0)

    # ========== 主题切换 ==========
    theme_buttons = page.locator("button[title*='主题'], button[aria-label*='主题'], button[aria-label*='theme'], button[class*='theme'], button[class*='Theme']")
    if theme_buttons.count() > 0:
        theme_btn = theme_buttons.nth(0)
        html_class_before = page.locator("html").get_attribute("class") or ""
        theme_btn.click()
        page.wait_for_timeout(500)
        html_class_after = page.locator("html").get_attribute("class") or ""
        test("主题切换", html_class_before != html_class_after, f"'{html_class_before}' → '{html_class_after}'")
        # 切回
        theme_btn.click()
    else:
        test("主题切换按钮存在", False, "未找到可识别的主题切换按钮")

    # ========== 场景页面 ==========
    page.goto("https://weihub.cloud/scenes", timeout=15000, wait_until="networkidle")
    page.wait_for_timeout(3000)
    scene_links = page.locator("a[href*='/scenes/']").all()
    test("场景页面", len(scene_links) > 0, f"{len(scene_links)} 个场景链接")

    # ========== 排行榜页面 ==========
    page.goto("https://weihub.cloud/leaderboard", timeout=15000, wait_until="networkidle")
    page.wait_for_timeout(2000)
    lb_text = page.locator("body").text_content()
    test("排行榜页面", "排行" in lb_text or "工具" in lb_text, f"URL={page.url}")

    # ========== 移动端测试 ==========
    mobile = browser.new_page(viewport={"width": 375, "height": 812})
    mobile.goto("https://weihub.cloud/", timeout=30000, wait_until="networkidle")
    mobile.wait_for_timeout(5000)
    mobile_nav = mobile.locator("nav[class*='fixed'], nav[class*='bottom']").all()
    test("移动端底部导航", len(mobile_nav) > 0, f"找到 {len(mobile_nav)} 个固定导航")
    mobile.screenshot(path="/tmp/weihub-mobile.png")
    mobile.close()

    # ========== 性能 ==========
    perf_page = browser.new_page()
    perf_page.goto("https://weihub.cloud/", timeout=30000, wait_until="networkidle")
    perf = perf_page.evaluate("""() => {
        const [nav] = performance.getEntriesByType('navigation');
        return nav ? { load: Math.round(nav.loadEventEnd - nav.startTime) } : null;
    }""")
    test("加载性能", perf and perf["load"] < 5000, f"Load: {perf['load'] if perf else 'N/A'}ms")

    # ========== 控制台错误 ==========
    err_page = browser.new_page()
    errors = []
    err_page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
    err_page.goto("https://weihub.cloud/", timeout=30000, wait_until="networkidle")
    err_page.wait_for_timeout(3000)
    critical = [e for e in errors if "sentry" not in e.lower() and "net::" not in e.lower()]
    test("无严重JS错误", len(critical) == 0, f"错误数: {len(critical)}")
    err_page.close()

    browser.close()

# 汇总
passed = sum(1 for r in results if r["status"] == "PASS")
failed = sum(1 for r in results if r["status"] == "FAIL")
print(f"\n{'='*50}")
print(f"测试结果: {passed}/{len(results)} 通过, {failed} 失败")
if failed:
    print("失败项:")
    for r in results:
        if r["status"] == "FAIL":
            print(f"  ❌ {r['name']}: {r['detail']}")
    sys.exit(1)
