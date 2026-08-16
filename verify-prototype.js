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
    assert((await demo.page.locator(".module-heading--input").innerText()).replace(/\s+/g, "") === "01本次条件客户确认", "案例页输入模块标题仍存在重复文案");
    assert((await demo.page.locator(".recommendation-heading").innerText()).includes("02 完整方案") && !(await demo.page.locator(".recommendation-heading").innerText()).includes("02 完整穿着方案"), "案例页方案模块标题仍存在重复文案");
    assert(await demo.page.locator('.snapshot-chip').count() === 5, "已选条件快照缺少分类");
    assert(await demo.page.locator('.snapshot-chip').nth(4).isVisible(), "已选条件快照的边界项被遮盖");

    await demo.page.locator('button[data-group="context"]').click();
    assert(await demo.page.locator('button[data-input-set-path="context.environment"]').count() === 3, "环境特征没有显示三个规范选项");
    await demo.page.locator('button[data-input-set-path="context.environment"][data-input-set-value="acTransit"]').click();
    const environmentState = await demo.page.evaluate(() => {
      const input = window.GarmentRuleEngine.Store.loadInput();
      const result = window.GarmentRuleEngine.run(input, window.GarmentRuleEngine.Store.loadPublished());
      return { environment: input.context.environment, modifierRules: result.canonical?.result?.trace?.modifierRules || [] };
    });
    assert(JSON.stringify(environmentState.environment) === JSON.stringify(["acTransit"]), "常规环境没有与强空调环境互斥");
    assert(environmentState.modifierRules.includes("MOD-ENV-AC"), "环境特征没有进入规范修饰规则");
    await demo.page.locator('button[data-input-set-path="context.environment"][data-input-set-value="none"]').click();

    await demo.page.locator('button[data-group="personal"]').click();
    assert(await demo.page.locator('[data-input-path^="appearance.eye"], [data-input-path$="Chroma"], [data-input-path="body.heightPresence"]').count() === 0, "已移除的瞳色、彩度或纵向高度仍出现在案例输入中");
    assert(await demo.page.locator('button[data-input-path="body.boneFrame"]').count() === 3, "骨架量感没有显示三个规范选项");
    assert(await demo.page.locator(".range-step").count() >= 26, "规范连续档位没有渲染为刻度按钮");
    assert(await demo.page.locator(".range-endpoint").count() >= 16, "规范连续档位缺少两端极值标注");
    assert((await demo.page.locator(".range-track").first().innerText()).trim() === "", "连续档位中间刻度不应重复显示长文案");
    const inlineRangeState = await demo.page.evaluate(() => ({
      count: document.querySelectorAll(".appearance-matrix-wrap .range-form-item--inline").length,
      rowHeights: [...document.querySelectorAll(".appearance-matrix-wrap .range-inline-row")].map((item) => item.getBoundingClientRect().height),
      hasLegacyLabel: [...document.querySelectorAll(".appearance-matrix-wrap .range-inline-label")].some((item) => item.textContent.trim() === "冷暖"),
      radioCount: document.querySelectorAll(".appearance-matrix-wrap .range-step[role=radio]").length,
      checkedCount: document.querySelectorAll(".appearance-matrix-wrap .range-step[aria-checked=true]").length
    }));
    assert(inlineRangeState.count === 4, "面部色彩没有按肤色与发色的四个规范字段显示");
    assert(inlineRangeState.rowHeights.every((height) => height <= 36), "外观色彩行内控件仍占用过高的垂直空间");
    assert(!inlineRangeState.hasLegacyLabel, "外观色彩仍显示重复的冷暖字段文案");
    assert(inlineRangeState.radioCount === 14 && inlineRangeState.checkedCount === 4, "面部色彩刻度缺少可访问的单选状态");
    await choose(demo.page, "appearance.skinValue", "deep");
    assert(await demo.page.evaluate(() => window.GarmentRuleEngine.Store.loadInput().appearance.skinValue === "deep"), "颜色输入没有写入规范字段");
    const canonicalBridge = await demo.page.evaluate(() => {
      const input = window.GarmentRuleEngine.Store.loadInput();
      const result = window.GarmentRuleEngine.run(input, window.GarmentRuleEngine.Store.loadPublished());
      return {
        present: Boolean(result.canonical?.result),
        skinValue: result.canonical?.migration?.input?.["appearance.skinValue"],
        canonicalContrast: result.canonical?.result?.color?.contrastMode,
        legacyContrast: result.requirements?.colorContrast,
        applied: result.canonicalOverlay?.applied || [],
        deferred: result.canonicalOverlay?.deferred || [],
        paletteMatch: result.canonicalOverlay?.paletteMatch || null,
        selectedPaletteId: result.requirements?.palettePlanId,
        candidatePaletteIds: result.candidates.map((candidate) => candidate.palette?.id),
        pendingModifiers: result.canonical?.result?.trace?.pendingModifiers || [],
        modifierRules: result.canonical?.result?.trace?.modifierRules || []
      };
    });
    assert(canonicalBridge.present, "统一规则参考引擎未接入案例运行页");
    assert(canonicalBridge.skinValue === "deep", "肤色明度没有直接进入核心契约");
    assert(canonicalBridge.canonicalContrast === "medium" && canonicalBridge.legacyContrast === "中等", "规范配色对比度未覆盖旧候选契约");
    assert(canonicalBridge.applied.includes("color.contrastMode->requirements.colorContrast"), "规范输出适配器未记录配色覆盖来源");
    assert(canonicalBridge.paletteMatch?.matched === true, "Canonical color output did not match a renderable palette plan");
    assert(canonicalBridge.paletteMatch.planId === canonicalBridge.selectedPaletteId, "Legacy palette resolution overwrote the canonical palette match");
    assert(canonicalBridge.candidatePaletteIds.includes(canonicalBridge.selectedPaletteId), "Candidates did not use the canonical palette match");
    assert(!canonicalBridge.deferred.includes("color.distribution/nearFacePalette"), "Completed color mapping is still marked as deferred");
    const canonicalFormBridge = await demo.page.evaluate(() => {
      const result = window.GarmentRuleEngine.run(window.GarmentRuleEngine.Store.loadInput(), window.GarmentRuleEngine.Store.loadPublished());
      return {
        form: result.canonical?.result?.framework?.form,
        bottomTypes: result.candidates.map((candidate) => candidate.bottomType)
      };
    });
    assert(canonicalFormBridge.form === "separatesTrouser", "规范方案形态未进入候选约束");
    assert(canonicalFormBridge.bottomTypes.every((type) => type === "trouser"), "分体裤装仍生成了非裤装候选");
    assert(canonicalBridge.pendingModifiers.length === 0, "已批准修饰规则仍被标记为待审核");
    assert(canonicalBridge.modifierRules.includes("MOD-SKIN-VALUE-DEEP"), "统一规则参考引擎未执行肤色明度修饰");
    await choose(demo.page, "body.legRatio", "longTorso");
    assert(await demo.page.evaluate(() => window.GarmentRuleEngine.Store.loadInput().body.legRatio === "longTorso"), "身体输入没有写入规范字段");
    await choose(demo.page, "body.boneFrame", "large");
    const boneFrameState = await demo.page.evaluate(() => {
      const input = window.GarmentRuleEngine.Store.loadInput();
      const result = window.GarmentRuleEngine.run(input, window.GarmentRuleEngine.Store.loadPublished());
      return {
        value: input.body.boneFrame,
        rules: result.canonical?.result?.trace?.rules || [],
        candidates: result.candidates.length,
        blocked: result.blocked,
        conflicts: result.conflicts,
        requirements: result.requirements
      };
    });
    assert(boneFrameState.value === "large" && boneFrameState.rules.some((ruleId) => /^B\d+/.test(ruleId)), "骨架量感没有进入身体决策矩阵");
    assert(boneFrameState.candidates > 0, `骨架量感组合没有生成候选：${JSON.stringify(boneFrameState)}`);
    const defaultIllustration = await demo.page.locator(".candidate-card").first().locator(".illustration-svg").innerHTML();
    await choose(demo.page, "face.shape", "long");
    assert(await demo.page.evaluate(() => window.GarmentRuleEngine.Store.loadInput().face.shape === "long"), "脸型输入没有写入规范化字段");
    const faceIllustration = await demo.page.locator(".candidate-card").first().locator(".illustration-svg").innerHTML();
    assert(defaultIllustration !== faceIllustration, "脸型变化没有改变效果图中的领口表现");
    const beforeColor = await demo.page.evaluate(() => window.GarmentRuleEngine.run(window.GarmentRuleEngine.Store.loadInput(), window.GarmentRuleEngine.Store.loadPublished()).candidates.map((candidate) => candidate.palette?.name));
    await choose(demo.page, "appearance.skinTone", "cool");
    const afterColor = await demo.page.evaluate(() => window.GarmentRuleEngine.run(window.GarmentRuleEngine.Store.loadInput(), window.GarmentRuleEngine.Store.loadPublished()).candidates.map((candidate) => candidate.palette?.name));
    assert(JSON.stringify(beforeColor) !== JSON.stringify(afterColor), "切换肤色底调没有改变候选配色");
    assert(await demo.page.locator('.appearance-matrix-wrap button[data-input-path="appearance.skinTone"][aria-checked="true"]').getAttribute("data-value") === "cool", "肤色底调刻度没有同步当前选中状态");
    assert(await demo.page.locator('.appearance-matrix-wrap .range-form-item--inline').first().locator(".range-current").count() === 0, "选中极值时仍重复显示当前语义");
    const beforeGoalIllustrations = await demo.page.locator(".candidate-card .illustration-svg").evaluateAll((elements) => elements.map((element) => element.innerHTML));
    await demo.page.locator('button[data-group="goal-boundaries"]').click();
    assert((await demo.page.locator('button[data-group="goal-boundaries"]').innerText()) === "目标边界", "目标边界分类名称未统一");
    assert(await demo.page.locator('button[data-input-path="goal.endpoint"]').count() > 0 && await demo.page.locator('button[data-input-path="goal.direction"]').count() > 0, "调整目标与调整方向没有统一为按钮组");
    assert(await demo.page.locator('input[data-input-boolean^="boundaries."]').count() === 8, "拒绝边界没有完整显示八个规范字段");
    assert(await demo.page.locator('input[data-input-boolean="boundaries.rejectTight"], input[data-input-boolean="boundaries.rejectDeepNeck"]').count() === 2, "新增的紧绷与低领边界缺失");
    await demo.page.locator('button[data-input-path="goal.endpoint"][data-value="waist"]').click();
    await demo.page.locator('button[data-input-path="goal.direction"][data-value="strengthen"]').click();
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
    assert(detailText.includes("简易效果图") && detailText.includes("完整穿着单品") && detailText.includes("方案形态") && detailText.includes("鞋履") && detailText.includes("怎么验证") && !detailText.includes("undefined"), "方案详情没有消费完整候选契约");
    await demo.page.locator("[data-close-dialog]").click();

    const paletteState = await demo.page.evaluate(() => {
      const result = window.GarmentRuleEngine.run(window.GarmentPrototypeData.defaultInput, window.GarmentRuleEngine.Store.loadPublished());
      return result.candidates.map((candidate) => ({ name: candidate.palette?.name, contrast: candidate.colorContrast }));
    });
    assert(new Set(paletteState.map((item) => item.name)).size >= 2, "完整方案没有形成不同配色路线");
    assert(paletteState.every((item) => item.contrast === "中等"), "候选配色与规范对比度不一致");

    await demo.page.locator('button[data-group="preference"]').click();
    const preferenceLayout = await demo.page.evaluate(() => {
      const stack = document.querySelector(".field-stack-grid--preference");
      return {
        display: getComputedStyle(stack).display,
        direction: getComputedStyle(stack).flexDirection,
        styleButtons: document.querySelectorAll('[data-input-path="preference.style"]').length,
        paletteButtons: document.querySelectorAll('[data-input-path="preference.palette"]').length,
        trendButtons: document.querySelectorAll('[data-input-path="preference.trendDirection"]').length,
        styleColumns: getComputedStyle(document.querySelector(".option-scale--choice-flow .pill-segment-control")).gridTemplateColumns.split(" ").length,
        trendColumns: getComputedStyle(document.querySelector('[data-input-path="preference.trendDirection"]').parentElement).gridTemplateColumns.split(" ").length,
        trendDescriptions: document.querySelectorAll('[data-input-path="preference.trendDirection"] small').length
      };
    });
    assert(preferenceLayout.display === "flex" && preferenceLayout.direction === "column", "风格偏好没有改为通栏单列流");
    assert(preferenceLayout.styleButtons === 8 && preferenceLayout.paletteButtons === 4 && preferenceLayout.trendButtons === 4, "风格偏好没有完整渲染规范字段选项");
    assert(preferenceLayout.styleColumns === 4 && preferenceLayout.trendColumns === 4, "风格和潮流选项没有使用统一的四列网格");
    assert(preferenceLayout.trendDescriptions === 0, "潮流方向按钮仍包含输入区说明文案");
    assert(await demo.page.locator('button[data-input-path="preference.trendDirection"]').count() === 4, "潮流方向没有读取规范字段注册表");
    assert(await demo.page.locator('button[data-input-path="preference.trendIntensity"]').count() === 2, "选定潮流后没有表达强度");
    const summaryBeforeTrend = await demo.page.evaluate(() => ({
      snapshotHeight: document.querySelector("#conditionSnapshot").getBoundingClientRect().height,
      tabsTop: document.querySelector("#inputTabs").getBoundingClientRect().top,
      panelHeight: document.querySelector(".demo-column-input").getBoundingClientRect().height
    }));
    const beforeTrend = await demo.page.locator(".candidate-card h3").allInnerTexts();
    await choose(demo.page, "preference.trendDirection", "utilityLayering");
    await choose(demo.page, "preference.trendIntensity", "clear");
    const summaryAfterTrend = await demo.page.evaluate(() => ({
      snapshotHeight: document.querySelector("#conditionSnapshot").getBoundingClientRect().height,
      tabsTop: document.querySelector("#inputTabs").getBoundingClientRect().top,
      panelHeight: document.querySelector(".demo-column-input").getBoundingClientRect().height
    }));
    assert(Math.abs(summaryBeforeTrend.snapshotHeight - summaryAfterTrend.snapshotHeight) <= 1 && Math.abs(summaryBeforeTrend.tabsTop - summaryAfterTrend.tabsTop) <= 1 && Math.abs(summaryBeforeTrend.panelHeight - summaryAfterTrend.panelHeight) <= 1, "已选条件文案变化导致左侧模块高度跳动");
    const afterTrend = await demo.page.locator(".candidate-card h3").allInnerTexts();
    assert(JSON.stringify(beforeTrend) !== JSON.stringify(afterTrend), "切换潮流方向只改变文案，没有改变服装组合");
    assert(afterTrend[0].includes("工装") || afterTrend[0].includes("多口袋"), "轻机能层次没有落实到具体服装");
    assert(await demo.page.locator(".trend-input-summary").count() === 0, "潮流输入仍显示不属于条件选择的说明摘要");
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

    await choose(demo.page, "context.occasion", "social");
    const onePieceUi = await demo.page.evaluate(() => {
      const result = window.GarmentRuleEngine.run(window.GarmentRuleEngine.Store.loadInput(), window.GarmentRuleEngine.Store.loadPublished());
      return {
        canonicalForm: result.canonical?.result?.framework?.form,
        forms: result.candidates.map((candidate) => candidate.form),
        dressIds: result.candidates.map((candidate) => candidate.dressId),
        componentCategories: result.candidates.map((candidate) => candidate.components.map((component) => component.category))
      };
    });
    assert(onePieceUi.canonicalForm === "onePieceDress", "聚会场合没有进入规范一件式轨道");
    assert(onePieceUi.forms.every((form) => form === "onePieceDress") && onePieceUi.dressIds.every(Boolean), "一件式轨道仍由上下装伪装组装");
    assert(onePieceUi.componentCategories.every((categories) => categories.includes("dress") && !categories.includes("top") && !categories.includes("bottom")), "一件式候选仍混入上装或下装组件");
    assert((await demo.page.locator(".candidate-card").first().innerText()).includes("连衣裙"), "一件式候选没有在案例卡片显示真实连衣裙单品");
    assert(await demo.page.locator(".one-piece-component").count() === 3, "一件式候选没有使用专属信息组件");
    assert(await demo.page.locator(".one-piece-component .one-piece-specs span").count() === 18, "一件式组件没有完整展示裙型、领口、腰部、裙摆、袖长和外搭");
    assert(await demo.page.locator(".color-spectrum-trigger").count() >= 3, "方案卡片没有提供近脸颜色容错色谱");
    assert(await demo.page.locator(".wearing-layer.is-required").count() === 3 && await demo.page.locator(".wearing-layer.is-optional").count() === 3, "鞋履与进阶选配没有分层展示");
    assert(await demo.page.locator(".candidate-card .pattern-tag").count() === 3, "候选方案没有显示规范花色状态");
    await demo.page.locator(".detail-button").first().click();
    assert(await demo.page.locator(".dialog-one-piece-spec").count() === 1, "方案详情缺少一件式专属规格");
    assert(await demo.page.locator(".optional-accessory-section").count() === 1, "方案详情没有独立的进阶选配区域");
    await demo.page.locator("[data-close-dialog]").click();

    const canonicalDressMapping = await demo.page.evaluate(() => {
      const input = structuredClone(window.GarmentRuleEngine.Store.loadInput());
      input.body.boneFrame = "medium";
      input.body.legRatio = "longTorso";
      const result = window.GarmentRuleEngine.run(input, window.GarmentRuleEngine.Store.loadPublished());
      const rejectedInput = structuredClone(input);
      rejectedInput.boundaries.rejectSkirt = true;
      const rejected = window.GarmentRuleEngine.run(rejectedInput, window.GarmentRuleEngine.Store.loadPublished());
      return {
        canonicalDressCut: result.canonical?.result?.garment?.dressCut,
        canonicalWaist: result.canonical?.result?.garment?.waistline,
        candidateDressCuts: result.candidates.map((candidate) => candidate.dressCut),
        candidateWaists: result.candidates.map((candidate) => candidate.waist),
        applied: result.canonicalOverlay?.applied || [],
        rejectedForm: rejected.canonical?.result?.framework?.form,
        rejectedCandidateForms: rejected.candidates.map((candidate) => candidate.form)
      };
    });
    assert(Boolean(canonicalDressMapping.canonicalDressCut), "完整身体输入没有生成规范连身裙型");
    assert(canonicalDressMapping.candidateDressCuts.every((cut) => cut === canonicalDressMapping.canonicalDressCut), "规范连身裙型没有约束实际连衣裙单品");
    assert(canonicalDressMapping.candidateWaists.every((waist) => waist === canonicalDressMapping.canonicalWaist), "规范腰线没有约束实际连衣裙单品");
    assert(canonicalDressMapping.applied.includes("garment.dressCut->requirements.canonicalDressCut"), "连身裙型映射没有记录规范来源");
    assert(canonicalDressMapping.rejectedForm === "separatesTrouser" && canonicalDressMapping.rejectedCandidateForms.every((form) => form === "separatesTrouser"), "拒绝裙装没有熔断一件式候选");
    await choose(demo.page, "context.occasion", "commute");

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
      const validation = engine.validateRuleSet(data);
      const broken = engine.clone(data);
      broken.decisionRules[0].conditions[0].field = "input.missingField";
      const constrained = window.GarmentCanonicalRuleEngine.run({
        "boundaries.strictCoverage": true,
        "boundaries.movementFriendly": true,
        "boundaries.sensitiveTexture": true
      });
      const baseInput = engine.clone(window.GarmentPrototypeData.defaultInput);
      const goalInput = engine.clone(baseInput);
      engine.setByPath(goalInput, "goal.endpoint", "vertical");
      engine.setByPath(goalInput, "goal.direction", "strengthen");
      engine.setByPath(goalInput, "goal.layeringPreference", "singleLayer");
      const baseResult = engine.run(baseInput);
      const goalResult = engine.run(goalInput);
      return {
        tests: tests.length,
        failed: tests.filter((test) => !test.pass).map((test) => test.id),
        patterns: (data.patternLibrary || []).map((pattern) => pattern.name),
        validationErrors: validation.errors,
        catchesDangling: engine.validateRuleSet(broken).errors.some((error) => error.type === "missing_condition_field"),
        constraints: constrained.constraints,
        goalLayerCountStable: goalResult.requirements.layerCount === baseResult.requirements.layerCount,
        goalPreferenceRecorded: Boolean(goalResult.decisionRecord?.goalPreferences?.length),
        goalAssessmentRecorded: Boolean(goalResult.candidates[0]?.goalAssessment?.status),
        boundaryActionsRecorded: Boolean(constrained.trace.boundaryActions?.length)
      };
    });
    assert(ruleChecks.tests >= 7 && ruleChecks.failed.length === 0, "规则回归用例存在失败");
    assert(JSON.stringify(ruleChecks.patterns) === JSON.stringify(["海魂条纹", "威尔士亲王格", "千鸟格", "法式波点", "小碎花"]), "五类经典花色字典不完整");
    assert(ruleChecks.validationErrors.length === 0, `当前规则集校验失败：${JSON.stringify(ruleChecks.validationErrors)}`);
    assert(ruleChecks.catchesDangling, "规则校验器没有捕获悬空条件字段");
    assert(JSON.stringify(ruleChecks.constraints) === JSON.stringify({ coverage: "full", contactTexture: "soft", mobility: "required" }), "三项穿着约束没有进入规范规则结果");
    assert(ruleChecks.goalLayerCountStable, "叠穿倾向不应改写气温决定的穿着层数");
    assert(ruleChecks.goalPreferenceRecorded && ruleChecks.goalAssessmentRecorded, "调整目标没有形成软偏好与候选满足度记录");
    assert(ruleChecks.boundaryActionsRecorded, "穿着边界没有生成仲裁记录");
    assert(!(await rules.page.locator("#configureView").isVisible()), "规则配置与总览仍然同时挤在主工作区");
    assert(await rules.page.locator("#overviewMatrix tbody tr").count() === 19, "规则总览没有将目标与边界收敛为两个聚合入口");
    assert(await rules.page.locator('#overviewMatrix [data-overview-toggle="goal"], #overviewMatrix [data-overview-toggle="boundaries"]').count() === 2, "目标与边界缺少展开入口");
    assert(await rules.page.locator("#overviewMatrix thead tr").count() === 2, "规则总览没有使用两层结果表头");
    const overviewHeaderText = await rules.page.locator("#overviewMatrix thead").innerText();
    assert(["穿着框架", "服装样式", "鞋包配饰", "穿着约束", "颜色搭配"].every((label) => overviewHeaderText.includes(label)), "规则总览 21 项规范输出表头不完整");
    assert(!(await rules.page.locator("#overviewMatrix thead").innerText()).includes("候选处理"), "规则总览仍把候选处理作为横向字段");
    assert(await rules.page.locator("#overviewMatrix .overview-impact-cell.is-strong").count() > 0, "规则总览没有展示直接影响色块");
    await rules.page.locator('#overviewMatrix [data-overview-toggle="goal"]').click();
    await rules.page.locator('#overviewMatrix [data-overview-toggle="boundaries"]').click();
    assert(await rules.page.locator("#overviewMatrix tbody tr").count() === 28, "展开后没有恢复 28 个规范输入字段");
    const overviewNames = await rules.page.locator("#overviewMatrix tbody .overview-row-label > span").allInnerTexts();
    const expectedOrder = await rules.page.evaluate(() => window.GarmentCanonicalData.fieldRegistry.inputs.map((field) => field.label));
    assert(JSON.stringify(overviewNames) === JSON.stringify(expectedOrder), `规则总览排序不正确：${overviewNames.join("、")}`);
    assert(["环境特征", "骨架量感", "色系偏好", "拒绝紧绷贴身", "拒绝低领开阔"].every((label) => overviewNames.includes(label)), "规则总览缺少新增规范字段");
    assert(["瞳色色调", "瞳色明度", "瞳色彩度", "纵向高度"].every((label) => !overviewNames.includes(label)), "规则总览仍展示已退出契约的旧字段");
    assert(overviewHeaderText.includes("层数") && await rules.page.locator('#overviewMatrix tr:has(th span:text-is("近期气温范围")) .overview-impact-cell.is-strong').count() >= 4, "总览没有展示温度对穿着框架的具体影响");
    const temperatureFootwearImpact = rules.page.locator('#overviewMatrix tr:has(th span:text-is("近期气温范围")) button[data-overview-output="accessories.footwear"]');
    await temperatureFootwearImpact.click();
    assert(await rules.page.locator('#configTier2Chips button[data-tier2-id="scenarioJoint"].is-active').count() === 1, "气温与鞋履的组合影响没有定位到场景联合规则");
    await rules.page.locator('button[data-rules-mode="overview"]').click();
    const coverageImpact = rules.page.locator('#overviewMatrix tr:has(th span:text-is("要求完整覆盖")) button[data-overview-output="constraints.coverage"]');
    assert(await coverageImpact.count() === 1, "总览缺少完整覆盖到覆盖要求的精确因果入口");
    await coverageImpact.click();
    assert(await rules.page.locator('#configTier2Chips button[data-tier2-id="boundaries"].is-active').count() === 1, "总览精确入口没有定位到拒绝边界");
    assert((await rules.page.locator('.scope-pill.is-overview-focus').innerText()) === "覆盖要求", "总览精确入口没有高亮对应输出字段");
    await rules.page.locator('button[data-rules-mode="overview"]').click();

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
    await rules.page.locator('[data-config-rule-mode="atomic"]').click();
    await rules.page.locator('#configTier1Tabs button[data-tier1-id="preference"]').click();
    await rules.page.locator('#configTier2Chips button[data-tier2-id="trend"]').click();
    assert(await rules.page.locator('#configTier1Tabs button[data-tier1-id="preference"].is-active').count() === 1, "一级分类未同步为风格偏好");
    assert(await rules.page.locator('#configTier2Chips button[data-tier2-id="trend"].is-active').count() === 1, "二级关系未同步为潮流方向");
    assert(await rules.page.locator("#configTier1Tabs button[data-tier1-id]").count() === 4, "一级分类导航缺少 4 个主分类");
    assert(await rules.page.locator('#configTier2Chips button[data-tier2-id="palette"]').count() === 1, "色系偏好没有作为独立二级关系");
    assert(await rules.page.locator(".relationship-main").count() === 0, "关系配置仍保留重复的关系列表容器");
    assert(await rules.page.locator("#ruleTableBody").count() === 0, "关系配置仍保留业务关系表格");
    assert((await rules.page.locator("#configTier3Label").innerText()) === "输入项", "单项规则没有显示具体输入项层级");
    assert(await rules.page.locator("#configTier3Chips button[data-canonical-group-id]").count() === 2, "潮流方向缺少方向与表达强度输入项");
    assert(!(await rules.page.locator("#configTier4Row").isHidden()), "潮流方向的第四层具体分支未显示");
    assert(await rules.page.locator("#configTier4Chips button[data-canonical-branch-key]").count() === 3, "潮流方向没有展示三个单条件分支");
    const trendEditorText = await rules.page.locator("#editorContent").innerText();
    assert(["输入项影响输出", "当前取值输出", "满足条件", "输出结果", "配置依据"].every((label) => trendEditorText.includes(label)), "潮流方向没有使用统一单项规则结构");
    assert(!/MOD-|utilityLayering|relaxedTailoring|sheerLayering/.test(trendEditorText), "潮流方向配置暴露了内部规则编号或英文枚举");

    await rules.page.locator('#configTier1Tabs button[data-tier1-id="personal"]').click();
    await rules.page.locator('[data-config-rule-mode="joint"]').click();
    await rules.page.locator('#configTier2Chips button[data-tier2-id="color"]').click();
    assert((await rules.page.locator("#configTier3Label").innerText()) === "协同关系", "面部色彩联合规则没有进入协同矩阵模式");
    const colorGroupLabels = await rules.page.locator("#configTier3Chips button[data-canonical-group-id] span:last-of-type").allInnerTexts();
    assert(JSON.stringify(colorGroupLabels) === JSON.stringify(["肤色底调 × 发色深浅"]), `面部色彩协同关系不正确：${JSON.stringify(colorGroupLabels)}`);
    assert(await rules.page.locator("#configTier4Chips button[data-canonical-branch-key]").count() === 15, "面部色彩联合规则没有展示15个组合分支");
    const personalSkinText = await rules.page.locator("#editorContent").innerText();
    assert(personalSkinText.includes("协同关系影响输出") && personalSkinText.includes("当前矩阵行输出") && personalSkinText.includes("协同裁决配置"), "个人特征没有使用统一的协同矩阵结构");
    assert(personalSkinText.includes("全身对比度") && personalSkinText.includes("近脸安全色") && personalSkinText.includes("60-30-10配比"), "面部色彩没有展示从联合输入到颜色输出的完整链路");
    assert(await rules.page.locator(".canonical-personal-branch-selector").count() === 0, "具体分支仍重复出现在规则编辑器内部");
    assert(await rules.page.locator(".canonical-structured-value").count() === 2 && await rules.page.locator("[data-canonical-matrix-field]").count() === 4, "近脸颜色或60-30-10配色仍不可完整配置");
    assert(!personalSkinText.includes("模块影响输出") && !personalSkinText.includes("模块条件范围") && !personalSkinText.includes("推导配置"), "个人特征仍保留专用模块标题");
    const preferredColorInput = rules.page.locator('[data-canonical-structured-field="color.nearFacePalette"][data-canonical-structured-key="preferred"]');
    await preferredColorInput.fill("海军蓝、雾蓝");
    await preferredColorInput.press("Tab");
    assert((await rules.page.locator(".branch-output-submodule").innerText()).includes("海军蓝、雾蓝"), "修改近脸首选色后当前分支摘要没有同步");

    await rules.page.locator('#configTier2Chips button[data-tier2-id="body"]').click();
    const bodyGroupLabels = await rules.page.locator("#configTier3Chips button[data-canonical-group-id] span:last-of-type").allInnerTexts();
    assert(JSON.stringify(bodyGroupLabels) === JSON.stringify(["横向轮廓 × 腿身分布 × 骨架量感"]), "体型比例协同矩阵仍混入单项规则");
    assert(await rules.page.locator("#configTier4Chips button[data-canonical-branch-key]").count() === 27, "身体联合规则没有展示27个组合分支");
    assert((await rules.page.locator(".branch-output-submodule").innerText()).includes("下装版型"), "腿身分布没有展示对应规范输出结果");
    await rules.page.locator('[data-config-rule-mode="atomic"]').click();
    await rules.page.locator('#configTier2Chips button[data-tier2-id="body"]').click();
    const atomicBodyGroups = await rules.page.locator("#configTier3Chips button[data-canonical-group-id] span:last-of-type").allInnerTexts();
    assert(JSON.stringify(atomicBodyGroups) === JSON.stringify(["横向轮廓", "腿身分布", "骨架量感", "腰线特征"]), "体型比例单项入口没有按四个独立输入字段拆分");
    await rules.page.locator('#configTier3Chips button[data-canonical-group-id="waist"]').click();
    assert(await rules.page.locator("#configTier4Chips button[data-canonical-branch-key]").count() === 3, "腰线特征没有展示三个单条件分支");

    await rules.page.locator('#configTier2Chips button[data-tier2-id="face"]').click();
    assert((await rules.page.locator("#editorTitle").innerText()) === "脸型特征", "点击二级导航未切换到脸型特征");
    assert((await rules.page.locator("#configTier3Label").innerText()) === "输入项", "脸型单项规则没有显示输入项层级");
    assert(await rules.page.locator('#configTier3Chips button[data-canonical-group-id="face"]').count() === 1, "脸型输入项入口不唯一");
    assert(await rules.page.locator("#configTier4Chips button[data-canonical-branch-key]").count() === 6, "脸型没有展开六个规范输入取值");
    assert(!(await rules.page.locator("#configTier4Row").isHidden()), "脸型输入取值层没有显示");
    assert((await rules.page.locator(".canonical-when-statement").innerText()).includes("脸型轮廓"), "脸型关系没有锁定脸型条件");
    assert(await rules.page.locator(".rule-clause--when input, .rule-clause--when select").count() === 0, "分支入口条件仍可在配置区修改");
    assert((await rules.page.locator(".branch-output-submodule").innerText()).includes("领口方向"), "脸型关系没有展示规范领口输出");
    assert(await rules.page.locator("#editorContent").innerText().then((text) => !text.includes("配置内容")), "编辑区仍保留重复的配置内容切换器");
    assert(await rules.page.locator(".rule-summary-module").count() === 1 && await rules.page.locator(".rule-config-module").count() === 1, "规则页没有拆分关系结果与配置模块");
    assert(await rules.page.locator(".rule-summary-submodule").count() === 2, "关系结果没有形成两个清晰的主模块");
    assert(await rules.page.locator("#editorKicker, #editorSummary").count() === 0, "规则配置页仍保留重复的关系说明文案");
    assert(await rules.page.locator(".advanced-details").count() === 0 && !(await rules.page.locator("#editorContent").innerText()).includes("高级系统编号"), "规则配置页仍展示高级系统编号");
    assert(await rules.page.locator(".natural-rule-card").count() === 1, "WHEN / THEN / WHY 没有形成统一配置工作台");

    await rules.page.locator('#configTier1Tabs button[data-tier1-id="context"]').click();
    await rules.page.locator('#configTier2Chips button[data-tier2-id="temperature"]').click();
    assert((await rules.page.locator("#configTier3Label").innerText()) === "输入项", "场景条件没有显示输入项层级");
    assert(await rules.page.locator("#configTier3Chips button[data-canonical-group-id]").count() === 1, "近期气温没有形成唯一输入项入口");
    assert(await rules.page.locator("#configTier4Chips button[data-canonical-branch-key]").count() === 6, "近期气温没有收敛为6个单条件取值");
    const tier4Labels = await rules.page.locator("#configTier4Chips button[data-canonical-branch-key]").allInnerTexts();
    assert(tier4Labels.every((label) => !/层数|袖长|外层|覆盖|厚薄|场合/.test(label)), "温度输入取值入口混入了场合或具体推荐结果");
    assert((await rules.page.locator("#editorContent").innerText()).includes("输出结果"), "配置编辑器没有形成输入到结果的闭环");
    assert((await rules.page.locator("#editorContent").innerText()).includes("当前取值输出"), "当前输入取值没有展示输出模块");
    await rules.page.locator('[data-canonical-matrix-value="framework.layerCount"]').selectOption("2");

    await rules.page.locator('[data-config-rule-mode="joint"]').click();
    await rules.page.locator('#configTier2Chips button[data-tier2-id="scenarioJoint"]').click();
    assert((await rules.page.locator("#configTier3Label").innerText()) === "协同关系", "场景联合规则没有进入协同矩阵模式");
    assert(await rules.page.locator("#configTier4Chips button[data-canonical-branch-key]").count() === 30, "场景联合规则没有展示30个气温与场合组合分支");
    await rules.page.locator('#configTier4Chips button[data-canonical-branch-key="matrix:scenario:S01"]').click();
    const coldSynopsis = await rules.page.locator(".branch-output-submodule").innerText();
    assert(coldSynopsis.includes("5-12°C") && coldSynopsis.includes("穿着层数") && coldSynopsis.includes("2层") && coldSynopsis.includes("长袖") && coldSynopsis.includes("保暖外层"), "单条件温度修改没有同步到联合场景分支");
    assert(!/\blong\b|\bnone\b|\bwarm\b|\bfull\b/.test(coldSynopsis), "规则结果仍暴露内部英文枚举值");
    assert(await rules.page.locator('[data-canonical-matrix-field]').count() >= 6, "场景分支的影响内容仍不可配置");
    assert(await rules.page.locator('[data-canonical-matrix-value="framework.layerCount"]').count() === 1, "场景分支的具体输出值仍不可配置");
    await rules.page.locator('[data-canonical-matrix-value="framework.layerCount"]').selectOption("2");
    assert((await rules.page.locator(".branch-output-submodule").innerText()).includes("2层"), "修改具体输出后当前分支摘要没有同步刷新");
    assert(await rules.page.locator(".action-type-details").count() === 0, "统一规则编辑器仍显示重复的作用方式控件");
    await rules.page.locator('[data-config-rule-mode="atomic"]').click();
    await rules.page.locator('#configTier2Chips button[data-tier2-id="environment"]').click();
    assert(await rules.page.locator("#configTier4Chips button[data-canonical-branch-key]").count() === 2, "环境特征没有作为独立关系展示两个修饰取值");
    assert((await rules.page.locator("#editorContent").innerText()).includes("环境特征"), "环境特征分支没有形成独立配置内容");
    await rules.page.locator('[data-config-rule-mode="joint"]').click();
    await rules.page.locator('#configTier2Chips button[data-tier2-id="scenarioJoint"]').click();
    await rules.page.locator('#configTier4Chips button[data-canonical-branch-key="matrix:scenario:S01"]').click();

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
    await rules.page.locator('button[data-group="personal"]').click();
    await choose(rules.page, "appearance.skinTone", "cool");
    await choose(rules.page, "appearance.hairDepth", "dark");
    const publishedNearFaceColors = await rules.page.evaluate(() => {
      const input = window.GarmentRuleEngine.Store.loadInput();
      return window.GarmentCanonicalRuleEngine.run(window.GarmentCanonicalInputAdapter.normalizeLegacyInput(input).input).color.nearFacePalette.preferred;
    });
    assert(JSON.stringify(publishedNearFaceColors) === JSON.stringify(["海军蓝", "雾蓝"]), "个人色彩规则发布后案例运行没有读取修改后的近脸首选色");
    await rules.page.locator('button[data-group="context"]').click();
    await choose(rules.page, "context.temperatureRange", "05_12");
    await choose(rules.page, "context.occasion", "formal");
    const publishedCanonicalLayer = await rules.page.evaluate(() => {
      const input = window.GarmentRuleEngine.Store.loadInput();
      return window.GarmentCanonicalRuleEngine.run(window.GarmentCanonicalInputAdapter.normalizeLegacyInput(input).input).framework.layerCount;
    });
    assert(publishedCanonicalLayer === 2, "统一规则发布后案例运行仍未读取修改后的场景输出");
    assert((await rules.page.locator(".candidate-card").first().innerText()).includes("2层"), "统一规则修改没有落实到可见穿着方案");

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

    const standalone = await openPage(browser, `${baseUrl}garment-recommendation-standalone.html`, { width: 1440, height: 900 });
    const standaloneBridge = await standalone.page.evaluate(() => {
      const result = window.GarmentRuleEngine.run(window.GarmentRuleEngine.Store.loadInput(), window.GarmentRuleEngine.Store.loadPublished());
      return {
        candidates: result.candidates.length,
        canonical: Boolean(result.canonical?.result),
        paletteMatched: result.canonicalOverlay?.paletteMatch?.matched === true
      };
    });
    assert(standaloneBridge.candidates === 3, "Standalone build did not render three candidates");
    assert(standaloneBridge.canonical, "Standalone build is missing the canonical rule bridge");
    assert(standaloneBridge.paletteMatched, "Standalone build is missing canonical palette matching");
    assert(standalone.errors.length === 0, standalone.errors.join("\n"));
    report.push({ page: "standalone-1440", bridge: standaloneBridge });

    console.log(JSON.stringify({ ok: true, report }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
