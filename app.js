(function () {
  "use strict";

  const DATA = window.GarmentPrototypeData;
  const Engine = window.GarmentRuleEngine;
  const CANONICAL_INPUTS = window.GarmentCanonicalData?.fieldRegistry?.inputs || [];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const state = {
    input: Engine.clone(Engine.Store.loadInput()),
    activeTab: "context",
    selectedCandidateIndex: null,
    highlightRuleId: null,
    hoveredField: null,
    viewMode: "cards", // 'cards' | 'table'
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
    const result = Engine.run(state.input, state.ruleSet);
    state.lastResult = result;

    renderVersionChip();
    renderConditionSnapshot();
    renderInputTabs();
    renderInputs();
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
    $("#ruleVersion").textContent = `规则 ${state.ruleSet.meta?.version || "1.2.0"}`;
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
      `偏好：${styleLabel} · ${formalityLabel} · ${paletteLabel} · ${trendLabel}`,
      `目标：${goalLabel}`,
      `边界：${boundaryList.length ? boundaryList.join("、") : "无"}`
    ].join("；");

    $("#conditionSnapshot").innerHTML = `
      <div class="snapshot-inner">
        <span class="snapshot-label">已选条件</span>
        <div class="snapshot-badges">
          <button type="button" class="snapshot-chip" data-jump-group="context" title="场景条件：气温、场合与环境">场景: ${escapeHtml([tempLabel, occasionLabel, environmentLabel].filter(Boolean).join(" · "))}</button>
          <button type="button" class="snapshot-chip" data-jump-group="personal" title="${escapeHtml(fullSummary)}">特征: ${escapeHtml(skinToneLabel)} · ${escapeHtml(bodyPropLabel)} · ${escapeHtml(faceLabel)}</button>
          <button type="button" class="snapshot-chip" data-jump-group="preference" title="${escapeHtml(fullSummary)}">偏好: ${escapeHtml(styleLabel)} · ${escapeHtml(paletteLabel)} · ${escapeHtml(trendLabel)}</button>
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
      const trendOptions = canonicalParameter("preference.trendDirection");
      trendOptions.options = trendOptions.options.map((option) => ({
        ...option,
        label: (state.ruleSet.trendDirections || []).find((item) => item.value === option.value)?.name || option.label
      }));
      content.innerHTML = `<div class="preference-flow-grid field-stack-grid--preference">
        ${renderParameterScale("preference.style", "风格方向", styleOptions, "choice-flow")}
        ${renderParameterScale("preference.formality", "正式程度偏好", formalityOptions)}
        ${renderParameterScale("preference.palette", "色系偏好", paletteOptions)}
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
    const spectrum = candidate.canonicalOutput?.color?.nearFacePalette;
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
    const garment = candidate.canonicalOutput?.garment || {};
    const framework = candidate.canonicalOutput?.framework || {};
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
      <div class="one-piece-heading"><span>一件式主体</span><strong>${escapeHtml(candidate.garments?.dress || "连衣裙")}</strong><span class="garment-color-pill"><i style="background:${escapeHtml(role.hex || "#ccc")}"></i>${escapeHtml(role.colorName || "基础色")}</span>${renderColorSpectrum(candidate)}</div>
      <div class="one-piece-specs">${onePieceDetails(candidate).map(([label, value]) => `<span><small>${label}</small><strong>${escapeHtml(value)}</strong></span>`).join("")}</div>
    </section>`;
  }

  function candidateAccessoryLayers(candidate) {
    const accessories = candidate.canonicalOutput?.accessories || {};
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

  function renderIllustration(illustration, candidate) {
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
    const outerVisible = outerLayer.visible !== false && outerLayer.type !== "none" && Boolean(outerLayer.type);

    const bottomType = isDress ? "dress" : bottomLayer.type || bottomLayer.bottomType || candidate.bottomType || "trouser";
    const bottomCut = candidate.canonicalOutput?.garment?.bottomCut || candidate.bottomCut || "straightLeg";
    const dressCut = candidate.canonicalOutput?.garment?.dressCut || candidate.dressCut || dressLayer.dressCut || "aLineMidi";
    const sleeve = (isDress ? dressLayer.sleeve : topLayer.sleeve) || candidate.sleeve || "long";
    const neckline = model.neckline || candidate.neckline || "regular";
    const waist = model.waist || candidate.waist || "natural";
    const line = model.line || candidate.line || "balanced";
    const topAttributes = topLayer.attributes || model.geometry?.top || {};
    const outerAttributes = outerLayer.attributes || model.geometry?.outer || {};
    const bottomAttributes = bottomLayer.attributes || model.geometry?.bottom || {};
    const dressAttributes = dressLayer.attributes || model.geometry?.dress || {};
    const pattern = model.pattern || (candidate.patternDetail ? { ...candidate.patternDetail, target: "top" } : null);
    const patternTarget = pattern?.target || "top";
    const accessories = model.accessories || [];
    const accessoryKey = (kind, fallback = null) => accessories.find((item) => item.kind === kind)?.key || candidate.canonicalOutput?.accessories?.[kind === "bag" ? "leatherGoods" : kind] || fallback;
    const footwearKey = accessoryKey("footwear", "loafersOxfords");
    const bagKey = accessoryKey("bag", null);
    const jewelryKey = accessoryKey("jewelry", null);
    const textileKey = accessoryKey("textile", null);

    // Sleeve Geometry
    const shoulderWidth = topAttributes.shoulderWidth === "broad" ? 22 : topAttributes.shoulderWidth === "narrow" ? 15 : 18;
    const armWidth = topAttributes.sleeveWidth === "wide" ? 10 : 8;
    const shoulderLeft = 110 - shoulderWidth;
    const shoulderRight = 110 + shoulderWidth;
    const armPath = sleeve === "short"
      ? `<path d="M${shoulderLeft} 65 L${shoulderLeft - 17} 94 M${shoulderRight} 65 L${shoulderRight + 17} 94" fill="none" stroke="${topColor.hex}" stroke-width="${armWidth}" stroke-linecap="round"/>`
      : sleeve === "threeQuarter"
        ? `<path d="M${shoulderLeft} 65 L${shoulderLeft - 19} 108 M${shoulderRight} 65 L${shoulderRight + 19} 108" fill="none" stroke="${topColor.hex}" stroke-width="${armWidth}" stroke-linecap="round"/>`
        : `<path d="M${shoulderLeft} 65 L${shoulderLeft - 19} 124 M${shoulderRight} 65 L${shoulderRight + 19} 124" fill="none" stroke="${topColor.hex}" stroke-width="${armWidth}" stroke-linecap="round"/>`;

    // Neckline Geometry
    const necklineText = String(neckline);
    const isOpenNeckline = neckline === "open" || neckline === "vNeck" || necklineText.includes("V领") || necklineText.includes("开阔");
    const isSquareNeckline = neckline === "squareNeck" || necklineText.includes("方领");
    const isSoftNeckline = neckline === "softCurve" || neckline === "uNeck" || necklineText.includes("U领") || necklineText.includes("柔和");
    const necklinePath = isOpenNeckline
      ? `<path d="M97 72 L110 93 L123 72" fill="none" stroke="#ecd8c8" stroke-width="3" stroke-linecap="round"/>`
      : isSquareNeckline
        ? `<path d="M98 72 L98 87 L122 87 L122 72" fill="none" stroke="#ecd8c8" stroke-width="3"/>`
        : isSoftNeckline
          ? `<path d="M97 73 Q110 94 123 73" fill="none" stroke="#ecd8c8" stroke-width="3"/>`
          : `<path d="M99 73 Q110 84 121 73" fill="none" stroke="#ecd8c8" stroke-width="3"/>`;

    // Waistline Marker
    const waistY = waist === "raised" ? 110 : waist === "defined" ? 126 : 142;
    const waistMark = waist === "defined"
      ? `<path d="M86 ${waistY} L134 ${waistY}" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.5"/>`
      : waist === "raised"
        ? `<path d="M88 ${waistY} L132 ${waistY}" stroke="#ffffff" stroke-opacity="0.75" stroke-width="2" stroke-dasharray="4 3"/>`
        : "";

    // Trousers & Skirt Shapes: widths and lengths come from the component attributes.
    const legWidth = bottomAttributes.legWidth || (bottomCut === "wideLeg" ? "wide" : bottomCut === "tapered" ? "tapered" : "straight");
    const trouserShape = legWidth === "wide"
      ? `<path d="M76 148 L144 148 L151 238 L114 238 L110 168 L106 238 L69 238 Z" fill="${bottomColor.hex}"/>`
      : legWidth === "tapered"
        ? `<path d="M82 148 L138 148 L132 238 L112 238 L110 168 L108 238 L88 238 Z" fill="${bottomColor.hex}"/>`
        : `<path d="M82 148 L138 148 L138 238 L113 238 L110 168 L107 238 L82 238 Z" fill="${bottomColor.hex}"/>`;

    const bottomShape = bottomType === "skirt" || bottomCut === "aLineSkirt" || bottomCut === "straightSkirt"
      ? bottomAttributes.hemWidth === "narrow" || bottomCut === "straightSkirt"
        ? `<path d="M84 148 L136 148 L139 236 Q110 240 81 236 Z" fill="${bottomColor.hex}"/>`
        : `<path d="M80 148 L140 148 L158 234 Q110 244 62 234 Z" fill="${bottomColor.hex}"/>`
      : bottomType === "short"
        ? `<path d="M80 148 L140 148 L145 204 L114 204 L110 176 L106 204 L75 204 Z" fill="${bottomColor.hex}"/>`
        : trouserShape;

    // Dress Shapes
    const dressShape = {
      aLineMidi: `<path d="M92 58 L128 58 L142 108 L158 234 Q110 244 62 234 L78 108 Z" fill="${topColor.hex}"/>`,
      shirtDress: `<path d="M92 58 L128 58 L138 107 L144 235 Q110 241 76 235 L82 107 Z" fill="${topColor.hex}"/><path d="M110 74 L110 226" stroke="#ffffff" stroke-opacity="0.45" stroke-width="2"/><path d="M102 60 L110 68 L118 60" fill="none" stroke="#ffffff" stroke-opacity="0.6" stroke-width="1.8"/>`,
      wrapDress: `<path d="M92 58 L128 58 L140 108 L156 234 Q110 245 64 234 L80 108 Z" fill="${topColor.hex}"/><path d="M94 66 L124 114 L88 128" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="2"/>`,
      columnDress: `<path d="M92 58 L128 58 L136 108 L138 235 Q110 240 82 235 L84 108 Z" fill="${topColor.hex}"/>`
    }[dressCut] || `<path d="M92 58 L128 58 L142 108 L158 234 Q110 244 62 234 L78 108 Z" fill="${topColor.hex}"/>`;

    // Outer Shape: distinguish blazer, trench, coat, cardigan and jacket.
    const outerStyle = outerAttributes.outerStyle || (outerKind === "warm" ? "coat" : "minimalJacket");
    const outerShape = outerStyle === "blazer"
      ? `<path d="M84 56 L64 86 L70 172 L150 172 L156 86 L136 56 L124 74 L96 74 Z" fill="${outerColor.hex}" opacity="0.96"/><path d="M96 57 L104 88 L110 80 L116 88 L124 57" fill="none" stroke="#ffffff" stroke-opacity="0.7" stroke-width="2"/><path d="M80 130 L140 130" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1.4"/>`
      : outerStyle === "trench"
        ? `<path d="M84 56 L64 88 L70 216 L150 216 L156 88 L136 56 L124 74 L96 74 Z" fill="${outerColor.hex}" opacity="0.96"/><path d="M96 56 L104 88 L110 82 L116 88 L124 56" fill="none" stroke="#ffffff" stroke-opacity="0.65" stroke-width="2"/><path d="M72 142 L148 142" stroke="#ffffff" stroke-opacity="0.58" stroke-width="2.5"/><path d="M76 102 L92 96 M144 102 L128 96" stroke="#ffffff" stroke-opacity="0.42" stroke-width="2"/>`
        : outerStyle === "coat"
          ? `<path d="M84 56 L62 92 L70 218 Q110 224 150 218 L158 92 L136 56 L124 74 L96 74 Z" fill="${outerColor.hex}" opacity="0.97"/><path d="M95 56 L104 88 L110 82 L116 88 L125 56" fill="none" stroke="#ffffff" stroke-opacity="0.62" stroke-width="2.2"/>`
          : outerStyle === "cardigan"
            ? `<path d="M86 57 L66 90 L76 178 L98 178 L98 82 L110 74 L122 82 L122 178 L144 178 L154 90 L134 57 L122 75 L98 75 Z" fill="${outerColor.hex}" opacity="0.94"/><path d="M110 75 L110 178" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1.6"/>`
            : `<path d="M86 58 L68 88 L76 164 L144 164 L152 88 L134 58 L122 74 L98 74 Z" fill="${outerColor.hex}" opacity="0.96"/><path d="M96 58 L104 86 L110 80 L116 86 L124 58" fill="none" stroke="#ffffff" stroke-opacity="0.48" stroke-width="1.7"/>`;

    // Concrete Footwear
    const footwearSvg = {
      loafersOxfords: `<path d="M84 239 Q94 236 104 241 L102 251 L83 251 Q82 246 84 239 Z M116 241 Q126 236 136 239 L138 251 L119 251 Z" fill="${accentColor.hex}"/><line x1="90" y1="244" x2="99" y2="244" stroke="#d4af37" stroke-width="1.4"/><line x1="121" y1="244" x2="130" y2="244" stroke="#d4af37" stroke-width="1.4"/>`,
      kittenHeels: `<path d="M84 240 Q94 237 104 242 L101 250 L87 250 Z M116 242 Q126 237 136 240 L133 250 L119 250 Z" fill="${accentColor.hex}"/><path d="M88 250 L87 255 M132 250 L133 255" stroke="${accentColor.hex}" stroke-width="2"/>`,
      boots: `<path d="M84 226 L104 226 L104 250 L84 250 Z M116 226 L136 226 L136 250 L116 250 Z" fill="${accentColor.hex}"/><path d="M84 232 L104 232 M116 232 L136 232" stroke="#ffffff" stroke-opacity="0.22" stroke-width="1.5"/>`,
      minimalSneakers: `<path d="M84 240 Q94 237 104 241 L102 250 L83 250 Z M116 241 Q126 237 136 240 L138 250 L119 250 Z" fill="#eeeae0" stroke="${accentColor.hex}" stroke-opacity="0.45"/><line x1="85" y1="248" x2="103" y2="248" stroke="#ffffff" stroke-width="2"/><line x1="117" y1="248" x2="135" y2="248" stroke="#ffffff" stroke-width="2"/>`
    }[footwearKey] || `<path d="M84 239 Q94 236 104 241 L102 251 L83 251 Z M116 241 Q126 236 136 239 L138 251 L119 251 Z" fill="${accentColor.hex}"/>`;

    // Concrete Bags
    const bagSvg = {
      structuredTote: `<rect x="146" y="136" width="26" height="34" rx="2" fill="${accentColor.hex}"/><path d="M153 136 Q159 122 165 136" fill="none" stroke="${accentColor.hex}" stroke-width="2.4"/>`,
      shoulderBag: `<path d="M138 86 Q146 108 148 120 L162 118 Q158 102 146 84 Z" fill="${accentColor.hex}"/>`,
      crossbody: `<line x1="94" y1="58" x2="146" y2="132" stroke="${accentColor.hex}" stroke-width="2.2"/><rect x="140" y="128" width="22" height="18" rx="3" fill="${accentColor.hex}"/>`,
      slimBelt: `<rect x="86" y="125" width="48" height="4" rx="1" fill="${accentColor.hex}"/>`
    }[bagKey] || "";

    const jewelrySvg = jewelryKey && jewelryKey !== "none" ? `<circle cx="110" cy="91" r="3" fill="${accentColor.hex}"/><path d="M101 78 Q110 92 119 78" fill="none" stroke="${accentColor.hex}" stroke-width="1.2"/><circle cx="97" cy="58" r="2" fill="${accentColor.hex}"/><circle cx="123" cy="58" r="2" fill="${accentColor.hex}"/>` : "";
    const textileSvg = textileKey && textileKey !== "none" ? `<path d="M98 76 L110 92 L122 76 L118 72 L110 83 L102 72 Z" fill="${accentColor.hex}" opacity="0.92"/><path d="M103 83 L98 106 M117 83 L122 106" stroke="${accentColor.hex}" stroke-width="2"/>` : "";

    const svgId = `illu-${Math.random().toString(36).slice(2, 7)}`;
    const patternInk = pattern?.contrast === "低" ? "#243746" : "#ffffff";
    const patternOpacity = pattern?.contrast === "低" ? "0.24" : "0.38";
    const topPath = topAttributes.fitProfile === "oversized"
      ? "M86 56 L134 56 L148 94 L142 152 L78 152 L72 94 Z"
      : topAttributes.fitProfile === "fitted"
        ? "M96 56 L124 56 L138 94 L134 152 L86 152 L82 94 Z"
        : "M92 56 L128 56 L144 94 L138 152 L82 152 L76 94 Z";
    const patternShapes = {
      top: `<path d="${topPath}" fill="url(#pattern-${svgId})"/>`,
      outer: `<path d="M84 56 L64 90 L74 174 L146 174 L156 90 L136 56 L124 74 L96 74 Z" fill="url(#pattern-${svgId})" opacity="0.72"/>`,
      bottom: `<path d="M76 148 L144 148 L151 238 L114 238 L110 168 L106 238 L69 238 Z" fill="url(#pattern-${svgId})" opacity="0.72"/>`,
      dress: dressShape.replace(/fill="#[A-Fa-f0-9]+"/g, `fill="url(#pattern-${svgId})"`)
    }[patternTarget] || "";

    return `
      <div class="outfit-illustration" data-illustration-type="${escapeHtml(model.type || "outfit-schematic")}">
        <svg class="illustration-svg" viewBox="0 0 220 264" role="img" aria-label="${escapeHtml(candidate.title || "穿搭方案效果图")}">
          <defs>
            <filter id="shadow-${svgId}" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="2.2" flood-color="#1f2933" flood-opacity="0.18"/></filter>
            <pattern id="pattern-${svgId}" width="${pattern?.id === "maritimeStripe" ? 16 : 12}" height="${pattern?.id === "maritimeStripe" ? 6 : 12}" patternUnits="userSpaceOnUse">
              ${pattern?.id === "maritimeStripe" ? `<line x1="0" y1="3" x2="16" y2="3" stroke="${patternInk}" stroke-width="2.2" stroke-opacity="${patternOpacity}"/>` : ""}
              ${pattern?.id === "princeOfWales" || pattern?.id === "houndstooth" ? `<path d="M0 0h12v12H0z" fill="none"/><path d="M0 0h12M0 4h12M0 8h12M0 0v12M4 0v12M8 0v12" stroke="${patternInk}" stroke-width="0.75" stroke-opacity="${patternOpacity}"/>` : ""}
              ${pattern?.id === "frenchPolkaDot" ? `<circle cx="3" cy="3" r="1.8" fill="${patternInk}" fill-opacity="${patternOpacity}"/><circle cx="9" cy="9" r="1.8" fill="${patternInk}" fill-opacity="${patternOpacity}"/>` : ""}
              ${pattern?.id === "smallFloral" ? `<circle cx="3" cy="3" r="1.3" fill="${patternInk}" fill-opacity="${patternOpacity}"/><path d="M3 1v4M1 3h4" stroke="${patternInk}" stroke-width="0.8" stroke-opacity="${patternOpacity}"/>` : ""}
            </pattern>
          </defs>

          <!-- Stylized head, hair, neck and hands: a neutral garment figure, not a photo-real person. -->
          <ellipse cx="110" cy="35" rx="9" ry="12" fill="#ecd8c8" stroke="#d4b8a2" stroke-width="0.8"/>
          <ellipse cx="110" cy="20" rx="7" ry="5" fill="#2d2926"/>
          <path d="M96 34 C94 20 126 20 124 34 C126 40 122 46 118 48 C120 38 116 28 110 28 C104 28 100 38 102 48 C98 46 94 40 96 34 Z" fill="#2d2926"/>
          <path d="M101 34 Q110 49 119 34 L117 58 Q110 62 103 58 Z" fill="#ecd8c8"/>
          <path d="M103 58 Q110 62 117 58" stroke="#d4b8a2" stroke-width="1.2" fill="none" opacity="0.6"/>

          <ellipse cx="110" cy="254" rx="45" ry="4.5" fill="#1f2933" fill-opacity="0.1"/>

          <!-- Base Body / Dress -->
          <g filter="url(#shadow-${svgId})">
            ${isDress ? dressShape : `<path d="${topPath}" fill="${topColor.hex}"/>`}
            ${patternTarget === "top" || patternTarget === "dress" ? patternShapes : ""}
          </g>

          <!-- Arms -->
          ${armPath}
          <circle cx="${shoulderLeft - 19}" cy="${sleeve === "short" ? 94 : sleeve === "threeQuarter" ? 108 : 124}" r="3.4" fill="#ecd8c8"/>
          <circle cx="${shoulderRight + 19}" cy="${sleeve === "short" ? 94 : sleeve === "threeQuarter" ? 108 : 124}" r="3.4" fill="#ecd8c8"/>

          <!-- Outer Layer -->
          ${outerVisible ? `<g filter="url(#shadow-${svgId})">${outerShape}${patternTarget === "outer" ? patternShapes : ""}</g>` : ""}

          <!-- Bottom Separates -->
          ${isDress ? "" : `<g filter="url(#shadow-${svgId})">${bottomShape}${patternTarget === "bottom" ? patternShapes : ""}</g>`}

          <!-- Legs -->
          <path d="M96 235 L96 241 M124 235 L124 241" stroke="#ecd8c8" stroke-width="5" stroke-linecap="round"/>

          <!-- Concrete Footwear -->
          ${footwearSvg}

          <!-- Concrete Handbag -->
          ${bagSvg}

          <!-- Jewelry and textile detail -->
          ${jewelrySvg}
          ${textileSvg}

          <!-- Neckline, Waistline Markers -->
          ${necklinePath}
          ${waistMark}
        </svg>
        <span class="illustration-caption">${escapeHtml(model.layerCount || candidate.layerCount || 1)}层 · ${escapeHtml(model.silhouette || candidate.silhouette || "整体轮廓")} · ${escapeHtml(translateValue(sleeve))}</span>
        ${model.validation?.colorComplete === false ? `<span class="illustration-warning">颜色待确认</span>` : ""}
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
            ${roles.map((r) => `<span style="background:${escapeHtml(r.hex || "#ccc")};"></span>`).join("")}
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
                    <i style="background:${escapeHtml(role.hex || "#ccc")}"></i>
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
              ${candidates.map((c) => `<td><div style="display:flex;align-items:center;gap:6px;"><span class="palette-strip" style="height:14px;border-radius:2px;overflow:hidden;display:flex;">${(c.palette?.roles || []).map((r) => `<span style="background:${r.hex || '#ccc'};width:10px;height:14px;display:inline-block;"></span>`).join("")}</span><span>${escapeHtml(c.palette?.name || "经典配色")}</span></div></td>`).join("")}
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
                    ${(c.palette?.roles || []).map((r) => `<span style="background:${r.hex || '#ccc'};width:10px;height:14px;display:inline-block;"></span>`).join("")}
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

    const canonicalAccessories = cand.canonicalOutput?.accessories || {};
    const accessoryLayers = candidateAccessoryLayers(cand);
    const footwearHtml = canonicalAccessories.footwear ? `<span><small>鞋履</small><strong>${escapeHtml(canonicalAccessoryName("footwear", canonicalAccessories.footwear))}</strong></span>` : "";
    const conditionalAccessoriesHtml = accessoryLayers.conditional.map((value) => `<span><small>条件必需</small><strong>${escapeHtml(value)}</strong></span>`).join("");
    const optionalAccessoriesHtml = accessoryLayers.optional.map((value) => `<span><strong>${escapeHtml(value)}</strong></span>`).join("") || `<span><strong>无需额外配饰</strong></span>`;
    const canonicalFramework = cand.canonicalOutput?.framework || {};
    const canonicalGarment = cand.canonicalOutput?.garment || {};
    const canonicalGarmentHtml = [
      ["方案形态", canonicalGarmentLabels.form[canonicalFramework.form]],
      ["上装松紧", isOnePieceCandidate(cand) ? null : canonicalGarmentLabels.topFit[canonicalGarment.topFit]],
      ["下装版型", isOnePieceCandidate(cand) ? null : canonicalGarmentLabels.bottomCut[canonicalGarment.bottomCut]],
      ["连身裙型", isOnePieceCandidate(cand) ? canonicalGarmentLabels.dressCut[canonicalGarment.dressCut] : null]
    ].filter(([, value]) => value).map(([label, value]) => `<span><small>${label}</small><strong>${value}</strong></span>`).join("");
    const onePieceSpecHtml = isOnePieceCandidate(cand) ? `<div class="dialog-one-piece-spec">${onePieceDetails(cand).map(([label, value]) => `<span><small>${label}</small><strong>${escapeHtml(value)}</strong></span>`).join("")}</div>` : "";

    const paletteHtml = roles.map((role) => `
      <span>
        <i style="background:${escapeHtml(role.hex || "#ccc")}"></i>
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
