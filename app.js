(function () {
  "use strict";

  const DATA = window.GarmentPrototypeData;
  const Engine = window.GarmentRuleEngine;
  const V3Adapter = window.GarmentV3PrototypeAdapter;
  const CANONICAL_INPUTS = window.GarmentCanonicalData?.fieldRegistry?.inputs || [];
  const PREVIEW_HAIR_STYLE_KEY = "garment-preview-hair-style";
  const ENGINE_MODE_KEY = "garment-engine-mode";
  const ENGINE_MODES = new Set(["v2", "v3"]);
  const PREVIEW_HAIR_STYLES = new Set(["short", "medium", "long"]);

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const state = {
    input: Engine.clone(Engine.Store.loadInput()),
    activeTab: "context",
    selectedCandidateIndex: null,
    highlightRuleId: null,
    hoveredField: null,
    viewMode: "cards", // 'cards' | 'table'
    previewHairStyle: PREVIEW_HAIR_STYLES.has(localStorage.getItem(PREVIEW_HAIR_STYLE_KEY)) ? localStorage.getItem(PREVIEW_HAIR_STYLE_KEY) : "short",
    engineMode: ENGINE_MODES.has(localStorage.getItem(ENGINE_MODE_KEY)) ? localStorage.getItem(ENGINE_MODE_KEY) : "v3",
    ruleSet: Engine.Store.loadPublished()
  };

  const tabs = [
    { id: "context", label: "场景条件" },
    { id: "personal", label: "个人特征" },
    { id: "preference", label: "风格偏好" },
    { id: "goal-boundaries", label: "目标边界" }
  ];

  const scaleLabels = {
    contrast: ["低", "中等", "高"],
    chroma: ["低", "中等", "高"],
    hue: ["冷", "中间偏冷", "中间", "中间偏暖", "暖"]
  };

  const zhDict = {
    "05_12": "5-12°C", "10_18": "10-18°C", "15_25": "15-25°C", "18_24": "18-24°C", "24_30": "24-30°C", "28_35": "28-35°C",
    "commute": "通勤", "daily": "日常", "formal": "正式", "social": "聚会", "travel": "出游",
    "minimal": "极简", "urban": "都市", "elegant": "优雅", "casual": "休闲", "street": "街头", "retro": "复古", "cityboy": "Cityboy", "unknown": "未限定",
    "utilityLayering": "轻机能层次", "relaxedTailoring": "松弛剪裁", "sheerLayering": "轻透叠穿", "none": "不限定", "light": "少量借鉴", "clear": "明确体现",
    "long": "长脸", "round": "圆脸", "square": "方脸", "standard": "标准脸", "heart": "心形脸", "diamond": "菱形脸",
    "straight": "连续直线", "tailored": "利落结构", "soft": "柔和过渡", "relaxed": "自然留量",
    "none": "无外层", "light": "可脱轻外层", "warm": "保暖外层",
    "short": "短袖", "threeQuarter": "七分袖", "long": "长袖",
    "regular": "适中覆盖", "smooth": "避免粗糙", "full": "完整覆盖",
    "natural": "自然腰位", "raised": "偏高腰位", "defined": "明确腰线",
    "balanced": "自然线条", "continuous": "纵向连贯", "sectioned": "分段层次",
    "trouser": "裤装", "skirt": "裙装", "short": "短裤",
    "vertical": "整体修长感", "waist": "腰线表现", "volume": "肩胯轮廓关系", "contrast": "配色对比",
    "keep": "保留", "strengthen": "强化", "weaken": "弱化", "balance": "平衡",
    "true": "是", "false": "否", true: "是", false: "否"
  };

  function translateValue(val) {
    if (val === undefined || val === null) return "";
    if (zhDict[val] !== undefined) return zhDict[val];
    if (typeof val === "string") {
      const clean = val.replace(/\s*label$/i, "").trim();
      if (zhDict[clean] !== undefined) return zhDict[clean];
    }
    return String(val);
  }

  function canonicalParameter(id, options = {}) {
    const field = CANONICAL_INPUTS.find((item) => item.id === id);
    if (!field) return null;
    const values = (field.options || []).map(([value, label]) => ({ value, label }));
    if (options.allowUnset && !field.required) values.unshift({ value: "", label: "未设置" });
    return {
      id: field.id,
      name: field.label,
      type: options.scale ? "scale" : field.kind === "set" ? "set" : "select",
      required: Boolean(field.required),
      selection: field.selection,
      exclusive: field.exclusive || [],
      options: values
    };
  }

  function canonicalValueLabel(id, value, fallback = "未设置") {
    const field = CANONICAL_INPUTS.find((item) => item.id === id);
    if (Array.isArray(value)) {
      const labels = value.map((item) => field?.options?.find(([optionValue]) => String(optionValue) === String(item))?.[1] || item);
      return labels.length ? labels.join("、") : fallback;
    }
    return field?.options?.find(([optionValue]) => String(optionValue) === String(value))?.[1] || fallback;
  }

  function candidateResult(candidate) {
    return candidate?.output || candidate?.canonicalOutput || {};
  }

  queueMicrotask(init);

  function init() {
    bindEvents();
    renderAll();
  }

  function bindEvents() {
    $("#inputTabs").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-group]");
      if (!button) return;
      state.activeTab = button.dataset.group;
      renderInputTabs();
      renderInputs();
    });

    $("#conditionSnapshot").addEventListener("click", (event) => {
      const chip = event.target.closest("button[data-jump-group]");
      if (!chip) return;
      state.activeTab = chip.dataset.jumpGroup;
      renderInputTabs();
      renderInputs();
    });

    $("#inputContent").addEventListener("click", handleInputClick);
    $("#inputContent").addEventListener("change", handleInputChange);

    $("#viewModeBar").addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-view-mode]");
      if (!btn) return;
      state.viewMode = btn.dataset.viewMode;
      renderViewModeBar();
      renderCandidates();
    });

    $("#hairStyleBar").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-hair-style]");
      if (!button || !PREVIEW_HAIR_STYLES.has(button.dataset.hairStyle)) return;
      state.previewHairStyle = button.dataset.hairStyle;
      localStorage.setItem(PREVIEW_HAIR_STYLE_KEY, state.previewHairStyle);
      renderHairStyleBar();
      renderCandidates(state.lastResult);
      triggerRefreshTransition();
    });

    $("#engineModeBar").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-engine-mode]");
      if (!button || !ENGINE_MODES.has(button.dataset.engineMode)) return;
      state.engineMode = button.dataset.engineMode;
      localStorage.setItem(ENGINE_MODE_KEY, state.engineMode);
      state.selectedCandidateIndex = null;
      renderAll();
      toast(state.engineMode === "v3" ? "已切换至效果等价方案" : "已切换至旧版回退方案");
    });

    const resetBtn = $("#resetInputButton") || $("#resetButton");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        state.input = Engine.clone(Engine.normalizeInput(DATA.defaultInput));
        Engine.Store.saveInput(state.input);
        state.selectedCandidateIndex = null;
        state.highlightRuleId = null;
        renderAll();
        toast("已恢复默认输入条件");
      });
    }

    $("#candidateGrid").addEventListener("click", (event) => {
      const detailButton = event.target.closest("button[data-candidate-index]");
      if (detailButton) {
        openCandidate(Number(detailButton.dataset.candidateIndex));
        return;
      }
      const card = event.target.closest(".candidate-card");
      if (card && card.dataset.index !== undefined) {
        const idx = Number(card.dataset.index);
        state.selectedCandidateIndex = state.selectedCandidateIndex === idx ? null : idx;
        renderCandidateHighlights();
      }
    });

    $("#candidateTableView").addEventListener("click", (event) => {
      const detailBtn = event.target.closest("button[data-candidate-index]");
      if (detailBtn) {
        openCandidate(Number(detailBtn.dataset.candidateIndex));
      }
    });

    $("[data-close-dialog]").addEventListener("click", () => $("#candidateDialog").close());
    $("#candidateDialog").addEventListener("click", (event) => {
      if (event.target === $("#candidateDialog")) $("#candidateDialog").close();
    });

    window.addEventListener("storage", (event) => {
      if (event.key === Engine.Store.keys.published) {
        state.ruleSet = Engine.Store.loadPublished();
        renderAll();
        toast("已同步最新发布的规则");
      }
    });
  }

  function renderAll(animate = true) {
    state.ruleSet = Engine.Store.loadPublished();
    const result = state.engineMode === "v3"
      ? V3Adapter?.run(state.input, state.ruleSet) || { candidates: [], conflicts: [{ reason: "效果等价运行包未加载" }], blocked: [] }
      : Engine.run(state.input, state.ruleSet);
    state.lastResult = result;

    renderVersionChip();
    renderEngineModeBar();
    renderConditionSnapshot();
    renderInputTabs();
    renderInputs();
    renderHairStyleBar();
    renderViewModeBar();
    renderCandidates(result);

    if (animate) {
      triggerRefreshTransition();
    }
  }

  function triggerRefreshTransition() {
    const targets = [
      $("#candidateGrid"),
      $("#candidateTableView"),
      $(".candidate-mobile-compare")
    ];
    targets.forEach((el) => {
      if (!el) return;
      el.classList.remove("is-updating");
      void el.offsetWidth;
      el.classList.add("is-updating");
    });
  }

  function renderVersionChip() {
    $("#ruleVersion").textContent = state.engineMode === "v3" ? "规则 3.0 试算" : `规则 ${state.ruleSet.meta?.version || "1.2.0"}`;
  }

  function renderEngineModeBar() {
    $("#engineModeBar").querySelectorAll("button[data-engine-mode]").forEach((button) => {
      const active = button.dataset.engineMode === state.engineMode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-checked", String(active));
    });
  }

  function renderConditionSnapshot() {
    const p = state.input.preference || {};
    const c = state.input.context || {};
    const b = state.input.boundaries || {};
    const g = state.input.goal || {};
    const a = state.input.appearance || {};
    const body = state.input.body || {};
    const face = state.input.face || {};

    const tempLabel = c.temperatureRange ? `${c.temperatureRange.replace("_", "-")}°C` : "适中气温";
    const occasionLabel = canonicalValueLabel("context.occasion", c.occasion, "待确认");
    const environmentLabel = (c.environment || []).includes("none") ? "" : canonicalValueLabel("context.environment", c.environment, "");
    const skinToneLabel = canonicalValueLabel("appearance.skinTone", a.skinTone, "未确认底色");
    const bodyPropLabel = canonicalValueLabel("body.legRatio", body.legRatio, "比例未确认");
    const faceLabel = canonicalValueLabel("face.shape", face.shape, "脸型未确认");
    const styleLabel = canonicalValueLabel("preference.style", p.style, "未限定");
    const formalityLabel = canonicalValueLabel("preference.formality", p.formality, "未限定");
    const paletteLabel = canonicalValueLabel("preference.palette", p.palette, "不限定");
    const thermalBiasLabel = canonicalValueLabel("preference.thermalBias", p.thermalBias, "标准体感");
    const trendLabel = p.trendDirection && p.trendDirection !== "none" ? trendDirectionName(p.trendDirection) : "经典稳妥";
    const layeringLabel = canonicalValueLabel("goal.layeringPreference", g.layeringPreference, "不限定");
    const goalLabel = g.endpoint ? `${canonicalValueLabel("goal.endpoint", g.endpoint)}·${canonicalValueLabel("goal.direction", g.direction, "保持")} · ${layeringLabel}` : `暂不调整 · ${layeringLabel}`;
    const boundaryList = [];
    if (b.rejectSkirt) boundaryList.push("拒裙");
    if (b.rejectTight) boundaryList.push("拒紧绷");
    if (b.rejectDefinedWaist) boundaryList.push("拒收腰");
    if (b.rejectDeepNeck) boundaryList.push("拒低领");
    if (b.rejectHighContrast) boundaryList.push("拒高对比");
    if (b.strictCoverage) boundaryList.push("严覆盖");
    if (b.movementFriendly) boundaryList.push("易活动");
    if (b.sensitiveTexture) boundaryList.push("亲肤");
    const boundaryLabel = boundaryList.length ? boundaryList.slice(0, 2).join("·") + (boundaryList.length > 2 ? `等${boundaryList.length}项` : "") : "无边界";
    const fullSummary = [
      `场景：${tempLabel} · ${occasionLabel}${environmentLabel ? ` · ${environmentLabel}` : ""}`,
      `色彩：${skinToneLabel} · ${canonicalValueLabel("appearance.skinValue", a.skinValue, "明度未确认")} · ${canonicalValueLabel("appearance.hairTone", a.hairTone, "发色色调未确认")} · ${canonicalValueLabel("appearance.hairDepth", a.hairDepth, "发色深浅未确认")}`,
      `身材：${bodyPropLabel} · ${canonicalValueLabel("body.waistDefinition", body.waistDefinition, "腰线未确认")} · ${canonicalValueLabel("body.shoulderHipBalance", body.shoulderHipBalance, "横向轮廓未确认")} · ${canonicalValueLabel("body.boneFrame", body.boneFrame, "骨架量感未确认")}`,
      `脸型：${faceLabel}`,
      `偏好：${styleLabel} · ${formalityLabel} · ${paletteLabel} · ${thermalBiasLabel} · ${trendLabel}`,
      `目标：${goalLabel}`,
      `边界：${boundaryList.length ? boundaryList.join("、") : "无"}`
    ].join("；");

    $("#conditionSnapshot").innerHTML = `
      <div class="snapshot-inner">
        <span class="snapshot-label">已选条件</span>
        <div class="snapshot-badges">
          <button type="button" class="snapshot-chip" data-jump-group="context" title="场景条件：气温、场合与环境">场景: ${escapeHtml([tempLabel, occasionLabel, environmentLabel].filter(Boolean).join(" · "))}</button>
          <button type="button" class="snapshot-chip" data-jump-group="personal" title="${escapeHtml(fullSummary)}">特征: ${escapeHtml(skinToneLabel)} · ${escapeHtml(bodyPropLabel)} · ${escapeHtml(faceLabel)}</button>
          <button type="button" class="snapshot-chip" data-jump-group="preference" title="${escapeHtml(fullSummary)}">偏好: ${escapeHtml(styleLabel)} · ${escapeHtml(paletteLabel)} · ${escapeHtml(thermalBiasLabel)} · ${escapeHtml(trendLabel)}</button>
          <button type="button" class="snapshot-chip" data-jump-group="goal-boundaries" title="${escapeHtml(fullSummary)}">目标: ${escapeHtml(goalLabel)}</button>
          <button type="button" class="snapshot-chip ${boundaryList.length ? "is-active" : ""}" data-jump-group="goal-boundaries" title="${escapeHtml(fullSummary)}">边界: ${escapeHtml(boundaryLabel)}</button>
        </div>
      </div>
    `;
  }

  function renderInputTabs() {
    $("#inputTabs").innerHTML = tabs.map((tab) => {
      const isActive = tab.id === state.activeTab;
      return `<button type="button" data-group="${tab.id}" class="${isActive ? "is-active" : ""}"><span>${tab.label}</span></button>`;
    }).join("");
  }

  function renderInputs() {
    const group = state.activeTab;
    const content = $("#inputContent");

    if (group === "context") {
      const temperature = canonicalParameter("context.temperatureRange");
      const occasion = canonicalParameter("context.occasion");
      const environment = canonicalParameter("context.environment");
      content.innerHTML = `<div class="input-form-compact">
        ${renderParameterScale("context.temperatureRange", "近期气温范围", temperature)}
        ${renderParameterScale("context.occasion", "使用场合要求", occasion)}
        ${renderSetScale("context.environment", "环境特征", environment)}
      </div>`;
    } else if (group === "personal") {
      const appearanceFields = [
        ["肤色", [["appearance.skinTone", "肤色底调"], ["appearance.skinValue", "肤色明度"]]],
        ["发色", [["appearance.hairTone", "发色色调"], ["appearance.hairDepth", "发色深浅"]]]
      ];
      content.innerHTML = `
        <div class="input-section">
          <div class="input-section-heading"><strong>面部色彩</strong><span>肤色底调与发色深浅构成配色判断基础</span></div>
          <div class="appearance-matrix-wrap">${appearanceFields.map(([label, fields]) => `
            <div class="appearance-row-card">
              <div class="appearance-row-title"><strong>${label}</strong><span>用户确认的外观事实</span></div>
              <div class="appearance-row-scales">
                ${fields.map(([path, labelText]) => renderParameterScale(path, labelText, canonicalParameter(path, { scale: true }), "inline-range")).join("")}
              </div>
            </div>`).join("")}</div>
        </div>
        <div class="input-section">
          <div class="input-section-heading"><strong>身体轮廓与比例</strong><span>腿身分布、腰线、肩胯与骨架量感分别描述</span></div>
          <div class="field-stack-grid field-stack-grid--ranges">
            ${renderParameterScale("body.legRatio", "腿身分布", canonicalParameter("body.legRatio", { scale: true }), "inline-range")}
            ${renderParameterScale("body.waistDefinition", "腰线特征", canonicalParameter("body.waistDefinition", { scale: true }), "inline-range")}
            ${renderParameterScale("body.shoulderHipBalance", "横向轮廓", canonicalParameter("body.shoulderHipBalance", { scale: true }), "inline-range")}
            ${renderParameterScale("body.boneFrame", "骨架量感", canonicalParameter("body.boneFrame", { scale: true }), "inline-range")}
          </div>
        </div>
        <div class="input-section input-section--face">
          <div class="input-section-heading"><strong>脸型轮廓</strong><span>影响领口方向与近脸修饰</span></div>
          <div class="field-stack-grid--single">${renderParameterScale("face.shape", "脸型轮廓", canonicalParameter("face.shape", { allowUnset: true }))}</div>
        </div>`;
    } else if (group === "preference") {
      const styleOptions = canonicalParameter("preference.style", { allowUnset: true });
      const formalityOptions = canonicalParameter("preference.formality", { allowUnset: true });
      const paletteOptions = canonicalParameter("preference.palette");
      const thermalBiasOptions = canonicalParameter("preference.thermalBias");
      const trendOptions = canonicalParameter("preference.trendDirection");
      trendOptions.options = trendOptions.options.map((option) => ({
        ...option,
        label: (state.ruleSet.trendDirections || []).find((item) => item.value === option.value)?.name || option.label
      }));
      content.innerHTML = `<div class="preference-flow-grid field-stack-grid--preference">
        ${renderParameterScale("preference.style", "风格方向", styleOptions, "choice-flow")}
        ${renderParameterScale("preference.formality", "正式程度偏好", formalityOptions)}
        ${renderParameterScale("preference.palette", "色系偏好", paletteOptions)}
        ${renderParameterScale("preference.thermalBias", "体感偏差校准", thermalBiasOptions)}
        ${renderParameterScale("preference.trendDirection", "潮流方向", trendOptions)}
        ${state.input.preference.trendDirection !== "none" ? renderParameterScale("preference.trendIntensity", "潮流表达强度", canonicalParameter("preference.trendIntensity")) : ""}
      </div>`;
    } else if (group === "goal-boundaries") {
      const endpoint = canonicalParameter("goal.endpoint", { allowUnset: true });
      const direction = canonicalParameter("goal.direction");
      const layering = canonicalParameter("goal.layeringPreference");
      const directionOptions = endpoint.value === "contrast"
        ? direction.options
        : direction.options.filter((option) => option.value !== "balance");
      const directionForRender = { ...direction, options: directionOptions };
      const boundaryExclusions = [
        ["rejectSkirt", "拒绝裙装", "排除所有裙装下装"],
        ["rejectTight", "拒绝紧绷贴身", "排除修身或活动余量不足的版型"],
        ["rejectDefinedWaist", "拒绝明显收腰", "排除明确腰位或高腰表达"],
        ["rejectDeepNeck", "拒绝低领开阔", "排除低领或过度开阔的领口"],
        ["rejectHighContrast", "拒绝高对比配色", "配色对比不高于中等"]
      ];
      const boundaryRequirements = [
        ["strictCoverage", "要求完整覆盖", "上下装都必须满足完整覆盖"],
        ["movementFriendly", "行动不能受限", "抬手、行走和坐下保持便利"],
        ["sensitiveTexture", "避免粗糙触感", "排除粗糙贴肤表面"]
      ];
      content.innerHTML = `
        <div class="input-section">
          <div class="input-section-heading"><strong>调整目标</strong><span>说明这次希望优先调整的视觉方向</span></div>
          <div class="field-stack-grid">
            ${renderParameterScale("goal.endpoint", "调整目标", endpoint)}
            ${renderParameterScale("goal.direction", "调整方向", directionForRender)}
            ${renderParameterScale("goal.layeringPreference", "叠穿倾向", layering)}
          </div>
        </div>
        <div class="input-section">
          <div class="input-section-heading"><strong>穿着边界</strong><span>排除项与必要条件均高于目标和风格偏好</span></div>
          <div class="boundary-subgroup"><strong>排除项</strong><div class="checkbox-grid">${boundaryExclusions.map(([field, title, desc]) => renderBooleanCheckbox(`boundaries.${field}`, title, desc)).join("")}</div></div>
          <div class="boundary-subgroup"><strong>必要条件</strong><div class="checkbox-grid">${boundaryRequirements.map(([field, title, desc]) => renderBooleanCheckbox(`boundaries.${field}`, title, desc)).join("")}</div></div>
        </div>`;
    }
  }

  function renderSetScale(path, label, definition) {
    const selected = Engine.getByPath(state.input, path) || [];
    return `<div class="form-item option-scale--set"><div class="form-item-header"><label>${escapeHtml(label)}</label></div><div class="pill-segment-control segment-control--${Math.min(definition?.options?.length || 1, 6)}" role="group" aria-label="${escapeHtml(label)}">${(definition?.options || []).map((option) => {
      const active = selected.includes(option.value);
      return `<button type="button" data-input-set-path="${escapeHtml(path)}" data-input-set-value="${escapeHtml(option.value)}" class="${active ? "is-active" : ""}" aria-pressed="${active}">${escapeHtml(option.label)}</button>`;
    }).join("")}</div></div>`;
  }

  function renderParameterScale(path, label, definition, variant = "") {
    const value = Engine.getByPath(state.input, path);
    if (definition?.type === "scale") return renderRangeScale(path, label, value, definition.options || [], variant);
    return renderOptionScale(path, label, value, definition?.options || [], variant);
  }

  function renderRangeScale(path, label, value, options, variant = "") {
    const normalized = options.map((option) => Array.isArray(option) ? { value: option[0], label: option[1] } : option);
    const selected = normalized.find((option) => String(option.value) === String(value)) || normalized[0];
    const [minLabel, maxLabel] = rangeEndpointLabels(path, normalized);
    const isInline = variant === "inline-range";
    const rangeMarkup = `<div class="range-scale" role="radiogroup" aria-label="${escapeHtml(label)}">
      <span class="range-endpoint" aria-hidden="true">${escapeHtml(minLabel)}</span>
      <div class="range-track">
        ${normalized.map((option) => {
          const active = String(option.value) === String(value);
          return `<button type="button" role="radio" aria-checked="${active ? "true" : "false"}" class="range-step ${active ? "is-active" : ""}" data-input-path="${escapeHtml(path)}" data-input-value="${escapeHtml(option.value)}" data-value="${escapeHtml(option.value)}" aria-label="${escapeHtml(label)}：${escapeHtml(option.label)}" title="${escapeHtml(option.label)}"><span class="range-dot" aria-hidden="true"></span></button>`;
        }).join("")}
      </div>
      <span class="range-endpoint" aria-hidden="true">${escapeHtml(maxLabel)}</span>
    </div>`;
    if (isInline) {
      return `<div class="form-item range-form-item range-form-item--inline">
        <div class="range-inline-row"><span class="range-inline-label">${escapeHtml(label)}</span>${rangeMarkup}</div>
      </div>`;
    }
    return `<div class="form-item range-form-item">
      <div class="form-item-header"><label>${escapeHtml(label)}</label><strong>${escapeHtml(selected?.label || "需确认")}</strong></div>
      ${rangeMarkup}
    </div>`;
  }

  function rangeEndpointLabels(path, options) {
    const overrides = {
      body: {
        legRatio: ["上身偏长", "下身偏长"],
        waistDefinition: ["不明显", "明显"],
        shoulderHipBalance: ["肩部明显", "胯部明显"],
        boneFrame: ["小骨架", "大骨架"]
      }
    };
    const [scope, field] = path.split(".");
    if (scope === "body" && overrides.body[field]) return overrides.body[field];
    if (path.endsWith("skinTone")) return ["冷调", "暖调"];
    if (path.endsWith("skinValue")) return ["浅", "深"];
    if (path.endsWith("hairTone")) return ["冷", "暖"];
    if (path.endsWith("hairDepth")) return ["浅", "深"];
    return [options[0]?.label || "低", options[options.length - 1]?.label || "高"];
  }

  function renderOptionScale(path, label, value, options, variant = "") {
    const normalized = options.map((option) => Array.isArray(option) ? { value: option[0], label: option[1] } : option);
    return `<div class="form-item option-scale--${escapeHtml(variant)}"><div class="form-item-header"><label>${escapeHtml(label)}</label><strong>${escapeHtml(translateValue(normalized.find((option) => String(option.value) === String(value))?.label || value || "需确认"))}</strong></div><div class="pill-segment-control segment-control--${Math.min(normalized.length, 6)}">${normalized.map((option) => `<button type="button" data-input-path="${escapeHtml(path)}" data-input-value="${escapeHtml(option.value)}" data-value="${escapeHtml(option.value)}" class="${String(option.value) === String(value) ? "is-active" : ""}">${escapeHtml(option.label)}</button>`).join("")}</div></div>`;
  }

  function renderTrendDirectionScale(path, label, value, options) {
    const normalized = options.map((option) => Array.isArray(option) ? { value: option[0], label: option[1] } : option);
    return `<div class="form-item option-scale--trend-flow">
      <div class="form-item-header"><label>${escapeHtml(label)}</label></div>
      <div class="trend-option-list">
        ${normalized.map((option) => `<button type="button" class="trend-option-card ${String(option.value) === String(value) ? "is-active" : ""}" data-input-path="${escapeHtml(path)}" data-input-value="${escapeHtml(option.value)}" data-value="${escapeHtml(option.value)}" aria-pressed="${String(option.value) === String(value) ? "true" : "false"}"><strong>${escapeHtml(option.label)}</strong></button>`).join("")}
      </div>
    </div>`;
  }

  function renderParameterSelect(path, label, definition) {
    const value = Engine.getByPath(state.input, path);
    const options = (definition?.options || []).map((option) => Array.isArray(option) ? { value: option[0], label: option[1] } : option);
    return `<div class="field-control"><span>${escapeHtml(label)}</span><select data-input-path="${escapeHtml(path)}">${options.map((option) => `<option value="${escapeHtml(option.value)}" ${String(option.value) === String(value) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select></div>`;
  }

  function renderBooleanCheckbox(path, title, desc) {
    const checked = Boolean(Engine.getByPath(state.input, path));
    return `<label class="check-control ${checked ? "is-checked" : ""}"><input type="checkbox" data-input-boolean="${escapeHtml(path)}" ${checked ? "checked" : ""} /><span class="check-box">${checked ? "✓" : ""}</span><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(desc)}</small></div></label>`;
  }

  function renderScaleControl(path, label, value, options) {
    const valIndex = typeof value === "number" ? value : options.indexOf(value);
    const count = options.length;
    return `
      <div class="scale-control">
        <div class="scale-label"><span>${label}</span><strong>${options[valIndex] || options[0]}</strong></div>
        <div class="pill-segment-control segment-control--${count}">
          ${options.map((opt, idx) => {
            const optVal = typeof value === "number" ? idx : opt;
            const isAct = typeof value === "number" ? valIndex === idx : value === opt;
            return `<button type="button" data-input-path="${path}" data-input-value="${optVal}" data-value="${optVal}" class="${isAct ? "is-active" : ""}">${opt}</button>`;
          }).join("")}
        </div>
      </div>
    `;
  }

  function renderSelectControl(path, label, value, options) {
    return `
      <div class="field-control">
        <span>${label}</span>
        <select data-input-path="${path}">
          ${options.map(([optVal, optName]) => `<option value="${optVal}" ${value === optVal ? "selected" : ""}>${optName}</option>`).join("")}
        </select>
      </div>
    `;
  }

  function renderCheckbox(path, value, title, desc) {
    const currentArray = Engine.getByPath(state.input, path) || [];
    const isChecked = currentArray.includes(value);
    return `
      <label class="check-control ${isChecked ? "is-checked" : ""}">
        <input type="checkbox" data-input-array="${path}" value="${value}" ${isChecked ? "checked" : ""} />
        <span class="check-box">${isChecked ? "✓" : ""}</span>
        <div>
          <strong>${title}</strong>
          <small>${desc}</small>
        </div>
      </label>
    `;
  }

  function handleInputClick(event) {
    const setButton = event.target.closest("button[data-input-set-path]");
    if (setButton) {
      const path = setButton.dataset.inputSetPath;
      const value = setButton.dataset.inputSetValue;
      let selected = Engine.getByPath(state.input, path) || [];
      if (value === "none") {
        selected = ["none"];
      } else if (selected.includes(value)) {
        selected = selected.filter((item) => item !== value);
        if (!selected.length) selected = ["none"];
      } else {
        selected = [...selected.filter((item) => item !== "none"), value];
      }
      Engine.setByPath(state.input, path, selected);
      Engine.Store.saveInput(state.input);
      renderAll();
      return;
    }
    const btn = event.target.closest("button[data-input-path]");
    if (!btn) return;
    const path = btn.dataset.inputPath;
    let val = btn.dataset.inputValue;
    if (/^\d+$/.test(val)) val = Number(val);
    Engine.setByPath(state.input, path, val);
    if (path === "goal.endpoint" && val !== "contrast" && state.input.goal?.direction === "balance") state.input.goal.direction = "keep";
    Engine.Store.saveInput(state.input);
    renderAll();
  }

  function handleInputChange(event) {
    const select = event.target.closest("select[data-input-path]");
    if (select) {
      const definition = state.ruleSet.parameters.find((item) => item.id === select.dataset.inputPath);
      const value = definition?.options?.some((option) => Number((Array.isArray(option) ? option[0] : option.value)) === Number(select.value))
        ? Number(select.value)
        : select.value;
      Engine.setByPath(state.input, select.dataset.inputPath, value);
      Engine.Store.saveInput(state.input);
      renderAll();
      return;
    }
    const checkbox = event.target.closest("input[data-input-array]");
    const booleanCheckbox = event.target.closest("input[data-input-boolean]");
    if (booleanCheckbox) {
      Engine.setByPath(state.input, booleanCheckbox.dataset.inputBoolean, booleanCheckbox.checked);
      Engine.Store.saveInput(state.input);
      renderAll();
      return;
    }
    if (checkbox) {
      const path = checkbox.dataset.inputArray;
      const val = checkbox.value;
      let array = Engine.getByPath(state.input, path) || [];
      if (checkbox.checked) {
        if (!array.includes(val)) array.push(val);
      } else {
        array = array.filter((item) => item !== val);
      }
      Engine.setByPath(state.input, path, array);
      Engine.Store.saveInput(state.input);
      renderAll();
    }
  }

  function renderCandidateHighlights() {
    const cards = $$(".candidate-card");
    cards.forEach((card, index) => {
      const isSelected = state.selectedCandidateIndex === index;
      card.classList.toggle("is-active-selection", isSelected);
    });
  }

  function renderHairStyleBar() {
    $$("#hairStyleBar button[data-hair-style]").forEach((button) => {
      const active = button.dataset.hairStyle === state.previewHairStyle;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-checked", String(active));
    });
  }

  function renderViewModeBar() {
    $$("#viewModeBar button").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.viewMode === state.viewMode);
    });
    $("#candidateGrid").hidden = state.viewMode !== "cards";
    $("#candidateTableView").hidden = state.viewMode !== "table";
  }

  function renderCandidates(result = state.lastResult) {
    if (!result || !result.candidates || !result.candidates.length) {
      const conflictText = result?.conflicts?.length
        ? "当前硬性规则之间存在冲突，系统没有生成不可靠的组合。"
        : result?.blocked?.length
          ? "当前边界没有找到同时满足的单品组合。"
          : "暂时没有足够信息生成候选组合。";
      $("#candidateGrid").innerHTML = `
        <div class="empty-result">
          <strong>${escapeHtml(conflictText)}</strong>
          <p>${result?.blocked?.[0]?.reason ? escapeHtml(result.blocked[0].reason) : "请补充事实或调整边界后重试。"}</p>
        </div>
      `;
      $("#candidateTableView").innerHTML = `<div class="empty-result"><p>暂无候选方案数据</p></div>`;
      return;
    }

    if (state.viewMode === "cards") {
      $("#candidateGrid").innerHTML = result.candidates.map((cand, idx) => renderCandidateCard(cand, idx, result)).join("");
    } else {
      renderCandidateTable(result.candidates);
    }
  }

  function roleForGarment(roles, category) {
    const garment = category === "top" ? "上装" : category === "outer" ? "外层" : category === "dress" ? "连身裙" : "下装";
    return roles.find((role) => role.garment === garment)
      || roles.find((role) => role.role === category)
      || null;
  }

  function candidateGarmentEntries(candidate) {
    return [
      candidate.garments?.dress ? { category: "dress", name: candidate.garments.dress } : null,
      candidate.garments?.top ? { category: "top", name: candidate.garments.top } : null,
      candidate.garments?.outer ? { category: "outer", name: candidate.garments.outer } : null,
      candidate.garments?.bottom ? { category: "bottom", name: candidate.garments.bottom } : null
    ].filter(Boolean);
  }

  function candidateGarmentNames(candidate) {
    return candidateGarmentEntries(candidate).map((item) => item.name);
  }

  const canonicalAccessoryLabels = {
    footwear: { loafersOxfords: "乐福鞋或牛津鞋", minimalSneakers: "极简板鞋", kittenHeels: "低跟单鞋", boots: "短靴" },
    leatherGoods: { structuredTote: "挺括托特包", shoulderBag: "腋下包", crossbody: "斜挎包", slimBelt: "细腰带" },
    jewelry: { pearls: "珍珠饰品", coolSilver: "冷银饰品", warmGold: "暖金饰品", naturalResin: "天然材质饰品", eyewear: "眼镜" },
    textile: { silkScarf: "真丝小方巾", cashmereScarf: "羊绒围巾", none: "无" }
  };

  const canonicalGarmentLabels = {
    form: { separatesTrouser: "分体裤装", separatesSkirt: "分体裙装", onePieceDress: "一件式" },
    topFit: { fitted: "修身", regular: "合体", oversized: "宽松" },
    bottomCut: { straightLeg: "直筒裤", wideLeg: "阔腿裤", tapered: "锥形裤", aLineSkirt: "A字裙", straightSkirt: "直筒裙" },
    dressCut: { aLineMidi: "A字中长", shirtDress: "衬衫裙", wrapDress: "裹身裙", columnDress: "直筒裙" },
    neckline: { vNeck: "V领", uNeck: "U领", boatNeck: "船领", squareNeck: "方领", crewNeck: "小圆领或立领" },
    waistline: { raised: "偏高腰位", natural: "自然腰位", relaxed: "松弛腰线" },
    sleeve: { short: "短袖", threeQuarter: "七分袖", long: "长袖" }
  };

  function canonicalAccessoryName(type, value) {
    return canonicalAccessoryLabels[type]?.[value] || value || "未配置";
  }

  function canonicalColorHex(name) {
    const known = (state.ruleSet.colorLibrary || []).find((color) => color.name === name)?.hex;
    if (known) return known;
    const tones = [
      [/黑|炭/, "#34383a"], [/白|象牙|奶油/, "#eeeae0"], [/灰/, "#9ba0a0"], [/蓝|藏青/, "#738d9d"],
      [/紫|丁香/, "#a99cb7"], [/绿|薄荷|橄榄|鼠尾草/, "#8d9b86"], [/红|铁锈|豆沙/, "#a66d67"],
      [/粉|桃/, "#d6a6a6"], [/驼|卡其|焦糖|杏|燕麦|米|金/, "#b99b75"], [/黄|橙/, "#c69a52"]
    ];
    return tones.find(([pattern]) => pattern.test(name || ""))?.[1] || "#b8b8b2";
  }

  function renderColorSpectrum(candidate) {
    const spectrum = candidateResult(candidate).color?.nearFacePalette;
    if (!spectrum || ![...(spectrum.preferred || []), ...(spectrum.compatible || [])].length) return "";
    const rows = [
      ["首选", spectrum.preferred || []],
      ["平替", spectrum.compatible || []],
      ["避开", spectrum.forbidden || []]
    ];
    return `<span class="color-spectrum-control">
      <button type="button" class="color-spectrum-trigger" aria-label="查看近脸颜色容错色谱">色谱</button>
      <span class="color-spectrum-popover" role="tooltip">${rows.map(([label, colors]) => `<span class="color-spectrum-row"><b>${label}</b><span>${colors.slice(0, 5).map((color) => `<i title="${escapeHtml(color)}" style="--spectrum-color:${escapeHtml(canonicalColorHex(color))}"></i><em>${escapeHtml(color)}</em>`).join("") || `<em>未配置</em>`}</span></span>`).join("")}</span>
    </span>`;
  }

  function isOnePieceCandidate(candidate) {
    return candidate.form === "onePieceDress" || Boolean(candidate.garments?.dress);
  }

  function onePieceDetails(candidate) {
    const garment = candidateResult(candidate).garment || {};
    const framework = candidateResult(candidate).framework || {};
    const hemByCut = { aLineMidi: "中长裙摆", shirtDress: "中长裙摆", wrapDress: "中长裙摆", columnDress: "中长裙摆" };
    return [
      ["裙型", canonicalGarmentLabels.dressCut[garment.dressCut || candidate.dressCut] || "连衣裙"],
      ["领口", canonicalGarmentLabels.neckline[garment.neckline] || candidate.neckline || "常规领口"],
      ["腰部", canonicalGarmentLabels.waistline[garment.waistline] || translateValue(candidate.waist)],
      ["裙摆", hemByCut[garment.dressCut || candidate.dressCut] || "中长裙摆"],
      ["袖长", canonicalGarmentLabels.sleeve[framework.sleeve || candidate.sleeve] || translateValue(candidate.sleeve)],
      ["外搭", candidate.garments?.outer || "无外层"]
    ];
  }

  function renderOnePieceComponent(candidate, roles) {
    const role = roleForGarment(roles, "dress") || roles[0] || {};
    return `<section class="one-piece-component" data-component="one-piece">
      <div class="one-piece-heading"><span>一件式主体</span><strong>${escapeHtml(candidate.garments?.dress || "连衣裙")}</strong><span class="garment-color-pill"><i style="background:${escapeHtml(role.hex || "transparent")}"></i>${escapeHtml(role.colorName || "待确认")}</span>${renderColorSpectrum(candidate)}</div>
      <div class="one-piece-specs">${onePieceDetails(candidate).map(([label, value]) => `<span><small>${label}</small><strong>${escapeHtml(value)}</strong></span>`).join("")}</div>
    </section>`;
  }

  function candidateAccessoryLayers(candidate) {
    const accessories = candidateResult(candidate).accessories || {};
    const footwear = accessories.footwear ? canonicalAccessoryName("footwear", accessories.footwear) : "";
    const conditional = accessories.leatherGoods === "slimBelt" && ["defined", "raised"].includes(candidate.waist)
      ? [canonicalAccessoryName("leatherGoods", accessories.leatherGoods)] : [];
    const optional = [
      accessories.leatherGoods !== "slimBelt" ? canonicalAccessoryName("leatherGoods", accessories.leatherGoods) : "",
      canonicalAccessoryName("jewelry", accessories.jewelry),
      accessories.textile !== "none" ? canonicalAccessoryName("textile", accessories.textile) : ""
    ].filter((value) => value && value !== "未配置");
    return { footwear, conditional, optional };
  }

  function renderAccessoryLayers(candidate) {
    const layers = candidateAccessoryLayers(candidate);
    return `<div class="wearing-layers">
      <div class="wearing-layer is-required"><span>完整穿着</span><strong>${escapeHtml(layers.footwear ? `鞋履：${layers.footwear}` : "鞋履待确认")}</strong></div>
      ${layers.conditional.length ? `<div class="wearing-layer is-conditional"><span>条件必需</span><strong>${layers.conditional.map(escapeHtml).join("、")}</strong></div>` : ""}
      <div class="wearing-layer is-optional"><span>进阶选配</span><strong>${layers.optional.length ? layers.optional.map(escapeHtml).join("、") : "无需额外配饰"}</strong></div>
    </div>`;
  }

  function renderPatternTag(candidate) {
    const pattern = candidate.patternDetail;
    if (!pattern) return `<span class="pattern-tag is-plain">纯色或低存在感纹理</span>`;
    return `<span class="pattern-tag" title="${escapeHtml(`${pattern.scale}尺度 · ${pattern.contrast}对比 · 用于${pattern.placement}`)}">${escapeHtml(pattern.name)} · ${escapeHtml(pattern.placement)}</span>`;
  }

  const GarmentIconRenderer = {
    trenchCoat(color, patternId = null) {
      return `
        <svg viewBox="0 0 100 110" class="garment-flat-svg" role="img" aria-label="经典双排扣风衣">
          <g filter="url(#garmentShadow)">
            <path d="M32 18 L18 36 L24 88 L34 94 L66 94 L76 88 L82 36 L68 18 L58 22 L42 22 Z" fill="${color}"/>
            ${patternId ? `<path d="M32 18 L18 36 L24 88 L34 94 L66 94 L76 88 L82 36 L68 18 L58 22 L42 22 Z" fill="url(#${patternId})" opacity="0.6"/>` : ""}
            <path d="M32 18 L48 38 L38 48 L22 32 Z" fill="#ffffff" fill-opacity="0.18"/>
            <path d="M68 18 L52 38 L62 48 L78 32 Z" fill="#ffffff" fill-opacity="0.18"/>
            <rect x="25" y="56" width="50" height="6" rx="1" fill="${color}" stroke="#000000" stroke-width="0.8" stroke-opacity="0.25"/>
            <rect x="44" y="54" width="12" height="10" rx="1.5" fill="#d4af37" stroke="#997b20" stroke-width="0.8"/>
            <rect x="47" y="56" width="6" height="6" fill="${color}"/>
            <circle cx="43" cy="42" r="1.8" fill="#2c2825"/><circle cx="57" cy="42" r="1.8" fill="#2c2825"/>
            <circle cx="43" cy="50" r="1.8" fill="#2c2825"/><circle cx="57" cy="50" r="1.8" fill="#2c2825"/>
            <circle cx="43" cy="68" r="1.8" fill="#2c2825"/><circle cx="57" cy="68" r="1.8" fill="#2c2825"/>
            <rect x="19" y="76" width="8" height="3" rx="0.5" fill="#d4af37"/>
            <rect x="73" y="76" width="8" height="3" rx="0.5" fill="#d4af37"/>
          </g>
        </svg>
      `;
    },

    blazer(color, patternId = null) {
      return `
        <svg viewBox="0 0 100 100" class="garment-flat-svg" role="img" aria-label="精裁西装">
          <g filter="url(#garmentShadow)">
            <path d="M30 16 L14 36 L22 84 L78 84 L86 36 L70 16 L58 20 L42 20 Z" fill="${color}"/>
            ${patternId ? `<path d="M30 16 L14 36 L22 84 L78 84 L86 36 L70 16 L58 20 L42 20 Z" fill="url(#${patternId})" opacity="0.65"/>` : ""}
            <path d="M30 16 L48 48 L36 54 L24 32 Z" fill="#ffffff" fill-opacity="0.2"/>
            <path d="M70 16 L52 48 L64 54 L76 32 Z" fill="#ffffff" fill-opacity="0.2"/>
            <rect x="30" y="40" width="12" height="2.5" rx="0.5" fill="#000000" fill-opacity="0.25"/>
            <path d="M33 39 L36 34 L39 39 Z" fill="#f8faf8"/>
            <rect x="24" y="64" width="16" height="3.5" rx="0.8" fill="#000000" fill-opacity="0.25"/>
            <rect x="60" y="64" width="16" height="3.5" rx="0.8" fill="#000000" fill-opacity="0.25"/>
            <circle cx="50" cy="58" r="2" fill="#2c2825" stroke="#d4af37" stroke-width="0.6"/>
            <circle cx="50" cy="68" r="2" fill="#2c2825" stroke="#d4af37" stroke-width="0.6"/>
          </g>
        </svg>
      `;
    },

    cardigan(color, patternId = null) {
      return `
        <svg viewBox="0 0 100 100" class="garment-flat-svg" role="img" aria-label="小香风开衫">
          <g filter="url(#garmentShadow)">
            <path d="M32 18 L16 34 L22 78 L78 78 L84 34 L68 18 C60 22 40 22 32 18 Z" fill="${color}"/>
            ${patternId ? `<path d="M32 18 L16 34 L22 78 L78 78 L84 34 L68 18 C60 22 40 22 32 18 Z" fill="url(#${patternId})" opacity="0.6"/>` : ""}
            <path d="M32 18 Q50 26 68 18" fill="none" stroke="#2c2825" stroke-width="2.5"/>
            <line x1="50" y1="23" x2="50" y2="78" stroke="#2c2825" stroke-width="2.5"/>
            <circle cx="50" cy="30" r="2" fill="#d4af37"/>
            <circle cx="50" cy="42" r="2" fill="#d4af37"/>
            <circle cx="50" cy="54" r="2" fill="#d4af37"/>
            <circle cx="50" cy="66" r="2" fill="#d4af37"/>
            <rect x="28" y="48" width="12" height="8" rx="1" fill="#000000" fill-opacity="0.1" stroke="#2c2825" stroke-width="0.8"/>
            <circle cx="34" cy="52" r="1.2" fill="#d4af37"/>
            <rect x="60" y="48" width="12" height="8" rx="1" fill="#000000" fill-opacity="0.1" stroke="#2c2825" stroke-width="0.8"/>
            <circle cx="66" cy="52" r="1.2" fill="#d4af37"/>
          </g>
        </svg>
      `;
    },

    shirt(color, patternId = null) {
      return `
        <svg viewBox="0 0 100 100" class="garment-flat-svg" role="img" aria-label="高支衬衫">
          <g filter="url(#garmentShadow)">
            <path d="M30 20 L16 34 L22 76 Q50 82 78 76 L84 34 L70 20 L58 24 L42 24 Z" fill="${color}"/>
            ${patternId ? `<path d="M30 20 L16 34 L22 76 Q50 82 78 76 L84 34 L70 20 L58 24 L42 24 Z" fill="url(#${patternId})" opacity="0.65"/>` : ""}
            <path d="M38 18 L50 28 L42 32 L34 20 Z" fill="#ffffff" fill-opacity="0.25"/>
            <path d="M62 18 L50 28 L58 32 L66 20 Z" fill="#ffffff" fill-opacity="0.25"/>
            <line x1="50" y1="28" x2="50" y2="78" stroke="#000000" stroke-width="1.2" stroke-opacity="0.2"/>
            <circle cx="50" cy="34" r="1.2" fill="#ffffff" stroke="#999" stroke-width="0.4"/>
            <circle cx="50" cy="44" r="1.2" fill="#ffffff" stroke="#999" stroke-width="0.4"/>
            <circle cx="50" cy="54" r="1.2" fill="#ffffff" stroke="#999" stroke-width="0.4"/>
            <circle cx="50" cy="64" r="1.2" fill="#ffffff" stroke="#999" stroke-width="0.4"/>
            <path d="M28 38 L38 38 L38 48 L33 52 L28 48 Z" fill="none" stroke="#000000" stroke-width="0.8" stroke-opacity="0.2"/>
          </g>
        </svg>
      `;
    },

    bretonTee(color, patternId = null) {
      return `
        <svg viewBox="0 0 100 100" class="garment-flat-svg" role="img" aria-label="海魂条纹T恤">
          <g filter="url(#garmentShadow)">
            <path d="M30 20 L14 36 L20 76 L80 76 L86 36 L70 20 C60 26 40 26 30 20 Z" fill="${color}"/>
            ${patternId ? `<path d="M30 20 L14 36 L20 76 L80 76 L86 36 L70 20 C60 26 40 26 30 20 Z" fill="url(#${patternId})" opacity="0.85"/>` : ""}
            <path d="M34 20 Q50 28 66 20 Q50 24 34 20 Z" fill="#ffffff" stroke="#1f2933" stroke-width="0.8"/>
            <line x1="20" y1="74" x2="80" y2="74" stroke="#000000" stroke-width="0.8" stroke-opacity="0.15"/>
          </g>
        </svg>
      `;
    },

    silkBlouse(color, patternId = null) {
      return `
        <svg viewBox="0 0 100 100" class="garment-flat-svg" role="img" aria-label="真丝飘带领衬衫">
          <g filter="url(#garmentShadow)">
            <path d="M30 20 L16 38 L24 76 L76 76 L84 38 L70 20 Q50 26 30 20 Z" fill="${color}"/>
            ${patternId ? `<path d="M30 20 L16 38 L24 76 L76 76 L84 38 L70 20 Q50 26 30 20 Z" fill="url(#${patternId})" opacity="0.6"/>` : ""}
            <path d="M46 22 Q42 32 40 48 Q44 46 48 26 Z" fill="#ffffff" fill-opacity="0.25"/>
            <path d="M54 22 Q58 34 60 52 Q56 48 52 26 Z" fill="#ffffff" fill-opacity="0.25"/>
            <circle cx="50" cy="24" r="3.5" fill="${color}" stroke="#000000" stroke-width="0.6" stroke-opacity="0.3"/>
          </g>
        </svg>
      `;
    },

    wideLegTrouser(color, patternId = null) {
      return `
        <svg viewBox="0 0 100 110" class="garment-flat-svg" role="img" aria-label="高腰垂感阔腿西裤">
          <g filter="url(#garmentShadow)">
            <path d="M32 16 L68 16 L76 96 L53 96 L50 42 L47 96 L24 96 Z" fill="${color}"/>
            ${patternId ? `<path d="M32 16 L68 16 L76 96 L53 96 L50 42 L47 96 L24 96 Z" fill="url(#${patternId})" opacity="0.6"/>` : ""}
            <rect x="32" y="16" width="36" height="5" fill="#000000" fill-opacity="0.15"/>
            <line x1="36" y1="26" x2="36" y2="94" stroke="#ffffff" stroke-width="1.2" stroke-opacity="0.35"/>
            <line x1="64" y1="26" x2="64" y2="94" stroke="#ffffff" stroke-width="1.2" stroke-opacity="0.35"/>
            <line x1="32" y1="22" x2="38" y2="30" stroke="#000000" stroke-width="0.8" stroke-opacity="0.3"/>
            <line x1="68" y1="22" x2="62" y2="30" stroke="#000000" stroke-width="0.8" stroke-opacity="0.3"/>
          </g>
        </svg>
      `;
    },

    pants(color, patternId = null) {
      return `
        <svg viewBox="0 0 100 110" class="garment-flat-svg" role="img" aria-label="经典西裤">
          <g filter="url(#garmentShadow)">
            <path d="M34 16 L66 16 L72 96 L52 96 L50 44 L48 96 L28 96 Z" fill="${color}"/>
            ${patternId ? `<path d="M34 16 L66 16 L72 96 L52 96 L50 44 L48 96 L28 96 Z" fill="url(#${patternId})" opacity="0.6"/>` : ""}
            <rect x="34" y="16" width="32" height="5" fill="#000000" fill-opacity="0.15"/>
            <line x1="38" y1="24" x2="38" y2="94" stroke="#ffffff" stroke-width="1" stroke-opacity="0.3"/>
            <line x1="62" y1="24" x2="62" y2="94" stroke="#ffffff" stroke-width="1" stroke-opacity="0.3"/>
          </g>
        </svg>
      `;
    },

    skirt(color, patternId = null) {
      return `
        <svg viewBox="0 0 100 110" class="garment-flat-svg" role="img" aria-label="高腰A字半身裙">
          <g filter="url(#garmentShadow)">
            <path d="M36 16 L64 16 L82 94 Q50 100 18 94 Z" fill="${color}"/>
            ${patternId ? `<path d="M36 16 L64 16 L82 94 Q50 100 18 94 Z" fill="url(#${patternId})" opacity="0.65"/>` : ""}
            <rect x="36" y="16" width="28" height="5" fill="#000000" fill-opacity="0.15"/>
            <path d="M42 22 Q40 58 34 95" stroke="#ffffff" stroke-width="1.2" stroke-opacity="0.35" fill="none"/>
            <path d="M50 22 Q50 58 50 97" stroke="#000000" stroke-width="0.8" stroke-opacity="0.2" fill="none"/>
            <path d="M58 22 Q60 58 66 95" stroke="#ffffff" stroke-width="1.2" stroke-opacity="0.35" fill="none"/>
          </g>
        </svg>
      `;
    },

    wrapDress(color, patternId = null) {
      return `
        <svg viewBox="0 0 100 120" class="garment-flat-svg" role="img" aria-label="法式茶歇裹身裙">
          <g filter="url(#garmentShadow)">
            <path d="M34 16 L18 32 L26 44 L36 46 L20 106 Q50 114 80 106 L64 46 L74 44 L82 32 L66 16 Z" fill="${color}"/>
            ${patternId ? `<path d="M34 16 L18 32 L26 44 L36 46 L20 106 Q50 114 80 106 L64 46 L74 44 L82 32 L66 16 Z" fill="url(#${patternId})" opacity="0.65"/>` : ""}
            <path d="M34 16 L58 46 L42 46 Z" fill="#ffffff" fill-opacity="0.2"/>
            <path d="M66 16 L42 46 L58 46 Z" fill="#000000" fill-opacity="0.12"/>
            <circle cx="38" cy="46" r="3" fill="#d4af37"/>
            <path d="M38 46 Q32 54 30 68" stroke="${color}" stroke-width="2.5" fill="none"/>
            <path d="M38 46 Q40 56 42 66" stroke="${color}" stroke-width="2" fill="none"/>
          </g>
        </svg>
      `;
    },

    shirtDress(color, patternId = null) {
      return `
        <svg viewBox="0 0 100 120" class="garment-flat-svg" role="img" aria-label="系带衬衫裙">
          <g filter="url(#garmentShadow)">
            <path d="M32 16 L16 32 L24 44 L34 46 L22 106 Q50 112 78 106 L66 46 L76 44 L84 32 L68 16 Z" fill="${color}"/>
            ${patternId ? `<path d="M32 16 L16 32 L24 44 L34 46 L22 106 Q50 112 78 106 L66 46 L76 44 L84 32 L68 16 Z" fill="url(#${patternId})" opacity="0.65"/>` : ""}
            <path d="M38 14 L50 24 L42 28 Z" fill="#ffffff" fill-opacity="0.25"/>
            <path d="M62 14 L50 24 L58 28 Z" fill="#ffffff" fill-opacity="0.25"/>
            <line x1="50" y1="24" x2="50" y2="108" stroke="#000000" stroke-width="1.2" stroke-opacity="0.2"/>
            <rect x="34" y="44" width="32" height="4.5" rx="1" fill="#2c2825"/>
          </g>
        </svg>
      `;
    },

    loafers(color) {
      return `
        <svg viewBox="0 0 100 70" class="garment-flat-svg" role="img" aria-label="皮质乐福鞋">
          <g filter="url(#garmentShadow)">
            <path d="M16 42 C16 28 30 22 40 22 C46 22 48 32 48 44 C48 52 42 56 30 56 C18 56 16 52 16 42 Z" fill="${color}"/>
            <path d="M22 32 C26 26 36 26 42 32" fill="none" stroke="#ffffff" stroke-width="1" stroke-opacity="0.4"/>
            <rect x="27" y="34" width="10" height="2" rx="0.5" fill="#d4af37"/>
            <circle cx="28" cy="35" r="1.3" fill="none" stroke="#d4af37" stroke-width="0.7"/>
            <circle cx="36" cy="35" r="1.3" fill="none" stroke="#d4af37" stroke-width="0.7"/>
            <path d="M52 42 C52 30 54 22 60 22 C70 22 84 28 84 42 C84 52 82 56 70 56 C58 56 52 52 52 42 Z" fill="${color}"/>
            <path d="M58 32 C64 26 74 26 78 32" fill="none" stroke="#ffffff" stroke-width="1" stroke-opacity="0.4"/>
            <rect x="63" y="34" width="10" height="2" rx="0.5" fill="#d4af37"/>
            <circle cx="64" cy="35" r="1.3" fill="none" stroke="#d4af37" stroke-width="0.7"/>
            <circle cx="72" cy="35" r="1.3" fill="none" stroke="#d4af37" stroke-width="0.7"/>
          </g>
        </svg>
      `;
    },

    kittenHeels(color) {
      return `
        <svg viewBox="0 0 100 70" class="garment-flat-svg" role="img" aria-label="尖头小猫跟鞋">
          <g filter="url(#garmentShadow)">
            <path d="M14 40 Q28 34 44 42 Q36 50 22 50 Q12 50 14 40 Z" fill="${color}"/>
            <path d="M18 50 L16 58 L19 58 L21 50 Z" fill="#2c2825"/>
            <path d="M86 40 Q72 34 56 42 Q64 50 78 50 Q88 50 86 40 Z" fill="${color}"/>
            <path d="M82 50 L84 58 L81 58 L79 50 Z" fill="#2c2825"/>
          </g>
        </svg>
      `;
    },

    boots(color) {
      return `
        <svg viewBox="0 0 100 80" class="garment-flat-svg" role="img" aria-label="切尔西短靴">
          <g filter="url(#garmentShadow)">
            <path d="M20 18 L40 18 L40 44 Q48 48 48 60 L16 60 L16 44 Q16 32 20 18 Z" fill="${color}"/>
            <path d="M26 26 L34 26 L36 46 L24 46 Z" fill="#1f2933"/>
            <path d="M80 18 L60 18 L60 44 Q52 48 52 60 L84 60 L84 44 Q84 32 80 18 Z" fill="${color}"/>
            <path d="M74 26 L66 26 L64 46 L76 46 Z" fill="#1f2933"/>
          </g>
        </svg>
      `;
    },

    sneakers(color) {
      return `
        <svg viewBox="0 0 100 70" class="garment-flat-svg" role="img" aria-label="复古德训板鞋">
          <g filter="url(#garmentShadow)">
            <path d="M12 42 Q20 30 46 34 L48 50 L14 50 Z" fill="${color}"/>
            <rect x="12" y="50" width="36" height="5" rx="1" fill="#d8ba8e"/>
            <path d="M88 42 Q80 30 54 34 L52 50 L86 50 Z" fill="${color}"/>
            <rect x="52" y="50" width="36" height="5" rx="1" fill="#d8ba8e"/>
          </g>
        </svg>
      `;
    },

    toteBag(color) {
      return `
        <svg viewBox="0 0 100 90" class="garment-flat-svg" role="img" aria-label="挺括托特包">
          <g filter="url(#garmentShadow)">
            <path d="M36 36 Q36 12 50 12 Q64 12 64 36" fill="none" stroke="#2c2825" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M24 34 L76 34 L70 78 L30 78 Z" fill="${color}"/>
            <line x1="24" y1="34" x2="76" y2="34" stroke="#000000" stroke-width="0.8" stroke-opacity="0.25"/>
            <circle cx="36" cy="36" r="2" fill="#d4af37"/>
            <circle cx="64" cy="36" r="2" fill="#d4af37"/>
            <line x1="38" y1="38" x2="42" y2="50" stroke="#2c2825" stroke-width="0.8"/>
            <path d="M40 50 L44 50 L45 56 L39 56 Z" fill="#2c2825"/>
          </g>
        </svg>
      `;
    },

    shoulderBag(color) {
      return `
        <svg viewBox="0 0 100 80" class="garment-flat-svg" role="img" aria-label="法式腋下包">
          <g filter="url(#garmentShadow)">
            <path d="M30 40 Q30 16 50 16 Q70 16 70 40" fill="none" stroke="#2c2825" stroke-width="2.2"/>
            <path d="M22 38 Q50 32 78 38 L74 66 Q50 74 26 66 Z" fill="${color}"/>
            <path d="M24 38 Q50 48 76 38" fill="none" stroke="#000000" stroke-width="0.8" stroke-opacity="0.2"/>
            <circle cx="50" cy="48" r="2.5" fill="#d4af37"/>
          </g>
        </svg>
      `;
    },

    crossbodyBag(color) {
      return `
        <svg viewBox="0 0 100 80" class="garment-flat-svg" role="img" aria-label="随身小方包">
          <g filter="url(#garmentShadow)">
            <line x1="16" y1="14" x2="84" y2="38" stroke="#2c2825" stroke-width="1.6"/>
            <rect x="30" y="34" width="40" height="28" rx="2.5" fill="${color}"/>
            <path d="M30 34 L70 34 L70 46 L50 54 L30 46 Z" fill="#ffffff" fill-opacity="0.15"/>
            <rect x="47" y="50" width="6" height="3.5" rx="0.8" fill="#d4af37"/>
          </g>
        </svg>
      `;
    }
  };

  function renderLegacyIllustration(illustration, candidate) {
    const model = illustration || {};
    const layers = model.layers || [];
    const colorRegions = model.colorMap?.regions || candidate.palette?.regions || [];
    const regionColors = new Map(colorRegions.map((region) => [region.id, region]));
    const colorFor = (regionId, fallback) => {
      const region = regionColors.get(regionId);
      return {
        hex: region?.hex || fallback,
        colorName: region?.colorName || "待确认",
        ratio: Number(region?.ratio || 0),
        resolved: Boolean(region?.hex)
      };
    };

    const topLayer = layers.find((layer) => layer.kind === "top") || {};
    const dressLayer = layers.find((layer) => layer.kind === "dress") || {};
    const outerLayer = layers.find((layer) => layer.kind === "outer") || {};
    const bottomLayer = layers.find((layer) => layer.kind === "bottom") || {};
    const isDress = Boolean(dressLayer.visible) || candidate.form === "onePieceDress" || Boolean(candidate.garments?.dress);

    const topColor = isDress ? colorFor("dress", dressLayer.color || "#e8e5dc") : colorFor("top", topLayer.color || "#e8e5dc");
    const outerColor = colorFor("outer", outerLayer.color || "#8d9b86");
    const bottomColor = isDress ? topColor : colorFor("bottom", bottomLayer.color || "#34383a");
    const accentColor = colorFor("accent", "#5b5149");
    const outerVisible = outerLayer.visible !== false && outerLayer.type !== "none" && Boolean(candidate.garments?.outer && candidate.garments.outer !== "无外层");

    const bottomType = isDress ? "dress" : bottomLayer.type || bottomLayer.bottomType || candidate.bottomType || "trouser";
    const bottomCut = candidateResult(candidate).garment?.bottomCut || candidate.bottomCut || "straightLeg";
    const dressCut = candidateResult(candidate).garment?.dressCut || candidate.dressCut || dressLayer.dressCut || "aLineMidi";
    const sleeve = (isDress ? dressLayer.sleeve : topLayer.sleeve) || candidate.sleeve || "long";
    const neckline = model.neckline || candidate.neckline || "regular";
    const waist = model.waist || candidate.waist || "natural";

    const pattern = candidate.patternDetail;
    const patternTarget = pattern?.placement === "上装" ? "top" : pattern?.placement === "外层" ? "outer" : pattern?.placement === "下装" ? "bottom" : pattern?.placement === "连衣裙" ? "dress" : null;

    const footwearKey = candidateResult(candidate).accessories?.footwear || "loafersOxfords";
    const bagKey = candidateResult(candidate).accessories?.leatherGoods || "structuredTote";

    const svgId = `ens-${Math.random().toString(36).slice(2, 7)}`;
    const patternInk = pattern?.contrast === "低" ? "#243746" : "#ffffff";
    const patternOpacity = pattern?.contrast === "低" ? "0.24" : "0.38";

    // Sleeve Geometry with True Visible Sleeves
    const armPath = sleeve === "short"
      ? `<path d="M92 56 L76 90 M128 56 L144 90" fill="none" stroke="${topColor.hex}" stroke-width="13" stroke-linecap="round"/><line x1="70" y1="90" x2="82" y2="90" stroke="#ffffff" stroke-width="1.2" stroke-opacity="0.4"/><line x1="138" y1="90" x2="150" y2="90" stroke="#ffffff" stroke-width="1.2" stroke-opacity="0.4"/>`
      : sleeve === "threeQuarter"
        ? `<path d="M92 56 L73 108 M128 56 L147 108" fill="none" stroke="${topColor.hex}" stroke-width="13" stroke-linecap="round"/><line x1="67" y1="108" x2="79" y2="108" stroke="#ffffff" stroke-width="1.2" stroke-opacity="0.4"/><line x1="141" y1="108" x2="153" y2="108" stroke="#ffffff" stroke-width="1.2" stroke-opacity="0.4"/>`
        : `<path d="M92 56 L71 126 M128 56 L149 126" fill="none" stroke="${topColor.hex}" stroke-width="13" stroke-linecap="round"/><circle cx="71" cy="122" r="1.2" fill="#ffffff" stroke="#999" stroke-width="0.4"/><circle cx="149" cy="122" r="1.2" fill="#ffffff" stroke="#999" stroke-width="0.4"/>`;

    // Neckline Geometry
    const necklineText = String(neckline);
    const isOpenNeckline = neckline === "open" || neckline === "vNeck" || necklineText.includes("V领") || necklineText.includes("开阔");
    const isSquareNeckline = neckline === "squareNeck" || necklineText.includes("方领");
    const isSoftNeckline = neckline === "softCurve" || neckline === "uNeck" || necklineText.includes("U领") || necklineText.includes("柔和");
    const necklinePath = isOpenNeckline
      ? `<path d="M97 70 L110 92 L123 70" fill="none" stroke="#ecd8c8" stroke-width="3" stroke-linecap="round"/>`
      : isSquareNeckline
        ? `<path d="M98 70 L98 86 L122 86 L122 70" fill="none" stroke="#ecd8c8" stroke-width="3"/>`
        : isSoftNeckline
          ? `<path d="M97 71 Q110 93 123 71" fill="none" stroke="#ecd8c8" stroke-width="3"/>`
          : `<path d="M99 71 Q110 82 121 71" fill="none" stroke="#ecd8c8" stroke-width="3"/>`;

    // Waistline Marker
    const waistY = waist === "raised" ? 112 : waist === "defined" ? 128 : 144;
    const waistMark = waist === "defined"
      ? `<path d="M86 ${waistY} L134 ${waistY}" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.5"/>`
      : waist === "raised"
        ? `<path d="M88 ${waistY} L132 ${waistY}" stroke="#ffffff" stroke-opacity="0.75" stroke-width="2" stroke-dasharray="4 3"/>`
        : "";

    // Trousers & Skirt Shapes with Razor-Sharp Crease Line (烫迹线)
    const trouserShape = bottomCut === "wideLeg"
      ? `<path d="M78 144 L142 144 L148 244 L114 244 L110 162 L106 244 L72 244 Z" fill="${bottomColor.hex}"/>
         <line x1="91" y1="152" x2="88" y2="242" stroke="#ffffff" stroke-width="1.4" stroke-opacity="0.35"/>
         <line x1="129" y1="152" x2="132" y2="242" stroke="#ffffff" stroke-width="1.4" stroke-opacity="0.35"/>
         <rect x="78" y="144" width="64" height="6" fill="#000000" fill-opacity="0.15"/>
         <rect x="107" y="144" width="6" height="6" fill="#d4af37" rx="1"/>`
      : bottomCut === "tapered"
        ? `<path d="M82 144 L138 144 L131 244 L112 244 L110 164 L108 244 L89 244 Z" fill="${bottomColor.hex}"/>
           <line x1="95" y1="152" x2="97" y2="242" stroke="#ffffff" stroke-width="1.2" stroke-opacity="0.35"/>
           <line x1="125" y1="152" x2="123" y2="242" stroke="#ffffff" stroke-width="1.2" stroke-opacity="0.35"/>
           <rect x="82" y="144" width="56" height="6" fill="#000000" fill-opacity="0.15"/>`
        : `<path d="M82 144 L138 144 L137 244 L113 244 L110 164 L107 244 L83 244 Z" fill="${bottomColor.hex}"/>
           <line x1="94" y1="152" x2="94" y2="242" stroke="#ffffff" stroke-width="1.2" stroke-opacity="0.35"/>
           <line x1="126" y1="152" x2="126" y2="242" stroke="#ffffff" stroke-width="1.2" stroke-opacity="0.35"/>
           <rect x="82" y="144" width="56" height="6" fill="#000000" fill-opacity="0.15"/>`;

    const bottomShape = bottomType === "skirt" || bottomCut === "aLineSkirt" || bottomCut === "straightSkirt"
      ? `<path d="M80 144 L140 144 L160 240 Q110 250 60 240 Z" fill="${bottomColor.hex}"/>
         <rect x="80" y="144" width="60" height="6" fill="#000000" fill-opacity="0.15"/>
         <path d="M96 150 Q92 195 82 242" stroke="#ffffff" stroke-width="1.4" stroke-opacity="0.35" fill="none"/>
         <path d="M124 150 Q128 195 138 242" stroke="#ffffff" stroke-width="1.4" stroke-opacity="0.35" fill="none"/>`
      : trouserShape;

    // Dress Shapes (Complete Fluid One-Piece with zero overflow)
    const dressShape = {
      aLineMidi: `<path d="M92 54 L128 54 L142 104 L160 240 Q110 250 60 240 L78 104 Z" fill="${topColor.hex}"/>
                  <path d="M98 114 Q92 180 82 242" stroke="#ffffff" stroke-width="1.4" stroke-opacity="0.35" fill="none"/>
                  <path d="M122 114 Q128 180 138 242" stroke="#ffffff" stroke-width="1.4" stroke-opacity="0.35" fill="none"/>`,
      shirtDress: `<path d="M92 54 L128 54 L138 104 L146 242 Q110 248 74 242 L82 104 Z" fill="${topColor.hex}"/>
                   <path d="M102 54 L110 64 L118 54" fill="none" stroke="#ffffff" stroke-opacity="0.6" stroke-width="1.6"/>
                   <line x1="110" y1="64" x2="110" y2="238" stroke="#ffffff" stroke-opacity="0.45" stroke-width="1.5"/>
                   <rect x="88" y="118" width="44" height="6" fill="#2c2825" rx="1"/>`,
      wrapDress: `<path d="M92 54 L128 54 L140 104 L158 240 Q110 250 62 240 L80 104 Z" fill="${topColor.hex}"/>
                  <path d="M92 54 L122 110 L94 122" fill="none" stroke="#ffffff" stroke-opacity="0.6" stroke-width="2"/>
                  <circle cx="94" cy="122" r="3.5" fill="#d4af37"/>
                  <path d="M94 122 Q88 135 86 154" stroke="${topColor.hex}" stroke-width="2.5" fill="none"/>
                  <path d="M94 122 Q96 138 98 152" stroke="${topColor.hex}" stroke-width="2.5" fill="none"/>`,
      columnDress: `<path d="M92 54 L128 54 L136 104 L138 242 Q110 246 82 242 L84 104 Z" fill="${topColor.hex}"/>`
    }[dressCut] || `<path d="M92 54 L128 54 L142 104 L160 240 Q110 250 60 240 L78 104 Z" fill="${topColor.hex}"/>`;

    // Outer Layer (Naturally Layered Over Top with Open Front)
    const outerGarmentName = candidate.garments?.outer || "";
    const outerShape = outerGarmentName.includes("风衣")
      ? `<path d="M84 54 L62 88 L70 216 L150 216 L158 88 L136 54 L124 74 L96 74 Z" fill="${outerColor.hex}" opacity="0.96"/>
         <path d="M96 54 L104 88 L110 82 L116 88 L124 54" fill="none" stroke="#ffffff" stroke-opacity="0.65" stroke-width="2"/>
         <path d="M84 54 L60 92 L62 130 M136 54 L160 92 L158 130" stroke="${outerColor.hex}" stroke-width="15" stroke-linecap="round" fill="none"/>
         <path d="M72 142 L66 172 M148 142 L154 172" stroke="${outerColor.hex}" stroke-width="3"/>
         <circle cx="88" cy="110" r="2" fill="#2c2825"/><circle cx="132" cy="110" r="2" fill="#2c2825"/>`
      : outerGarmentName.includes("开衫") || outerGarmentName.includes("针织")
        ? `<path d="M86 54 L66 88 L74 168 L146 168 L154 88 L134 54 L122 72 L98 72 Z" fill="${outerColor.hex}" opacity="0.94"/>
           <path d="M86 54 Q110 68 134 54" fill="none" stroke="#2c2825" stroke-width="2.5"/>
           <line x1="110" y1="65" x2="110" y2="168" stroke="#2c2825" stroke-width="2.5"/>
           <path d="M86 54 L62 90 L64 126 M134 54 L158 90 L156 126" stroke="${outerColor.hex}" stroke-width="14" stroke-linecap="round" fill="none"/>
           <circle cx="110" cy="80" r="2" fill="#d4af37"/><circle cx="110" cy="100" r="2" fill="#d4af37"/><circle cx="110" cy="120" r="2" fill="#d4af37"/><circle cx="110" cy="140" r="2" fill="#d4af37"/>`
        : `<path d="M84 54 L64 86 L70 172 L150 172 L156 86 L136 54 L124 74 L96 74 Z" fill="${outerColor.hex}" opacity="0.96"/>
           <path d="M96 54 L104 86 L110 80 L116 86 L124 54" fill="none" stroke="#ffffff" stroke-opacity="0.7" stroke-width="2"/>
           <path d="M84 54 L62 90 L64 126 M136 54 L158 90 L156 126" stroke="${outerColor.hex}" stroke-width="14" stroke-linecap="round" fill="none"/>
           <rect x="76" y="98" width="14" height="3" fill="#000000" fill-opacity="0.3"/>
           <path d="M80 97 L83 92 L86 97 Z" fill="#ffffff"/>
           <circle cx="110" cy="126" r="2.2" fill="#2c2825" stroke="#d4af37" stroke-width="0.6"/>`;

    // Concrete Footwear
    const footwearSvg = {
      loafersOxfords: `<path d="M84 248 Q94 244 104 248 L102 258 L83 258 Z M116 248 Q126 244 136 248 L137 258 L118 258 Z" fill="${accentColor.hex}"/>
                       <line x1="89" y1="251" x2="99" y2="251" stroke="#d4af37" stroke-width="1.6"/>
                       <line x1="121" y1="251" x2="131" y2="251" stroke="#d4af37" stroke-width="1.6"/>`,
      kittenHeels: `<path d="M84 249 Q94 244 104 249 L101 257 L87 257 Z M116 249 Q126 244 136 249 L133 257 L119 257 Z" fill="${accentColor.hex}"/>
                    <path d="M88 257 L87 262 M132 257 L133 262" stroke="${accentColor.hex}" stroke-width="2"/>`,
      boots: `<path d="M84 240 L104 240 L104 258 L84 258 Z M116 240 L136 240 L136 258 L116 258 Z" fill="${accentColor.hex}"/>
              <path d="M94 244 L94 254 M126 244 L126 254" stroke="#1f2933" stroke-width="3"/>`,
      minimalSneakers: `<path d="M84 248 Q94 244 104 248 L102 257 L83 257 Z M116 248 Q126 244 136 248 L137 257 L118 257 Z" fill="#eeeae0" stroke="${accentColor.hex}" stroke-width="0.8"/>
                        <rect x="83" y="257" width="20" height="2.5" fill="#d8ba8e"/>
                        <rect x="117" y="257" width="20" height="2.5" fill="#d8ba8e"/>`
    }[footwearKey] || `<path d="M84 248 Q94 244 104 248 L102 258 L83 258 Z M116 248 Q126 244 136 248 L137 258 L118 258 Z" fill="${accentColor.hex}"/>`;

    // Concrete Bags
    const bagSvg = {
      structuredTote: `<rect x="150" y="136" width="26" height="34" rx="2" fill="${accentColor.hex}"/>
                       <path d="M157 136 Q163 122 169 136" fill="none" stroke="#2c2825" stroke-width="2.2"/>
                       <circle cx="157" cy="138" r="1.5" fill="#d4af37"/><circle cx="169" cy="138" r="1.5" fill="#d4af37"/>`,
      shoulderBag: `<path d="M142 86 Q150 108 152 120 L166 118 Q162 102 150 84 Z" fill="${accentColor.hex}"/>
                    <circle cx="158" cy="116" r="2" fill="#d4af37"/>`,
      crossbody: `<line x1="94" y1="58" x2="148" y2="132" stroke="#2c2825" stroke-width="2"/>
                  <rect x="142" y="128" width="22" height="18" rx="3" fill="${accentColor.hex}"/>
                  <rect x="151" y="135" width="4" height="3" fill="#d4af37"/>`,
      slimBelt: `<rect x="86" y="125" width="48" height="4" rx="1" fill="${accentColor.hex}"/>`
    }[bagKey] || "";

    const topPath = "M92 54 L128 54 L142 92 L136 148 L84 148 L78 92 Z";
    const patternShapes = {
      top: `<path d="${topPath}" fill="url(#pattern-${svgId})"/>`,
      outer: outerVisible ? `<path d="M84 54 L64 86 L70 172 L150 172 L156 86 L136 54 L124 74 L96 74 Z" fill="url(#pattern-${svgId})" opacity="0.72"/>` : "",
      bottom: `<path d="M78 144 L142 144 L148 244 L114 244 L110 162 L106 244 L72 244 Z" fill="url(#pattern-${svgId})" opacity="0.72"/>`,
      dress: dressShape.replace(/fill="#[A-Fa-f0-9]+"/g, `fill="url(#pattern-${svgId})"`)
    }[patternTarget] || "";

    return `
      <div class="outfit-illustration" data-illustration-type="${escapeHtml(model.type || "outfit-schematic")}">
        <svg class="illustration-svg" viewBox="0 0 220 280" role="img" aria-label="${escapeHtml(candidate.title || "真实穿搭上身效果图")}">
          <defs>
            <filter id="shadow-${svgId}" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="2.2" flood-color="#182820" flood-opacity="0.14"/></filter>
            <pattern id="pattern-${svgId}" width="${pattern?.id === "maritimeStripe" ? 16 : 12}" height="${pattern?.id === "maritimeStripe" ? 6 : 12}" patternUnits="userSpaceOnUse">
              ${pattern?.id === "maritimeStripe" ? `<line x1="0" y1="3" x2="16" y2="3" stroke="${patternInk}" stroke-width="2.2" stroke-opacity="${patternOpacity}"/>` : ""}
              ${pattern?.id === "princeOfWales" || pattern?.id === "houndstooth" ? `<path d="M0 0h12v12H0z" fill="none"/><path d="M0 0h12M0 4h12M0 8h12M0 0v12M4 0v12M8 0v12" stroke="${patternInk}" stroke-width="0.75" stroke-opacity="${patternOpacity}"/>` : ""}
              ${pattern?.id === "frenchPolkaDot" ? `<circle cx="3" cy="3" r="1.8" fill="${patternInk}" fill-opacity="${patternOpacity}"/><circle cx="9" cy="9" r="1.8" fill="${patternInk}" fill-opacity="${patternOpacity}"/>` : ""}
              ${pattern?.id === "smallFloral" ? `<circle cx="3" cy="3" r="1.3" fill="${patternInk}" fill-opacity="${patternOpacity}"/><path d="M3 1v4M1 3h4" stroke="${patternInk}" stroke-width="0.8" stroke-opacity="${patternOpacity}"/>` : ""}
            </pattern>
          </defs>

          <!-- Ground Contact Shadow -->
          <ellipse cx="110" cy="265" rx="52" ry="5.5" fill="#182820" fill-opacity="0.1"/>

          <!-- Stylized French Hair & Neck -->
          <ellipse cx="110" cy="20" rx="7" ry="5" fill="#2d2926"/>
          <path d="M96 34 C94 20 126 20 124 34 C126 40 122 46 118 48 C120 38 116 28 110 28 C104 28 100 38 102 48 C98 46 94 40 96 34 Z" fill="#2d2926"/>
          <path d="M101 34 Q110 49 119 34 L117 56 Q110 60 103 56 Z" fill="#ecd8c8"/>
          <path d="M103 56 Q110 60 117 56" stroke="#d4b8a2" stroke-width="1.2" fill="none" opacity="0.6"/>

          <!-- Base Inner Top / Dress -->
          <g filter="url(#shadow-${svgId})">
            ${isDress ? dressShape : `<path d="${topPath}" fill="${topColor.hex}"/>`}
            ${patternTarget === "top" || patternTarget === "dress" ? patternShapes : ""}
          </g>

          <!-- Inner Sleeves (Clearly visible with short/threeQuarter/long differences) -->
          ${armPath}
          <circle cx="71" cy="${sleeve === "short" ? 94 : sleeve === "threeQuarter" ? 112 : 130}" r="3.2" fill="#ecd8c8"/>
          <circle cx="149" cy="${sleeve === "short" ? 94 : sleeve === "threeQuarter" ? 112 : 130}" r="3.2" fill="#ecd8c8"/>

          <!-- Outer Layer (Layered Over Inner Top) -->
          ${outerVisible ? `<g filter="url(#shadow-${svgId})">${outerShape}${patternTarget === "outer" ? patternShapes : ""}</g>` : ""}

          <!-- Bottom Separates (Trousers with Press Crease / A-line Skirt) -->
          ${isDress ? "" : `<g filter="url(#shadow-${svgId})">${bottomShape}${patternTarget === "bottom" ? patternShapes : ""}</g>`}

          <!-- Legs Transition to Footwear -->
          <path d="M94 240 L94 248 M126 240 L126 248" stroke="#ecd8c8" stroke-width="6" stroke-linecap="round"/>

          <!-- Concrete Footwear Grounded -->
          ${footwearSvg}

          <!-- Concrete Handbag -->
          ${bagSvg}

          <!-- Neckline, Waistline Markers -->
          ${necklinePath}
          ${waistMark}
        </svg>
        <span class="illustration-caption">${escapeHtml(model.layerCount || candidate.layerCount || 1)}层 · ${escapeHtml(model.silhouette || candidate.silhouette || "整体轮廓")} · ${escapeHtml(translateValue(sleeve))}</span>
        ${model.validation?.colorComplete === false ? `<span class="illustration-warning">颜色待确认</span>` : ""}
      </div>
    `;
  }

  function renderIllustration(illustration, candidate) {
    const model = illustration || {};
    const layers = model.layers || [];
    const svgId = `ensemble-${Math.random().toString(36).slice(2, 8)}`;
    const unresolvedFill = `url(#unresolved-${svgId})`;
    const colorRegions = model.colorMap?.regions || candidate.palette?.regions || [];
    const regionColors = new Map(colorRegions.map((region) => [region.id, region]));
    const paletteRoles = candidate.palette?.roles || [];
    const topLayer = layers.find((layer) => layer.kind === "top") || {};
    const dressLayer = layers.find((layer) => layer.kind === "dress") || {};
    const outerLayer = layers.find((layer) => layer.kind === "outer") || {};
    const bottomLayer = layers.find((layer) => layer.kind === "bottom") || {};
    const isDress = Boolean(dressLayer.visible) || candidate.form === "onePieceDress" || Boolean(candidate.garments?.dress);

    const colorFor = (regionId, layer, preferredRoles) => {
      const region = regionColors.get(regionId);
      const role = preferredRoles.map((roleName) => paletteRoles.find((item) => item.role === roleName && item.hex)).find(Boolean);
      const hex = region?.hex || layer?.color || role?.hex || null;
      return {
        hex,
        fill: hex || unresolvedFill,
        colorName: region?.colorName || layer?.colorName || role?.colorName || "待确认",
        ratio: Number(region?.ratio || layer?.ratio || role?.ratio || 0),
        resolved: Boolean(hex)
      };
    };

    const topColor = isDress
      ? colorFor("dress", dressLayer, ["main", "nearFace"])
      : colorFor("top", topLayer, ["nearFace", "secondary"]);
    const bottomColor = isDress ? topColor : colorFor("bottom", bottomLayer, ["main", "secondary"]);
    const outerColor = colorFor("outer", outerLayer, ["secondary", "main"]);
    const accentColor = colorFor("accent", null, ["accent", "secondary", "main"]);

    const outerVisible = outerLayer.visible !== false
      && outerLayer.type !== "none"
      && Boolean(candidate.garments?.outer && candidate.garments.outer !== "无外层");
    const bottomType = isDress ? "dress" : bottomLayer.type || bottomLayer.bottomType || candidate.bottomType || "trouser";
    const bottomCut = candidateResult(candidate).garment?.bottomCut || candidate.bottomCut || bottomLayer.attributes?.bottomCut || "straightLeg";
    const dressCut = candidateResult(candidate).garment?.dressCut || candidate.dressCut || dressLayer.dressCut || "aLineMidi";
    const sleeve = (isDress ? dressLayer.sleeve : topLayer.sleeve) || candidate.sleeve || "long";
    const neckline = model.neckline || candidate.neckline || "regular";
    const waist = model.waist || candidate.waist || "natural";
    const topAttributes = topLayer.attributes || model.geometry?.top || {};
    const outerAttributes = outerLayer.attributes || model.geometry?.outer || {};
    const bottomAttributes = bottomLayer.attributes || model.geometry?.bottom || {};
    const dressAttributes = dressLayer.attributes || model.geometry?.dress || {};
    const topName = candidate.garments?.top || "";
    const dressName = candidate.garments?.dress || "";
    const outerName = candidate.garments?.outer || "";
    const isShirt = /衬衫/.test(topName) || /衬衫/.test(dressName) || dressCut === "shirtDress";

    const rawPattern = model.pattern || candidate.patternDetail || null;
    const fallbackPatternTarget = rawPattern?.placement === "上装" ? "top"
      : rawPattern?.placement === "外层" ? "outer"
        : rawPattern?.placement === "下装" ? "bottom"
          : ["连身裙", "连衣裙"].includes(rawPattern?.placement) ? "dress" : null;
    const requestedPatternTarget = rawPattern?.target || fallbackPatternTarget;
    const patternTarget = requestedPatternTarget === "outer" && !outerVisible
      ? (isDress ? "dress" : "bottom")
      : requestedPatternTarget;
    const pattern = rawPattern ? { ...rawPattern, target: patternTarget } : null;
    const targetColor = ({ top: topColor, outer: outerColor, bottom: bottomColor, dress: topColor })[patternTarget] || topColor;
    const patternBase = targetColor.hex || "#fff7df";
    const patternInk = paletteRoles.find((role) => role.hex && role.hex !== patternBase)?.hex || accentColor.hex || "#263746";
    const patternOpacity = pattern?.contrast === "低" ? 0.28 : 0.5;
    const fabricFill = (target, color) => pattern?.target === target ? `url(#fabric-${svgId})` : color.fill;

    const topFill = fabricFill(isDress ? "dress" : "top", topColor);
    const bottomFill = fabricFill("bottom", bottomColor);
    const outerFill = fabricFill("outer", outerColor);
    const accentFill = accentColor.fill;
    const skin = "#ead2bf";
    const skinShade = "#cda98f";
    const detailInk = patternInk;
    const hairDepth = state.input?.appearance?.hairDepth;
    const hairTone = state.input?.appearance?.hairTone;
    const hairColor = hairDepth === "light" ? (hairTone === "warm" ? "#6a4c3b" : "#574b49") : hairTone === "warm" ? "#3f3029" : "#29282a";
    const hairStyle = PREVIEW_HAIR_STYLES.has(state.previewHairStyle) ? state.previewHairStyle : "short";
    const hairBack = {
      short: `<path d="M99 29 Q97 17 110 16 Q124 17 123 31 L121 43 Q117 39 117 33 Q110 27 102 31 Q103 39 99 43 Z" fill="${hairColor}"/>`,
      medium: `<path d="M99 28 Q97 16 110 15 Q124 16 124 30 Q128 44 124 62 Q118 67 113 60 L116 34 Q110 27 103 31 L105 60 Q101 67 95 62 Q92 44 99 28 Z" fill="${hairColor}"/>`,
      long: `<path d="M99 28 Q97 15 110 14 Q125 15 124 30 Q132 50 133 91 Q128 101 120 95 L116 35 Q110 27 103 31 L100 95 Q92 101 87 91 Q88 50 99 28 Z" fill="${hairColor}"/>`
    }[hairStyle];
    const hairFront = {
      short: `<path d="M100 28 Q102 17 111 17 Q120 17 123 27 Q115 23 108 24 Q103 25 100 28 Z" fill="${hairColor}"/><path d="M101 26 Q109 18 120 22" fill="none" stroke="#ffffff" stroke-opacity="0.24" stroke-width="0.9"/>`,
      medium: `<path d="M99 28 Q102 16 111 16 Q121 17 124 28 Q116 23 109 24 Q103 25 99 28 Z" fill="${hairColor}"/><path d="M101 25 Q110 17 121 22" fill="none" stroke="#ffffff" stroke-opacity="0.24" stroke-width="0.9"/>`,
      long: `<path d="M99 27 Q102 15 111 15 Q122 16 124 28 Q116 22 109 23 Q103 24 99 27 Z" fill="${hairColor}"/><path d="M101 24 Q110 16 121 21" fill="none" stroke="#ffffff" stroke-opacity="0.24" stroke-width="0.9"/>`
    }[hairStyle];

    const accessoryKey = (kind, canonicalKey, fallback = null) => {
      const modeled = (model.accessories || []).find((item) => item.kind === kind && item.visible !== false)?.key;
      return modeled || candidateResult(candidate).accessories?.[canonicalKey] || fallback;
    };
    const footwearKey = accessoryKey("footwear", "footwear", "loafersOxfords");
    const bagKey = accessoryKey("bag", "leatherGoods", null);
    const jewelryKey = accessoryKey("jewelry", "jewelry", null);
    const textileKey = accessoryKey("textile", "textile", null);

    const topFit = topAttributes.fitProfile || topAttributes.topFit || candidate.topFit || "regular";
    const shoulderLeft = topFit === "oversized" ? 89 : topFit === "fitted" ? 94 : 92;
    const shoulderRight = 220 - shoulderLeft;
    const waistLeft = topFit === "oversized" ? 91 : topFit === "fitted" ? 97 : 94;
    const waistRight = 220 - waistLeft;
    const topPath = `M${shoulderLeft} 55 Q110 61 ${shoulderRight} 55 L136 84 L${waistRight} 132 L${waistLeft} 132 L84 84 Z`;
    const sleeveEndY = sleeve === "short" ? 89 : sleeve === "threeQuarter" ? 112 : 133;
    const sleeveEndX = sleeve === "short" ? 79 : sleeve === "threeQuarter" ? 74 : 71;
    const innerSleeves = `
      <path d="M${shoulderLeft + 3} 58 Q84 63 ${sleeveEndX - 3} ${sleeveEndY - 5} Q${sleeveEndX} ${sleeveEndY + 2} ${sleeveEndX + 7} ${sleeveEndY} L${shoulderLeft + 9} 72 Z" fill="${topFill}"/>
      <path d="M${shoulderRight - 3} 58 Q136 63 ${220 - sleeveEndX + 3} ${sleeveEndY - 5} Q${220 - sleeveEndX} ${sleeveEndY + 2} ${220 - sleeveEndX - 7} ${sleeveEndY} L${shoulderRight - 9} 72 Z" fill="${topFill}"/>
      <path data-part="sleeve-cuff" d="M${sleeveEndX - 2} ${sleeveEndY - 3} L${sleeveEndX + 7} ${sleeveEndY - 1} M${213 - sleeveEndX} ${sleeveEndY - 1} L${222 - sleeveEndX} ${sleeveEndY - 3}" stroke="${detailInk}" stroke-opacity="0.45" stroke-width="1.2"/>
      ${sleeve === "long" ? `<circle cx="${sleeveEndX + 4}" cy="${sleeveEndY - 1}" r="1" fill="#c8a95e"/><circle cx="${216 - sleeveEndX}" cy="${sleeveEndY - 1}" r="1" fill="#c8a95e"/>` : ""}
    `;

    const necklineText = String(neckline);
    const isOpenNeckline = neckline === "open" || neckline === "vNeck" || necklineText.includes("V领") || necklineText.includes("开阔");
    const isSquareNeckline = neckline === "squareNeck" || necklineText.includes("方领");
    const isSoftNeckline = neckline === "softCurve" || neckline === "uNeck" || necklineText.includes("U领") || necklineText.includes("柔和");
    const necklineDetail = isShirt ? `
      <path d="M99 56 L109 67 L102 73 L94 59 Z M121 56 L111 67 L118 73 L126 59 Z" fill="#ffffff" fill-opacity="0.42" stroke="${detailInk}" stroke-opacity="0.2" stroke-width="0.7"/>
      <path data-part="shirt-placket" d="M110 67 L110 129" stroke="${detailInk}" stroke-opacity="0.3" stroke-width="1.1"/>
      ${[78, 89, 100, 111, 122].map((y) => `<circle cx="110" cy="${y}" r="1" fill="#ffffff" stroke="${detailInk}" stroke-opacity="0.35" stroke-width="0.45"/>`).join("")}
    ` : isOpenNeckline
      ? `<path d="M99 59 L110 78 L121 59" fill="${skin}" stroke="${skinShade}" stroke-opacity="0.35" stroke-width="0.8"/>`
      : isSquareNeckline
        ? `<path d="M99 58 L99 72 L121 72 L121 58" fill="${skin}" stroke="${skinShade}" stroke-opacity="0.35" stroke-width="0.8"/>`
        : isSoftNeckline
          ? `<path d="M99 59 Q110 76 121 59 Q110 67 99 59 Z" fill="${skin}"/>`
          : `<path d="M101 58 Q110 67 119 58 Q110 63 101 58 Z" fill="${skin}"/>`;

    const pantsBasePath = bottomCut === "wideLeg"
      ? "M80 126 L140 126 L149 250 L114 250 L110 158 L106 250 L71 250 Z"
      : bottomCut === "tapered"
        ? "M83 126 L137 126 L132 250 L113 250 L110 159 L107 250 L88 250 Z"
        : "M83 126 L137 126 L138 250 L113 250 L110 159 L107 250 L82 250 Z";
    const trousers = `
      <path d="${pantsBasePath}" fill="${bottomFill}"/>
      <path d="M83 126 L137 126 L136 133 L84 133 Z" fill="${detailInk}" fill-opacity="0.12"/>
      <circle cx="110" cy="130" r="1.7" fill="#c8a95e"/>
      <path d="M87 135 L96 146 M133 135 L124 146" fill="none" stroke="${detailInk}" stroke-opacity="0.38" stroke-width="1.25"/>
      <path data-part="crease-line" d="M94 137 L93 248 M126 137 L127 248" fill="none" stroke="#ffffff" stroke-opacity="0.42" stroke-width="1.2"/>
      <path d="M95 138 L96 248 M125 138 L124 248" fill="none" stroke="${detailInk}" stroke-opacity="0.16" stroke-width="0.7"/>
    `;
    const shorts = `
      <path d="M81 126 L139 126 L143 188 L114 188 L110 153 L106 188 L77 188 Z" fill="${bottomFill}"/>
      <path d="M82 126 L138 126 L137 133 L83 133 Z" fill="${detailInk}" fill-opacity="0.12"/>
      <circle cx="110" cy="130" r="1.7" fill="#c8a95e"/><path d="M87 136 L96 146 M133 136 L124 146" stroke="${detailInk}" stroke-opacity="0.38" stroke-width="1.2"/>
    `;
    const skirtPath = bottomCut === "straightSkirt"
      ? "M83 126 L137 126 L140 238 Q110 243 80 238 Z"
      : "M82 126 L138 126 L160 240 Q110 250 60 240 Z";
    const skirt = `
      <path d="${skirtPath}" fill="${bottomFill}"/>
      <path d="M83 126 L137 126 L136 133 L84 133 Z" fill="${detailInk}" fill-opacity="0.12"/>
      <path d="M96 134 Q92 188 82 240 M124 134 Q128 188 138 240" fill="none" stroke="#ffffff" stroke-opacity="0.34" stroke-width="1.15"/>
    `;
    const bottomShape = bottomType === "short" ? shorts
      : bottomType === "skirt" || ["aLineSkirt", "straightSkirt"].includes(bottomCut) ? skirt
        : trousers;

    const dressBasePath = dressCut === "columnDress"
      ? "M94 55 L126 55 L136 108 L139 244 Q110 248 81 244 L84 108 Z"
      : dressCut === "shirtDress"
        ? "M92 55 L128 55 L138 106 L149 244 Q110 250 71 244 L82 106 Z"
        : dressCut === "wrapDress"
          ? "M91 55 L129 55 L141 106 L160 242 Q110 252 60 242 L79 106 Z"
          : "M92 55 L128 55 L142 106 L162 242 Q110 252 58 242 L78 106 Z";
    const dressDetails = `
      ${dressCut === "shirtDress" ? `<path d="M99 56 L110 67 L102 72 L95 59 Z M121 56 L110 67 L118 72 L125 59 Z" fill="#ffffff" fill-opacity="0.38"/><path d="M110 67 L110 237" stroke="${detailInk}" stroke-opacity="0.32" stroke-width="1.1"/>${[80, 94, 108].map((y) => `<circle cx="110" cy="${y}" r="1" fill="#ffffff"/>`).join("")}` : ""}
      ${dressCut === "wrapDress" ? `<path d="M94 60 L121 111 L92 122" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1.8"/>` : ""}
      <path d="M87 115 Q110 120 133 115" fill="none" stroke="${detailInk}" stroke-opacity="0.45" stroke-width="2.2"/>
      <path d="M110 117 C102 109 96 113 101 120 C105 123 109 120 110 117 C111 120 115 123 119 120 C124 113 118 109 110 117 Z" fill="${accentFill}"/>
      <path d="M107 121 L103 139 M113 121 L117 139" stroke="${accentFill}" stroke-width="1.8"/>
      <path d="M93 126 Q87 188 78 243 M127 126 Q133 188 142 243" fill="none" stroke="#ffffff" stroke-opacity="0.3" stroke-width="1.2"/>
    `;

    const outerStyle = outerAttributes.outerStyle || (/风衣/.test(outerName) ? "trench" : /西装/.test(outerName) ? "blazer" : /开衫|针织/.test(outerName) ? "cardigan" : /大衣|中长/.test(outerName) ? "coat" : "minimalJacket");
    const outerHem = ["trench", "coat"].includes(outerStyle) ? 218 : outerStyle === "minimalJacket" ? 158 : 170;
    const outerSleeves = `
      <path d="M91 58 Q82 61 78 76 L68 128 Q70 135 77 132 L91 79 Z" fill="${outerFill}"/>
      <path d="M129 58 Q138 61 142 76 L152 128 Q150 135 143 132 L129 79 Z" fill="${outerFill}"/>
      <path d="M68 126 L77 129 M143 129 L152 126" stroke="${detailInk}" stroke-opacity="0.45" stroke-width="1.2"/>
      <circle cx="75" cy="130" r="1" fill="#c8a95e"/><circle cx="145" cy="130" r="1" fill="#c8a95e"/>
    `;
    const outerPanels = outerStyle === "cardigan" ? `
      <path d="M91 55 L103 61 L104 ${outerHem} L80 ${outerHem - 3} L82 82 Z M129 55 L117 61 L116 ${outerHem} L140 ${outerHem - 3} L138 82 Z" fill="${outerFill}"/>
      <path d="M103 61 L104 ${outerHem} M117 61 L116 ${outerHem}" stroke="${detailInk}" stroke-opacity="0.45" stroke-width="2"/>
      ${[78, 92, 106, 120, 134, 148].filter((y) => y < outerHem - 4).map((y) => `<circle cx="116" cy="${y}" r="1.4" fill="#c8a95e"/>`).join("")}
    ` : `
      <path d="M91 55 L103 61 L106 88 L104 ${outerHem} L79 ${outerHem - 3} L82 82 Z" fill="${outerFill}"/>
      <path d="M129 55 L117 61 L114 88 L116 ${outerHem} L141 ${outerHem - 3} L138 82 Z" fill="${outerFill}"/>
      <path d="M103 61 L106 88 L96 79 L88 59 Z M117 61 L114 88 L124 79 L132 59 Z" fill="#ffffff" fill-opacity="0.22" stroke="${detailInk}" stroke-opacity="0.3" stroke-width="0.8"/>
      <path d="M86 116 L99 113 M134 116 L121 113" stroke="${detailInk}" stroke-opacity="0.38" stroke-width="1.3"/>
      ${outerStyle === "trench" ? `<path d="M81 143 L103 145 M117 145 L139 143" stroke="${detailInk}" stroke-opacity="0.5" stroke-width="2.5"/><circle cx="96" cy="104" r="1.4" fill="${detailInk}"/><circle cx="124" cy="104" r="1.4" fill="${detailInk}"/>` : `<circle cx="103" cy="128" r="1.5" fill="${detailInk}" stroke="#c8a95e" stroke-width="0.45"/>`}
    `;

    const footwearSvg = {
      loafersOxfords: `
        <path d="M81 249 Q91 244 104 249 L103 263 Q91 266 80 261 Z M116 249 Q129 244 139 249 L140 261 Q129 266 117 263 Z" fill="${accentFill}"/>
        <path d="M84 251 Q92 247 101 251 M119 251 Q128 247 136 251" fill="none" stroke="#ffffff" stroke-opacity="0.42" stroke-width="1.1"/>
        <path data-part="horsebit" d="M88 253 L99 253 M121 253 L132 253" stroke="#c8a95e" stroke-width="1.7"/><circle cx="89" cy="253" r="1.3" fill="none" stroke="#c8a95e"/><circle cx="131" cy="253" r="1.3" fill="none" stroke="#c8a95e"/>
      `,
      kittenHeels: `<path d="M80 252 Q92 246 105 252 L99 263 L84 263 Z M115 252 Q128 246 140 252 L136 263 L121 263 Z" fill="${accentFill}"/><path d="M84 262 L83 269 M136 262 L137 269" stroke="${accentFill}" stroke-width="1.8"/>`,
      boots: `<path d="M82 235 L104 235 L104 262 Q91 266 80 261 L82 235 Z M116 235 L138 235 L140 261 Q129 266 116 262 Z" fill="${accentFill}"/><path d="M88 243 L99 243 M121 243 L132 243" stroke="#ffffff" stroke-opacity="0.25"/>`,
      minimalSneakers: `<path d="M80 251 Q92 244 105 250 L103 262 L80 262 Z M115 250 Q128 244 140 251 L140 262 L117 262 Z" fill="${accentFill}"/><path d="M80 261 L104 261 M116 261 L140 261" stroke="#ffffff" stroke-width="2.4"/><path d="M88 252 L99 257 M121 257 L132 252" stroke="#ffffff" stroke-opacity="0.7"/>`
    }[footwearKey] || "";

    const bagSvg = {
      structuredTote: `
        <path d="M151 146 L179 146 L176 183 L148 183 Z" fill="${accentFill}"/>
        <path data-part="tote-handles" d="M155 147 Q154 129 164 129 Q174 129 173 147 M160 147 Q160 136 165 136 Q170 136 170 147" fill="none" stroke="${accentFill}" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M151 149 L178 149" stroke="#ffffff" stroke-opacity="0.25"/><circle cx="154" cy="149" r="1.2" fill="#c8a95e"/><circle cx="174" cy="149" r="1.2" fill="#c8a95e"/>
      `,
      shoulderBag: `<path d="M146 105 Q148 89 158 89 Q168 89 171 105" fill="none" stroke="${accentFill}" stroke-width="2.3"/><path d="M144 104 Q158 99 173 104 L169 129 Q158 134 147 129 Z" fill="${accentFill}"/><circle cx="158" cy="111" r="1.6" fill="#c8a95e"/>`,
      crossbody: `<path d="M98 59 Q126 91 156 137" fill="none" stroke="${accentFill}" stroke-width="1.8"/><path d="M147 134 L170 134 L169 155 L146 155 Z" fill="${accentFill}"/><circle cx="158" cy="141" r="1.5" fill="#c8a95e"/>`,
      slimBelt: `<path d="M88 126 L132 126" stroke="${accentFill}" stroke-width="3"/><rect x="107" y="123" width="6" height="6" rx="1" fill="#c8a95e"/>`
    }[bagKey] || "";
    const jewelrySvg = jewelryKey ? `<path d="M103 54 Q110 68 117 54" fill="none" stroke="${accentFill}" stroke-width="1.1"/><circle cx="110" cy="67" r="1.8" fill="${accentFill}"/>` : "";
    const textileSvg = textileKey && textileKey !== "none" ? `<path d="M100 55 L110 70 L120 55 L116 52 L110 62 L104 52 Z" fill="${accentFill}"/><path d="M106 65 L102 86 M114 65 L118 86" stroke="${accentFill}" stroke-width="1.7"/>` : "";
    const handY = outerVisible ? 133 : sleeveEndY + 2;
    const handX = outerVisible ? 72 : sleeveEndX + 3;

    return `
      <div class="outfit-illustration" data-illustration-type="${escapeHtml(model.type || "outfit-schematic")}" data-renderer="integrated-ensemble">
        <svg class="illustration-svg" viewBox="0 0 220 280" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeHtml(candidate.title || "一体化穿搭上身效果图")}" data-canvas="220x280" data-pattern-target="${escapeHtml(patternTarget || "none")}">
          <defs>
            <filter id="garment-${svgId}" x="-20%" y="-20%" width="140%" height="150%">
              <feDropShadow dx="0" dy="2.4" stdDeviation="1.8" flood-color="#17231d" flood-opacity="0.14"/>
            </filter>
            <pattern id="unresolved-${svgId}" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#fff7df"/><path d="M0 8 L8 0" stroke="#bd7b1d" stroke-width="1" stroke-opacity="0.45"/></pattern>
            <pattern id="fabric-${svgId}" width="${pattern?.id === "maritimeStripe" ? 18 : 12}" height="${pattern?.id === "maritimeStripe" ? 8 : 12}" patternUnits="userSpaceOnUse">
              <rect width="100%" height="100%" fill="${patternBase}"/>
              ${pattern?.id === "maritimeStripe" ? `<path d="M0 2 H18 M0 6 H18" stroke="${patternInk}" stroke-width="2" stroke-opacity="${patternOpacity}"/>` : ""}
              ${pattern?.id === "princeOfWales" ? `<path d="M0 0 H12 M0 6 H12 M0 0 V12 M6 0 V12" stroke="${patternInk}" stroke-width="0.65" stroke-opacity="${patternOpacity}"/><path d="M3 0 V12 M9 0 V12 M0 3 H12 M0 9 H12" stroke="#ffffff" stroke-width="0.45" stroke-opacity="0.28"/>` : ""}
              ${pattern?.id === "houndstooth" ? `<path d="M0 0 H5 L8 3 L5 6 H0 Z M6 6 H11 L12 7 V12 H8 L5 9 Z" fill="${patternInk}" fill-opacity="${patternOpacity}"/>` : ""}
              ${pattern?.id === "frenchPolkaDot" ? `<circle cx="3" cy="3" r="1.5" fill="${patternInk}" fill-opacity="${patternOpacity}"/><circle cx="9" cy="9" r="1.5" fill="${patternInk}" fill-opacity="${patternOpacity}"/>` : ""}
              ${pattern?.id === "smallFloral" ? `<g fill="${patternInk}" fill-opacity="${patternOpacity}"><circle cx="3" cy="1.5" r="1.1"/><circle cx="4.5" cy="3" r="1.1"/><circle cx="3" cy="4.5" r="1.1"/><circle cx="1.5" cy="3" r="1.1"/></g><path d="M3 4.5 L5.5 8" stroke="${patternInk}" stroke-opacity="${patternOpacity}" stroke-width="0.65"/>` : ""}
            </pattern>
          </defs>

          <ellipse cx="110" cy="270" rx="52" ry="5" fill="#17231d" fill-opacity="0.09"/>

          <g data-layer="figure" aria-hidden="true">
            <path d="M96 124 L96 252 M124 124 L124 252" stroke="${skin}" stroke-width="8" stroke-linecap="round"/>
            <g data-hair-style="${hairStyle}">${hairBack}</g>
            <ellipse cx="110" cy="30" rx="9.5" ry="12.5" fill="${skin}"/>
            <circle cx="100" cy="31" r="2" fill="${skin}"/><circle cx="120" cy="31" r="2" fill="${skin}"/>
            <path d="M104 40 L104 56 Q110 61 116 56 L116 40 Z" fill="${skin}"/>
            ${hairFront}
            <path d="M106 37 Q110 39 114 37" fill="none" stroke="${skinShade}" stroke-opacity="0.55" stroke-width="0.8"/>
          </g>

          <g data-layer="inner" filter="url(#garment-${svgId})">
            ${isDress ? `${innerSleeves}<path d="${dressBasePath}" fill="${topFill}"/>${dressDetails}` : `${innerSleeves}<path d="${topPath}" fill="${topFill}"/>${necklineDetail}<path d="M${waistLeft} 128 L${waistRight} 128" stroke="${detailInk}" stroke-opacity="0.2" stroke-width="1"/>`}
          </g>

          ${isDress ? "" : `<g data-layer="bottom" filter="url(#garment-${svgId})">${bottomShape}</g>`}

          ${outerVisible ? `<g data-layer="outer" data-outer-open="true" filter="url(#garment-${svgId})">${outerSleeves}${outerPanels}</g>` : ""}

          <g data-layer="hands" aria-hidden="true">
            <ellipse cx="${handX}" cy="${handY}" rx="3.3" ry="4.5" fill="${skin}"/>
            <ellipse cx="${220 - handX}" cy="${handY}" rx="3.3" ry="4.5" fill="${skin}"/>
          </g>

          <g data-layer="footwear" filter="url(#garment-${svgId})">${footwearSvg}</g>
          <g data-layer="accessories" filter="url(#garment-${svgId})">${bagSvg}${jewelrySvg}${textileSvg}</g>
        </svg>
        <span class="illustration-caption">${escapeHtml(model.layerCount || candidate.layerCount || 1)}层 · ${escapeHtml(model.silhouette || candidate.silhouette || "整体轮廓")} · ${escapeHtml(translateValue(sleeve))}</span>
        ${model.validation?.colorComplete === false ? `<span class="illustration-warning">部分颜色待确认</span>` : ""}
      </div>
    `;
  }

  function renderCandidateCard(cand, index, result) {
    const palette = cand.palette || {};
    const roles = palette.roles || [];
    
    const garments = candidateGarmentEntries(cand);

    const familyMap = {
      straight: "简洁直线",
      tailored: "利落结构",
      soft: "柔和收放",
      relaxed: "自然留量",
      street: "街头箱型",
      retro: "复古收放"
    };
    const familyLabel = familyMap[cand.family] || cand.family || "利落结构";

    // Badge and rationale come from the candidate contract instead of card position.
    const featureBadge = index === 0 ? "基准推荐" : "差异方案";
    const featureClass = index === 0 ? "is-primary" : "is-alt";

    const diffRationale = cand.expectedEffect || "按当前输入生成候选组合。";

    // Difference pill
    const diffPill = cand.differenceSummary || "候选细节差异";

    return `
      <article class="candidate-card" data-index="${index}" data-candidate-id="${escapeHtml(cand.id || "")}" data-family="${escapeHtml(cand.family || "straight")}">
        <div class="candidate-card-head">
          <div class="candidate-card-meta">
            <span class="candidate-number">方案 ${index + 1}</span>
            <span class="candidate-feature-chip ${featureClass}">${featureBadge}</span>
            <span class="candidate-family-tag">${escapeHtml(familyLabel)}</span>
          </div>
          <div class="palette-strip" title="${escapeHtml(palette.name || "推荐配色")}">
            ${roles.map((r) => `<span style="background:${escapeHtml(r.hex || "transparent")};"></span>`).join("")}
          </div>
        </div>

        ${renderIllustration(cand.illustration, cand)}

        <h3 class="candidate-title" title="${escapeHtml(cand.name || "")}">
          <span class="candidate-name">${escapeHtml(cand.name || `方案 ${index + 1}`)}</span>
        </h3>

        ${isOnePieceCandidate(cand) ? renderOnePieceComponent(cand, roles) : `<div class="garment-color-list">
          ${garments.map((comp) => {
            const role = roleForGarment(roles, comp.category) || roles[0] || {};
            const categoryName = comp.category === "outer" ? "外层" : comp.category === "bottom" ? "下装" : comp.category === "dress" ? "连衣裙" : "上装";
            return `
              <div class="garment-color-item">
                <span class="garment-category">${categoryName}</span>
                <div class="garment-info">
                  <strong class="garment-name">${escapeHtml(comp.name)}</strong>
                  <span class="garment-color-pill">
                    <i style="background:${escapeHtml(role.hex || "transparent")}"></i>
                    ${escapeHtml(role.colorName || "基础色")} ${role.ratio ? `${role.ratio}%` : ""}
                  </span>
                  ${comp.category === "top" || comp.category === "dress" ? renderColorSpectrum(cand) : ""}
                </div>
              </div>
            `;
          }).join("")}
        </div>`}

        <div class="candidate-secondary-line">${renderPatternTag(cand)}</div>
        ${renderAccessoryLayers(cand)}

        <!-- 1-line Spec Pills -->
        <div class="candidate-spec-pills">
          <span>${cand.layerCount ? `${cand.layerCount}层` : "2层"}</span>
          <span>${escapeHtml(cand.silhouette || "利落结构")}</span>
          <span>${escapeHtml(familyLabel)}</span>
          <span>${escapeHtml(palette.temperature || "中间偏暖")}</span>
        </div>

        <!-- Diff-Focused Rationale -->
        <div class="expected-effect">
          <b>搭配考量</b>
          <p>${escapeHtml(diffRationale)}</p>
        </div>

        <div class="difference-line">
          <span>方案差异</span>
          <strong>${escapeHtml(diffPill)}</strong>
        </div>

        <button type="button" class="detail-button" data-candidate-index="${index}">查看方案详情与依据 →</button>
      </article>
    `;
  }

  function renderCandidateTable(candidates) {
    const container = $("#candidateTableView");
    const familyLabels = { straight: "简洁直线", tailored: "利落结构", soft: "柔和收放", relaxed: "自然留量", street: "街头箱型", retro: "复古收放" };
    container.innerHTML = `
      <div class="candidate-table-wrap">
        <table class="candidate-compare-table">
          <thead>
            <tr>
              <th class="table-dim-col">对比维度</th>
              ${candidates.map((cand, idx) => `
                <th><span class="table-cand-badge">方案 ${idx + 1} · ${familyLabels[cand.family] || "利落"}</span></th>
              `).join("")}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="table-row-label">方案名称</td>
              ${candidates.map((c) => `<td><strong>${escapeHtml(c.name || c.title)}</strong></td>`).join("")}
            </tr>
            <tr>
              <td class="table-row-label">单品组合</td>
              ${candidates.map((c) => `<td>${candidateGarmentNames(c).map(escapeHtml).join(" ＋ ")}</td>`).join("")}
            </tr>
            <tr>
              <td class="table-row-label">结构与层数</td>
              ${candidates.map((c) => `<td>${c.layerCount ? `${c.layerCount}层` : "2层"} · ${escapeHtml(c.silhouette || "常规")}</td>`).join("")}
            </tr>
            <tr>
              <td class="table-row-label">配色方案</td>
              ${candidates.map((c) => `<td><div style="display:flex;align-items:center;gap:6px;"><span class="palette-strip" style="height:14px;border-radius:2px;overflow:hidden;display:flex;">${(c.palette?.roles || []).map((r) => `<span style="background:${r.hex || 'transparent'};width:10px;height:14px;display:inline-block;"></span>`).join("")}</span><span>${escapeHtml(c.palette?.name || "经典配色")}</span></div></td>`).join("")}
            </tr>
            <tr>
              <td class="table-row-label">花色重点</td>
              ${candidates.map((c) => `<td>${escapeHtml(c.patternDetail ? `${c.patternDetail.name} · ${c.patternDetail.placement}` : "纯色或低存在感纹理")}</td>`).join("")}
            </tr>
            <tr>
              <td class="table-row-label">鞋履与选配</td>
              ${candidates.map((c) => { const layers = candidateAccessoryLayers(c); return `<td>鞋履：${escapeHtml(layers.footwear || "待确认")}；选配：${escapeHtml(layers.optional.join("、") || "无需额外配饰")}</td>`; }).join("")}
            </tr>
            <tr>
              <td class="table-row-label">核心考量</td>
              ${candidates.map((c) => `<td>${escapeHtml(c.expectedEffect || c.differenceSummary || "按当前输入生成")}</td>`).join("")}
            </tr>
            <tr>
              <td class="table-row-label">操作</td>
              ${candidates.map((c, i) => `<td><button type="button" class="text-button" data-candidate-index="${i}">查看详情 →</button></td>`).join("")}
            </tr>
          </tbody>
        </table>
      </div>
      <div class="candidate-mobile-compare">
        ${candidates.map((c, i) => `
          <div class="mobile-candidate-card">
            <div class="mobile-candidate-header">
              <span class="table-cand-badge">方案 ${i + 1} · ${familyLabels[c.family] || "利落"}</span>
              <strong>${escapeHtml(c.name || c.title)}</strong>
            </div>
            <div class="mobile-candidate-body">
              <div class="mobile-candidate-row">
                <span class="mobile-candidate-label">单品组合</span>
                <span>${candidateGarmentNames(c).map(escapeHtml).join(" ＋ ")}</span>
              </div>
              <div class="mobile-candidate-row">
                <span class="mobile-candidate-label">结构与层数</span>
                <span>${c.layerCount ? `${c.layerCount}层` : "2层"} · ${escapeHtml(c.silhouette || "常规")}</span>
              </div>
              <div class="mobile-candidate-row">
                <span class="mobile-candidate-label">配色方案</span>
                <div style="display:flex;align-items:center;gap:6px;">
                  <span class="palette-strip" style="height:14px;border-radius:2px;overflow:hidden;display:flex;">
                    ${(c.palette?.roles || []).map((r) => `<span style="background:${r.hex || 'transparent'};width:10px;height:14px;display:inline-block;"></span>`).join("")}
                  </span>
                  <span>${escapeHtml(c.palette?.name || "经典配色")}</span>
                </div>
              </div>
              <div class="mobile-candidate-row">
                <span class="mobile-candidate-label">花色重点</span>
                <span>${escapeHtml(c.patternDetail ? `${c.patternDetail.name} · ${c.patternDetail.placement}` : "纯色或低存在感纹理")}</span>
              </div>
              <div class="mobile-candidate-row">
                <span class="mobile-candidate-label">核心考量</span>
                <span class="mobile-candidate-desc">${escapeHtml(c.expectedEffect || c.differenceSummary || "按当前输入生成")}</span>
              </div>
            </div>
            <div class="mobile-candidate-footer">
              <button type="button" class="text-button" data-candidate-index="${i}">查看详情 →</button>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function openCandidate(index) {
    const result = state.lastResult;
    if (!result || !result.candidates[index]) return;
    const cand = result.candidates[index];
    const palette = cand.palette || {};
    const roles = palette.roles || [];
    const dialog = $("#candidateDialog");

    $("#dialogCandidateName").textContent = `方案 ${index + 1} · ${cand.title || cand.name || "候选方案"}`;
    $("#dialogCandidateTitle").textContent = cand.title || cand.name || "候选方案";

    const garmentsHtml = (cand.components || []).map((comp) => {
      const role = roleForGarment(roles, comp.category) || roles[0] || {};
      return `
        <span>
          <small>${comp.category === "top" ? "上装" : comp.category === "outer" ? "外层" : comp.category === "dress" ? "连身裙" : "下装"}</small>
          <strong>${escapeHtml(comp.name)}</strong>
          <small style="margin-top:4px;color:var(--text-soft);">${escapeHtml(role.colorName || "基础色")} (${role.ratio || 0}%)</small>
        </span>
      `;
    }).join("");

    const canonicalAccessories = candidateResult(cand).accessories || {};
    const accessoryLayers = candidateAccessoryLayers(cand);
    const footwearHtml = canonicalAccessories.footwear ? `<span><small>鞋履</small><strong>${escapeHtml(canonicalAccessoryName("footwear", canonicalAccessories.footwear))}</strong></span>` : "";
    const conditionalAccessoriesHtml = accessoryLayers.conditional.map((value) => `<span><small>条件必需</small><strong>${escapeHtml(value)}</strong></span>`).join("");
    const optionalAccessoriesHtml = accessoryLayers.optional.map((value) => `<span><strong>${escapeHtml(value)}</strong></span>`).join("") || `<span><strong>无需额外配饰</strong></span>`;
    const canonicalFramework = candidateResult(cand).framework || {};
    const canonicalGarment = candidateResult(cand).garment || {};
    const canonicalGarmentHtml = [
      ["方案形态", canonicalGarmentLabels.form[canonicalFramework.form]],
      ["上装松紧", isOnePieceCandidate(cand) ? null : canonicalGarmentLabels.topFit[canonicalGarment.topFit]],
      ["下装版型", isOnePieceCandidate(cand) ? null : canonicalGarmentLabels.bottomCut[canonicalGarment.bottomCut]],
      ["连身裙型", isOnePieceCandidate(cand) ? canonicalGarmentLabels.dressCut[canonicalGarment.dressCut] : null]
    ].filter(([, value]) => value).map(([label, value]) => `<span><small>${label}</small><strong>${value}</strong></span>`).join("");
    const onePieceSpecHtml = isOnePieceCandidate(cand) ? `<div class="dialog-one-piece-spec">${onePieceDetails(cand).map(([label, value]) => `<span><small>${label}</small><strong>${escapeHtml(value)}</strong></span>`).join("")}</div>` : "";

    const paletteHtml = roles.map((role) => `
      <span>
        <i style="background:${escapeHtml(role.hex || "transparent")}"></i>
        <div>
          <small>${escapeHtml(role.garment || (role.role === "nearFace" ? "上装" : role.role === "main" ? "下装" : "点缀"))}</small>
          <strong>${escapeHtml(role.colorName || "基础色")} ${role.ratio || 0}%</strong>
        </div>
      </span>
    `).join("");

    const hardHtml = (cand.hardRequirements || cand.hardRequirementsMet || []).map((req) => `
      <li><strong>${escapeHtml(req.name)}</strong><span>${escapeHtml(req.summary || req.detail)}</span></li>
    `).join("") || `<li><span>无特殊硬性条件</span></li>`;

    const implHtml = (cand.implementations || (cand.softReasons || []).map((reason) => ({ relationName: reason.name, actionSummary: reason.text }))).map((imp) => `
      <li><strong>${escapeHtml(imp.relationName)}</strong><span>${escapeHtml(imp.actionSummary)}</span></li>
    `).join("") || `<li><span>无额外映射</span></li>`;

    const goalAssessment = cand.goalAssessment || null;
    const goalHtml = goalAssessment && goalAssessment.status !== "未设置目标" ? `
      <div class="decision-status ${goalAssessment.status === "完全满足" ? "is-good" : goalAssessment.status === "部分满足" ? "is-partial" : "is-muted"}">${escapeHtml(goalAssessment.status)}</div>
      <ul class="evidence-list">${(goalAssessment.items || []).map((item) => `<li><strong>${escapeHtml(item.label)} · ${escapeHtml(item.status)}</strong><span>${escapeHtml(item.detail)}</span></li>`).join("")}</ul>
    ` : `<p class="dialog-muted">本次未设置可调整目标，方案按基础骨架与风格偏好生成。</p>`;
    const boundaryActions = cand.decisionRecord?.boundaryActions || result.decisionRecord?.boundaryActions || [];
    const boundaryHtml = boundaryActions.length ? `<ul class="evidence-list">${boundaryActions.map((action) => `<li><strong>${escapeHtml(action.label || "穿着边界")} · ${action.status === "rewritten" ? "已改写" : "自然满足"}</strong><span>${(action.changes || []).map((change) => change.status === "rewritten" ? `${escapeHtml(change.field)}：${escapeHtml(String(change.before ?? "未设置"))} → ${escapeHtml(String(change.after))}` : `${escapeHtml(change.field)}：已在允许范围内`).join("；")}</span></li>`).join("")}</ul>` : `<p class="dialog-muted">本次未启用穿着边界。</p>`;

    const unverifiedHtml = (cand.unverified || []).map((unv) => `
      <article class="verification-card">
        <div class="verification-head">
          <strong>${escapeHtml(unv.field || unv.item)}</strong>
          <span class="impact-badge ${unv.impact ? "is-impact" : ""}">${unv.impact ? "影响方案成立" : "不改变路线"}</span>
        </div>
        <p><b>怎么验证：</b>${escapeHtml(unv.howToVerify || unv.validation)}</p>
        <p><b>失败条件：</b>${escapeHtml(unv.failureCondition || unv.failure)}</p>
      </article>
    `).join("");

    $("#candidateDetailContent").innerHTML = `
      <section class="dialog-section dialog-illustration-section">
        <h3>简易效果图</h3>
        ${renderIllustration(cand.illustration, cand)}
      </section>

      <section class="dialog-section">
        <h3>完整穿着单品</h3>
        <div class="dialog-garments">${garmentsHtml}${canonicalGarmentHtml}${footwearHtml}${conditionalAccessoriesHtml}</div>
        ${onePieceSpecHtml}
        <div class="dialog-pattern-line"><span>花色重点</span>${renderPatternTag(cand)}</div>
      </section>

      <section class="dialog-section optional-accessory-section">
        <h3>进阶选配建议</h3>
        <div class="dialog-garments">${optionalAccessoriesHtml}</div>
      </section>

      <section class="dialog-section">
        <h3>配色与占比</h3>
        <div class="dialog-palette">${paletteHtml}</div>
        <div class="dialog-color-spectrum">${renderColorSpectrum(cand)}</div>
      </section>

      <section class="dialog-section">
        <h3>预计上身效果</h3>
        <p>${escapeHtml(cand.expectedEffect || "")}</p>
      </section>

      <section class="dialog-section">
        <h3>目标调整</h3>
        ${goalHtml}
      </section>

      <section class="dialog-section">
        <h3>穿着边界仲裁</h3>
        ${boundaryHtml}
      </section>

      <section class="dialog-section">
        <h3>满足的硬性条件</h3>
        <ul class="evidence-list">${hardHtml}</ul>
      </section>

      <section class="dialog-section">
        <h3>本套如何落实</h3>
        <ul class="implementation-list">${implHtml}</ul>
      </section>

      <section class="dialog-section">
        <h3>需验证项与失败条件</h3>
        <div class="verification-list">${unverifiedHtml}</div>
      </section>
    `;

    dialog.showModal();
  }

  function trendDirectionName(val) {
    if (val === "none") return "不限定";
    const item = (state.ruleSet.trendDirections || []).find((d) => d.value === val);
    return item?.name || val;
  }

  function tempLabelText(val) {
    if (!val) return "10-18°C";
    return val.replace("_", "-") + "°C";
  }

  function occasionLabelText(val) {
    const map = { daily: "日常", commute: "通勤", formal: "正式", party: "聚会", trip: "出游" };
    return map[val] || val;
  }

  function faceLabelText(val) {
    const map = { round: "圆脸", square: "方脸", oval: "椭圆脸", long: "长脸" };
    return map[val] || val;
  }

  function styleLabelText(val) {
    const map = { urban: "都市", relaxed: "松弛", cityboy: "Cityboy", street: "街头" };
    return map[val] || val;
  }

  function formalityLabelText(val) {
    const map = { 1: "随性", 2: "整洁", 3: "偏正式", 4: "正式" };
    return map[val] || val;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function toast(message) {
    const element = $("#toast");
    element.textContent = message;
    element.classList.add("is-visible");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => element.classList.remove("is-visible"), 2500);
  }
})();
