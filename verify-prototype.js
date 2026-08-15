const fs = require("fs");
const path = require("path");
const { chromium } = require("../../../frontend/node_modules/playwright");

const baseUrl = process.env.GARMENT_PROTOTYPE_URL || "http://127.0.0.1:4177/";
const outputDir = path.resolve(__dirname, "../../../tmp");
fs.mkdirSync(outputDir, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function metrics(page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight
  }));
}

async function openPage(browser, url, viewport) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  await page.goto(url, { waitUntil: "networkidle" });
  return { page, errors };
}

async function choose(page, pathName, value) {
  await page.locator(`button[data-input-path="${pathName}"][data-value="${value}"]`).click();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const report = [];
  try {
    const demo = await openPage(browser, `${baseUrl}index.html`, { width: 1440, height: 900 });
    await demo.page.evaluate(() => localStorage.clear());
    await demo.page.reload({ waitUntil: "networkidle" });

    assert(await demo.page.locator("#inputTabs button").count() === 4, "案例页输入没有按四组展示");
    assert(await demo.page.locator(".analysis-surface").count() === 0, "案例页仍保留独立本次影响区域");
    assert(await demo.page.locator(".candidate-card").count() === 3, "默认输入没有生成三个完整方案");
    assert(await demo.page.locator(".outfit-illustration").count() === 3, "候选方案没有生成简易效果图");
    const desktopLayout = await demo.page.evaluate(() => {
      const input = document.querySelector(".demo-column-input").getBoundingClientRect();
      const results = document.querySelector(".demo-column-results").getBoundingClientRect();
      return {
        inputWidth: input.width,
        resultsWidth: results.width,
        inputPosition: getComputedStyle(document.querySelector(".demo-column-input")).position,
        headingPosition: getComputedStyle(document.querySelector(".recommendation-heading")).position
      };
    });
    assert(desktopLayout.inputWidth >= 330 && desktopLayout.inputWidth <= 400, "桌面案例页左侧输入栏宽度不在稳定范围内");
    assert(desktopLayout.resultsWidth > desktopLayout.inputWidth * 2, "桌面案例页没有形成明确的左右分栏比例");
    assert(desktopLayout.inputPosition === "sticky" && desktopLayout.headingPosition === "sticky", "案例页两侧固定区域未启用吸顶布局");

    // Every input group must be renderable and persist a canonical value.
    for (const group of ["context", "personal", "preference", "goal-boundaries"]) {
      await demo.page.locator(`button[data-group="${group}"]`).click();
      assert(await demo.page.locator("#inputContent").innerText(), `${group} 输入组没有内容`);
    }
    // Verify layout stability when switching input tabs on Case Runner page
    const initialRecTop = await demo.page.locator(".recommendation-section").evaluate((el) => el.getBoundingClientRect().top);
    for (const group of ["personal", "preference", "goal-boundaries", "context"]) {
      await demo.page.locator(`button[data-group="${group}"]`).click();
      const currentRecTop = await demo.page.locator(".recommendation-section").evaluate((el) => el.getBoundingClientRect().top);
      assert(Math.abs(initialRecTop - currentRecTop) <= 1, `切换到 ${group} 时方案模块发生垂直跳动 (${initialRecTop} -> ${currentRecTop})`);
    }

    assert((await demo.page.locator("#recommendationTitle").innerText()).includes("02"), "案例页方案模块缺少02完整方案标题");

    await demo.page.locator('button[data-group="personal"]').click();
    assert(await demo.page.locator(".range-step").count() >= 65, "连续档位没有渲染为刻度按钮");
    assert(await demo.page.locator(".range-endpoint").count() >= 26, "连续档位缺少两端极值标注");
    assert((await demo.page.locator(".range-track").first().innerText()).trim() === "", "连续档位中间刻度不应重复显示长文案");
    const inlineRangeState = await demo.page.evaluate(() => ({
      count: document.querySelectorAll(".appearance-matrix-wrap .range-form-item--inline").length,
      rowHeights: [...document.querySelectorAll(".appearance-matrix-wrap .range-inline-row")].map((item) => item.getBoundingClientRect().height),
      hasLegacyLabel: document.querySelector(".appearance-matrix-wrap")?.innerText.includes("冷暖"),
      radioCount: document.querySelectorAll(".appearance-matrix-wrap .range-step[role=radio]").length,
      checkedCount: document.querySelectorAll(".appearance-matrix-wrap .range-step[aria-checked=true]").length
    }));
    assert(inlineRangeState.count === 9, "外观色彩没有将九个连续量统一为行内控件");
    assert(inlineRangeState.rowHeights.every((height) => height <= 36), "外观色彩行内控件仍占用过高的垂直空间");
    assert(!inlineRangeState.hasLegacyLabel, "外观色彩仍显示重复的冷暖字段文案");
    assert(inlineRangeState.radioCount === 45 && inlineRangeState.checkedCount === 9, "外观色彩刻度缺少可访问的单选状态");
    await choose(demo.page, "appearance.skinValue", "4");
    assert(await demo.page.evaluate(() => window.GarmentRuleEngine.Store.loadInput().appearance.skinValue === 4), "颜色输入没有写入规范化字段");
    await choose(demo.page, "body.legRatio", "0");
    assert(await demo.page.evaluate(() => window.GarmentRuleEngine.Store.loadInput().body.legRatio === 0), "身体输入没有写入规范化字段");
    const defaultIllustration = await demo.page.locator(".candidate-card").first().locator(".illustration-svg").innerHTML();
    await choose(demo.page, "face.shape", "long");
    assert(await demo.page.evaluate(() => window.GarmentRuleEngine.Store.loadInput().face.shape === "long"), "脸型输入没有写入规范化字段");
    const faceIllustration = await demo.page.locator(".candidate-card").first().locator(".illustration-svg").innerHTML();
    assert(defaultIllustration !== faceIllustration, "脸型变化没有改变效果图中的领口表现");
    const beforeColor = await demo.page.evaluate(() => window.GarmentRuleEngine.run(window.GarmentRuleEngine.Store.loadInput(), window.GarmentRuleEngine.Store.loadPublished()).candidates.map((candidate) => candidate.palette?.name));
    await choose(demo.page, "appearance.skinTemperature", "0");
    const afterColor = await demo.page.evaluate(() => window.GarmentRuleEngine.run(window.GarmentRuleEngine.Store.loadInput(), window.GarmentRuleEngine.Store.loadPublished()).candidates.map((candidate) => candidate.palette?.name));
    assert(JSON.stringify(beforeColor) !== JSON.stringify(afterColor), "切换外观色温没有改变候选配色");
    assert(await demo.page.locator('.appearance-matrix-wrap button[data-input-path="appearance.skinTemperature"][aria-checked="true"]').getAttribute("data-value") === "0", "行内色温刻度没有同步当前选中状态");
    assert(await demo.page.locator('.appearance-matrix-wrap .range-form-item--inline').first().locator(".range-current").count() === 0, "选中极值时仍重复显示当前语义");
    const beforeGoalIllustrations = await demo.page.locator(".candidate-card .illustration-svg").evaluateAll((elements) => elements.map((element) => element.innerHTML));
    await demo.page.locator('button[data-group="goal-boundaries"]').click();
    await demo.page.locator('select[data-input-path="goal.endpoint"]').selectOption("waist");
    await demo.page.locator('select[data-input-path="goal.direction"]').selectOption("strengthen");
    assert(await demo.page.evaluate(() => window.GarmentRuleEngine.Store.loadInput().goal.endpoint === "waist"), "目标输入没有写入规范化字段");
    const waistIllustrations = await demo.page.locator(".candidate-card .illustration-svg").evaluateAll((elements) => elements.map((element) => element.innerHTML));
    assert(waistIllustrations.some((svg, index) => svg !== beforeGoalIllustrations[index]), "目标变化没有改变效果图中的腰线表现");
    await demo.page.locator('input[data-input-boolean="boundaries.rejectDefinedWaist"]').check({ force: true });
    assert(await demo.page.evaluate(() => window.GarmentRuleEngine.Store.loadInput().boundaries.rejectDefinedWaist === true), "边界输入没有写入规范化字段");
    const boundaryResult = await demo.page.evaluate(() => {
      const input = window.GarmentRuleEngine.Store.loadInput();
      return window.GarmentRuleEngine.run(input, window.GarmentRuleEngine.Store.loadPublished());
    });
    assert(boundaryResult.candidates.every((candidate) => candidate.waist !== "defined"), "拒绝明显收腰没有落实到候选组件");
    await demo.page.locator("#resetInputButton").click();
    await demo.page.locator('button[data-group="context"]').click();

    await demo.page.locator(".detail-button").first().click();
    const detailText = await demo.page.locator("#candidateDetailContent").innerText();
    assert(detailText.includes("简易效果图") && detailText.includes("完整穿着单品") && detailText.includes("怎么验证") && !detailText.includes("undefined"), "方案详情没有消费完整候选契约");
    await demo.page.locator("[data-close-dialog]").click();

    const paletteState = await demo.page.evaluate(() => {
      const result = window.GarmentRuleEngine.run(window.GarmentPrototypeData.defaultInput, window.GarmentRuleEngine.Store.loadPublished());
      return result.candidates.map((candidate) => ({ name: candidate.palette?.name, contrast: candidate.colorContrast, chroma: candidate.colorChroma }));
    });
    assert(new Set(paletteState.map((item) => item.name)).size >= 2, "完整方案没有形成不同配色路线");
    assert(paletteState.every((item) => item.contrast === "中等" && item.chroma === "中等"), "候选配色与分析强度不一致");

    await demo.page.locator('button[data-group="preference"]').click();
    const preferenceLayout = await demo.page.evaluate(() => {
      const stack = document.querySelector(".field-stack-grid--preference");
      return {
        display: getComputedStyle(stack).display,
        direction: getComputedStyle(stack).flexDirection,
        styleButtons: document.querySelectorAll('[data-input-path="preference.style"]').length,
        trendCards: document.querySelectorAll('[data-input-path="preference.trendDirection"].trend-option-card').length
      };
    });
    assert(preferenceLayout.display === "flex" && preferenceLayout.direction === "column", "风格偏好没有改为通栏单列流");
    assert(preferenceLayout.styleButtons >= 5 && preferenceLayout.trendCards >= 4, "风格偏好通栏选项没有完整渲染");
    assert(await demo.page.locator('button[data-input-path="preference.trendDirection"]').count() >= 4, "潮流方向没有读取动态资料库");
    assert(await demo.page.locator('button[data-input-path="preference.trendIntensity"]').count() === 2, "选定潮流后没有表达强度");
    const beforeTrend = await demo.page.locator(".candidate-card h3").allInnerTexts();
    await choose(demo.page, "preference.trendDirection", "utilityLayering");
    await choose(demo.page, "preference.trendIntensity", "clear");
    const afterTrend = await demo.page.locator(".candidate-card h3").allInnerTexts();
    assert(JSON.stringify(beforeTrend) !== JSON.stringify(afterTrend), "切换潮流方向只改变文案，没有改变服装组合");
    assert(afterTrend[0].includes("工装") || afterTrend[0].includes("多口袋"), "轻机能层次没有落实到具体服装");
    assert((await demo.page.locator(".trend-input-summary").innerText()).includes("城市机能") || (await demo.page.locator(".trend-input-summary").innerText()).includes("功能细节"), "潮流输入缺少核心理念摘要");
    assert((await demo.page.locator(".trend-input-summary").innerText()).includes("优先服装路线"), "潮流输入缺少优先服装路线");
    await choose(demo.page, "preference.trendDirection", "none");
    assert(await demo.page.locator('button[data-input-path="preference.trendIntensity"]').count() === 0, "不限定潮流时仍显示表达强度");

    await choose(demo.page, "preference.style", "street");
    assert((await demo.page.locator(".candidate-card").first().innerText()).includes("街头"), "风格方向没有改变服装路线");
    await demo.page.locator('button[data-group="personal"]').click();
    await choose(demo.page, "face.shape", "long");
    assert(await demo.page.evaluate(() => window.GarmentRuleEngine.run(window.GarmentRuleEngine.Store.loadInput(), window.GarmentRuleEngine.Store.loadPublished()).candidates.some((candidate) => candidate.neckline)), "脸型没有进入候选方案契约");
    await demo.page.locator('button[data-group="context"]').click();
    await choose(demo.page, "context.temperatureRange", "24_30");
    const warmText = await demo.page.locator(".candidate-card").first().innerText();
    assert(warmText.includes("短袖") && warmText.includes("无外层"), "温度没有改变袖长与外层");

    const demoNavCenter = await demo.page.locator(".page-nav").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left + rect.width / 2;
    });
    const desktopMetrics = await metrics(demo.page);
    assert(desktopMetrics.scrollWidth <= desktopMetrics.clientWidth + 1, "案例页桌面端横向溢出");
    assert(demo.errors.length === 0, demo.errors.join("\n"));
    await demo.page.screenshot({ path: path.join(outputDir, "garment-v12-case-1440.png"), fullPage: true });
    report.push({ page: "case-1440", metrics: desktopMetrics, illustrations: await demo.page.locator(".outfit-illustration").count(), palettes: paletteState.map((item) => item.name) });

    const rules = await openPage(browser, `${baseUrl}rules.html`, { width: 1440, height: 900 });
    await rules.page.evaluate(() => localStorage.clear());
    await rules.page.reload({ waitUntil: "networkidle" });
    assert(await rules.page.locator("#overviewView").isVisible(), "规则管理没有默认显示规则总览");
    assert(await rules.page.locator("#schemaSummary").count() === 0, "规则管理不应包含多余的字段架构展示区");
    const ruleChecks = await rules.page.evaluate(() => {
      const engine = window.GarmentRuleEngine;
      const data = window.GarmentPrototypeData.defaultRuleSet;
      const tests = engine.runTests(data);
      const broken = engine.clone(data);
      broken.decisionRules[0].conditions[0].field = "input.missingField";
      return {
        tests: tests.length,
        failed: tests.filter((test) => !test.pass).map((test) => test.id),
        catchesDangling: engine.validateRuleSet(broken).errors.some((error) => error.type === "missing_condition_field")
      };
    });
    assert(ruleChecks.tests >= 7 && ruleChecks.failed.length === 0, "规则回归用例存在失败");
    assert(ruleChecks.catchesDangling, "规则校验器没有捕获悬空条件字段");
    assert(!(await rules.page.locator("#configureView").isVisible()), "规则配置与总览仍然同时挤在主工作区");
    assert(await rules.page.locator("#overviewMatrix tbody tr").count() === 10, "规则总览没有展示十类业务关系");
    assert(await rules.page.locator("#overviewMatrix thead tr").count() === 2, "规则总览没有使用两层结果表头");
    assert((await rules.page.locator("#overviewMatrix thead").innerText()).includes("穿着框架") && (await rules.page.locator("#overviewMatrix thead").innerText()).includes("服装样式") && (await rules.page.locator("#overviewMatrix thead").innerText()).includes("颜色搭配"), "规则总览结果大类表头不完整");
    assert(!(await rules.page.locator("#overviewMatrix thead").innerText()).includes("候选处理"), "规则总览仍把候选处理作为横向字段");
    assert(await rules.page.locator("#overviewMatrix .overview-impact-cell.is-strong").count() > 0, "规则总览没有展示直接影响色块");
    const overviewNames = await rules.page.locator("#overviewMatrix tbody .overview-row-label > span").allInnerTexts();
    const expectedOrder = ["近期温度", "使用场合", "外观色彩", "身材情况", "脸型", "风格方向", "正式程度", "潮流方向", "本次调整目标", "拒绝与边界"];
    assert(JSON.stringify(overviewNames) === JSON.stringify(expectedOrder), `规则总览排序不正确：${overviewNames.join("、")}`);
    assert((await rules.page.locator("#overviewMatrix thead").innerText()).includes("层数") && await rules.page.locator('#overviewMatrix tr:has(th span:text-is("近期温度")) .overview-impact-cell.is-strong').count() >= 4, "总览没有展示温度对穿着框架的具体影响");

    const rulesNavCenter = await rules.page.locator(".page-nav").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left + rect.width / 2;
    });
    assert(Math.abs(demoNavCenter - rulesNavCenter) <= 1, "两个页面的顶部导航没有对齐");

    const overviewWidth = await rules.page.locator("#overviewView").evaluate((el) => el.getBoundingClientRect().width);
    const overviewLeft = await rules.page.locator("#overviewView").evaluate((el) => el.getBoundingClientRect().left);

    await rules.page.locator('button[data-overview-target="trend"]').first().click();
    assert(await rules.page.locator("#configureView").isVisible(), "总览关系不能跳转到规则配置");

    const configWidth = await rules.page.locator(".relationship-workspace").evaluate((el) => el.getBoundingClientRect().width);
    const configLeft = await rules.page.locator(".relationship-workspace").evaluate((el) => el.getBoundingClientRect().left);
    assert(Math.abs(overviewWidth - configWidth) <= 1, `总览与配置视图宽度不一致 (${overviewWidth} vs ${configWidth})`);
    assert(Math.abs(overviewLeft - configLeft) <= 1, `总览与配置视图左对齐不一致 (${overviewLeft} vs ${configLeft})`);
    assert((await rules.page.locator("#editorTitle").innerText()) === "潮流方向", "总览没有定位到对应的潮流配置");
    assert(await rules.page.locator('#configTier1Tabs button[data-tier1-id="preference"].is-active').count() === 1, "一级分类未同步为风格偏好");
    assert(await rules.page.locator('#configTier2Chips button[data-tier2-id="trend"].is-active').count() === 1, "二级关系未同步为潮流方向");
    assert(await rules.page.locator("#configTier1Tabs button[data-tier1-id]").count() === 4, "一级分类导航缺少 4 个主分类");
    assert(await rules.page.locator(".relationship-main").count() === 0, "关系配置仍保留重复的关系列表容器");
    assert(await rules.page.locator("#ruleTableBody").count() === 0, "关系配置仍保留业务关系表格");
    assert(!(await rules.page.locator("#configureView").innerText()).includes("业务关系"), "关系配置仍展示业务关系文案");
    assert(await rules.page.locator("[data-branch-select] option").count() === 3, "潮流方向没有作为动态分支管理");
    const trendEditorText = await rules.page.locator("#editorContent").innerText();
    assert(trendEditorText.includes("理念来源") && trendEditorText.includes("会优先使用的服装路线"), "潮流方向配置缺少理念与服装映射");

    await rules.page.locator('#configTier1Tabs button[data-tier1-id="personal"]').click();
    await rules.page.locator('#configTier2Chips button[data-tier2-id="face"]').click();
    assert((await rules.page.locator("#editorTitle").innerText()) === "脸型与领口", "点击二级导航未切换到脸型与领口");

    const faceScope = await rules.page.evaluate(() => ({
      conditions: [...document.querySelectorAll('select[data-edit^="conditions."]')].filter((select) => select.dataset.edit.endsWith(".field")).map((select) => select.selectedOptions[0]?.textContent.trim()),
      actionFields: [...document.querySelectorAll('select[data-edit^="actions."]')].filter((select) => select.dataset.edit.endsWith(".field")).map((select) => select.selectedOptions[0]?.textContent.trim()),
      conditionOptions: [...document.querySelectorAll('select[data-edit^="conditions."] option')].map((item) => item.textContent.trim())
    }));
    assert(faceScope.conditions.length > 0 && faceScope.conditions.every((label) => label === "脸型"), "脸型关系没有锁定脸型条件");
    assert(faceScope.actionFields.every((label) => label === "推荐领口方向" || label === "脸型配合说明"), "脸型关系暴露了无关结果字段");
    assert(!faceScope.conditionOptions.includes("肤色") && !faceScope.conditionOptions.includes("腿身比例（现状）"), "脸型关系仍暴露外观或身材条件字段");

    await rules.page.locator('#configTier1Tabs button[data-tier1-id="context"]').click();
    await rules.page.locator('#configTier2Chips button[data-tier2-id="temperature"]').click();
    assert(await rules.page.locator("[data-branch-select] option").count() === 6, "温度关系没有合并为六个分支");
    assert((await rules.page.locator("#editorContent").innerText()).includes("会改变哪些穿搭内容"), "配置编辑器没有形成输入到结果的闭环");

    await rules.page.locator("#resourceButton").click();
    await rules.page.locator('button[data-resource-tab="trends"]').click();
    assert(await rules.page.locator(".trend-resource-card").count() === 3, "基础资料没有独立的潮流方向库");
    const relaxedName = rules.page.locator('.trend-resource-card input[data-resource-path="name"]').nth(1);
    await relaxedName.fill("松弛精裁");
    await relaxedName.press("Tab");
    await rules.page.locator("[data-close-resource]").click();

    await rules.page.locator("#publishButton").click();
    await rules.page.locator("[data-confirm-ok]").click();
    await rules.page.waitForTimeout(150);
    assert((await rules.page.locator("#ruleSetVersion").innerText()).includes("1.2.1"), "V1.2 规则修改没有成功发布");

    const rulesMetrics = await metrics(rules.page);
    assert(rulesMetrics.scrollWidth <= rulesMetrics.clientWidth + 1, "规则页桌面端横向溢出");
    assert(rules.errors.length === 0, rules.errors.join("\n"));
    await rules.page.screenshot({ path: path.join(outputDir, "garment-v12-config-1440.png"), fullPage: true });
    report.push({ page: "rules-1440", metrics: rulesMetrics, navCenter: rulesNavCenter, rows: overviewNames.length });

    await rules.page.goto(`${baseUrl}index.html`, { waitUntil: "networkidle" });
    await rules.page.locator("#resetInputButton").click();
    await rules.page.locator('button[data-group="preference"]').click();
    const publishedTrendLabels = await rules.page.locator('button[data-input-path="preference.trendDirection"]').allInnerTexts();
    assert(publishedTrendLabels.some((label) => label.includes("松弛精裁")), "潮流方向修改没有同步到案例运行页");
    assert((await rules.page.locator("#ruleVersion").innerText()).includes("1.2.1"), "案例运行页没有同步发布版本");

    const mobile = await openPage(browser, `${baseUrl}index.html`, { width: 390, height: 844 });
    const mobileMetrics = await metrics(mobile.page);
    assert(mobileMetrics.scrollWidth <= mobileMetrics.clientWidth + 1, "案例页移动端横向溢出");
    assert(mobile.errors.length === 0, mobile.errors.join("\n"));
    await mobile.page.screenshot({ path: path.join(outputDir, "garment-v12-case-mobile.png"), fullPage: true });

    const tablet = await openPage(browser, `${baseUrl}index.html`, { width: 991, height: 900 });
    const tabletLayout = await tablet.page.evaluate(() => ({
      inputPosition: getComputedStyle(document.querySelector(".demo-column-input")).position,
      columns: getComputedStyle(document.querySelector(".demo-main")).gridTemplateColumns,
      candidateColumns: getComputedStyle(document.querySelector(".candidate-grid")).gridTemplateColumns
    }));
    assert(tabletLayout.inputPosition === "static" && !tabletLayout.columns.includes("380px"), "平板宽度仍保留桌面双栏输入布局");
    assert(!tabletLayout.candidateColumns.includes(" "), "平板方案卡片没有降级为单列");
    const tabletMetrics = await metrics(tablet.page);
    assert(tabletMetrics.scrollWidth <= tabletMetrics.clientWidth + 1, "平板案例页出现横向溢出");
    assert(tablet.errors.length === 0, tablet.errors.join("\n"));

    const rulesMobile = await openPage(browser, `${baseUrl}rules.html`, { width: 390, height: 844 });
    const rulesMobileMetrics = await metrics(rulesMobile.page);
    assert(rulesMobileMetrics.scrollWidth <= rulesMobileMetrics.clientWidth + 1, "规则页移动端页面级横向溢出");
    const mobileImpactText = await rulesMobile.page.locator("#overviewMobileList").innerText();
    assert(!mobileImpactText.includes("直接影响") && !mobileImpactText.includes("间接影响") && !mobileImpactText.includes("条件影响"), "规则总览移动端仍显示冗余影响等级文字");
    assert(await rulesMobile.page.locator(".mobile-impact-item.is-strong .impact-symbol").count() > 0, "规则总览移动端缺少直接影响符号色块");
    assert(rulesMobile.errors.length === 0, rulesMobile.errors.join("\n"));
    await rulesMobile.page.screenshot({ path: path.join(outputDir, "garment-v12-rules-mobile.png"), fullPage: true });
    report.push({ page: "mobile", caseMetrics: mobileMetrics, rulesMetrics: rulesMobileMetrics });

    console.log(JSON.stringify({ ok: true, report }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
