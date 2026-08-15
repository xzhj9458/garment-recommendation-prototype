(function () {
  "use strict";

  const DATA = window.GarmentPrototypeData;
  const Engine = window.GarmentRuleEngine;

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
    { id: "goal-boundaries", label: "本次目标与边界" }
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

  init();

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
      $(".candidate-mobile-compare"),
      $("#conditionSnapshot")
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

    const tempLabel = c.temperatureRange ? `${c.temperatureRange.replace("_", "-")}°C` : "气温适中";
    const occasionLabel = translateValue(c.occasion) || "待确认";
    const styleLabel = translateValue(p.style) || "未限定";
    const trendLabel = p.trendDirection && p.trendDirection !== "none" ? trendDirectionName(p.trendDirection) : "经典稳妥";
    const boundaryCount = Object.values(b).filter(Boolean).length;

    $("#conditionSnapshot").innerHTML = `
      <div class="snapshot-inner">
        <span class="snapshot-label">已选条件</span>
        <div class="snapshot-badges">
          <button type="button" class="snapshot-chip" data-jump-group="context" title="点击修改气温与场合">${escapeHtml(tempLabel)} · ${escapeHtml(occasionLabel)}</button>
          <button type="button" class="snapshot-chip" data-jump-group="preference" title="点击修改风格与潮流">${escapeHtml(styleLabel)} · ${escapeHtml(trendLabel)}</button>
          <button type="button" class="snapshot-chip" data-jump-group="goal-boundaries" title="点击修改本次目标">${g.endpoint && g.endpoint !== "unknown" ? translateValue(g.endpoint) : "保持原样"}</button>
          <button type="button" class="snapshot-chip ${boundaryCount ? "is-active" : ""}" data-jump-group="goal-boundaries" title="点击修改拒绝与边界">${boundaryCount ? `${boundaryCount}项边界` : "无边界"}</button>
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
    const parameter = (id) => state.ruleSet.parameters.find((item) => item.id === id) || DATA.defaultRuleSet.parameters.find((item) => item.id === id);

    if (group === "context") {
      const temperature = parameter("context.temperatureRange");
      const occasion = parameter("context.occasion");
      content.innerHTML = `<div class="input-form-compact">
        ${renderParameterScale("context.temperatureRange", "近期气温范围", temperature)}
        ${renderParameterScale("context.occasion", "使用场合", occasion)}
      </div>`;
    } else if (group === "personal") {
      const appearanceFields = [
        ["skin", "肤色"], ["hair", "发色"], ["eye", "眼睛颜色"]
      ];
      content.innerHTML = `
        <div class="input-section">
          <div class="input-section-heading"><strong>外观色彩</strong><span>用于判断近脸颜色的冷暖、明度和彩度</span></div>
          <div class="appearance-matrix-wrap">${appearanceFields.map(([part, label]) => `
            <div class="appearance-row-card">
              <div class="appearance-row-title"><strong>${label}</strong><span>用户确认的外观事实</span></div>
              <div class="appearance-row-scales">
                ${renderParameterScale(`appearance.${part}Temperature`, "冷暖", parameter(`appearance.${part}Temperature`))}
                ${renderParameterScale(`appearance.${part}Value`, "明度", parameter(`appearance.${part}Value`))}
                ${renderParameterScale(`appearance.${part}Chroma`, "彩度", parameter(`appearance.${part}Chroma`))}
              </div>
            </div>`).join("")}</div>
        </div>
        <div class="input-section">
          <div class="input-section-heading"><strong>身材情况</strong><span>身材不是脸型的子项，与脸型并列作为个人特征</span></div>
          <div class="field-stack-grid field-stack-grid--ranges">
            ${renderParameterScale("body.heightPresence", "身高表现", parameter("body.heightPresence"))}
            ${renderParameterScale("body.legRatio", "腿身比例（现状）", parameter("body.legRatio"))}
            ${renderParameterScale("body.waistDefinition", "腰部曲线明显度（现状）", parameter("body.waistDefinition"))}
            ${renderParameterScale("body.shoulderHipBalance", "肩胯轮廓关系（现状）", parameter("body.shoulderHipBalance"))}
          </div>
        </div>
        <div class="input-section input-section--face">
          <div class="input-section-heading"><strong>脸型</strong><span>只影响领口、发型和近脸线条提示，不承担身材判断</span></div>
          <div class="field-stack-grid--single">${renderParameterScale("face.shape", "脸型轮廓", parameter("face.shape"))}</div>
        </div>`;
    } else if (group === "preference") {
      const activeTrend = (state.ruleSet.trendDirections || []).find((item) => item.value === state.input.preference.trendDirection);
      const styleOptions = parameter("preference.style");
      const formalityOptions = parameter("preference.formality");
      const trendOptions = [{ value: "none", label: "不限定" }, ...(state.ruleSet.trendDirections || []).filter((item) => item.enabled !== false).map((item) => ({ value: item.value, label: item.name }))];
      content.innerHTML = `<div class="field-stack-grid--preference">
        ${renderParameterScale("preference.style", "风格方向", styleOptions, "choice-flow")}
        ${renderParameterScale("preference.formality", "正式程度偏好", formalityOptions)}
        ${renderTrendDirectionScale("preference.trendDirection", "潮流方向", state.input.preference.trendDirection, trendOptions)}
        ${state.input.preference.trendDirection !== "none" ? renderOptionScale("preference.trendIntensity", "潮流表达强度", state.input.preference.trendIntensity, parameter("preference.trendIntensity").options) : ""}
        ${activeTrend ? renderTrendSummary(activeTrend) : ""}
      </div>`;
    } else if (group === "goal-boundaries") {
      const endpoint = parameter("goal.endpoint");
      const direction = parameter("goal.direction");
      const boundaryFields = [
        ["rejectSkirt", "拒绝裙装", "排除所有裙装下装"],
        ["rejectDefinedWaist", "拒绝明显收腰", "排除明确腰位或高腰表达"],
        ["rejectHighContrast", "拒绝高对比配色", "配色对比不高于中等"],
        ["strictCoverage", "要求完整覆盖", "上下装都必须满足完整覆盖"],
        ["movementFriendly", "行动不能受限", "抬手、行走和坐下保持便利"],
        ["sensitiveTexture", "避免粗糙触感", "排除粗糙贴肤表面"]
      ];
      content.innerHTML = `
        <div class="input-section">
          <div class="input-section-heading"><strong>本次目标</strong><span>说明这次希望优先调整的视觉方向</span></div>
          <div class="field-stack-grid">
            ${renderParameterSelect("goal.endpoint", "本次调整目标", endpoint)}
            ${renderParameterSelect("goal.direction", "目标调整方向", direction)}
          </div>
        </div>
        <div class="input-section">
          <div class="input-section-heading"><strong>拒绝与边界</strong><span>明确不可接受的方案条件，优先级高于风格偏好</span></div>
          <div class="checkbox-grid">${boundaryFields.map(([field, title, desc]) => renderBooleanCheckbox(`boundaries.${field}`, title, desc)).join("")}</div>
        </div>`;
    }
  }

  function renderParameterScale(path, label, definition, variant = "") {
    const value = Engine.getByPath(state.input, path);
    if (definition?.type === "scale") return renderRangeScale(path, label, value, definition.options || []);
    return renderOptionScale(path, label, value, definition?.options || [], variant);
  }

  function renderRangeScale(path, label, value, options) {
    const normalized = options.map((option) => Array.isArray(option) ? { value: option[0], label: option[1] } : option);
    const selected = normalized.find((option) => String(option.value) === String(value)) || normalized[0];
    const [minLabel, maxLabel] = rangeEndpointLabels(path, normalized);
    return `<div class="form-item range-form-item">
      <div class="form-item-header"><label>${escapeHtml(label)}</label><strong>${escapeHtml(selected?.label || "需确认")}</strong></div>
      <div class="range-scale" role="radiogroup" aria-label="${escapeHtml(label)}">
        <span class="range-endpoint" aria-hidden="true">${escapeHtml(minLabel)}</span>
        <div class="range-track">
          ${normalized.map((option) => `<button type="button" class="range-step ${String(option.value) === String(value) ? "is-active" : ""}" data-input-path="${escapeHtml(path)}" data-input-value="${escapeHtml(option.value)}" data-value="${escapeHtml(option.value)}" aria-label="${escapeHtml(label)}：${escapeHtml(option.label)}" title="${escapeHtml(option.label)}"><span class="range-dot" aria-hidden="true"></span></button>`).join("")}
        </div>
        <span class="range-endpoint" aria-hidden="true">${escapeHtml(maxLabel)}</span>
      </div>
    </div>`;
  }

  function rangeEndpointLabels(path, options) {
    const overrides = {
      body: {
        heightPresence: ["偏矮", "偏高"],
        legRatio: ["腿短", "腿长"],
        waistDefinition: ["不明显", "明显"],
        shoulderHipBalance: ["偏胯", "偏肩"]
      }
    };
    const [scope, field] = path.split(".");
    if (scope === "body" && overrides.body[field]) return overrides.body[field];
    if (path.endsWith("Temperature")) return ["冷", "暖"];
    if (path.endsWith("Value")) return ["浅", "深"];
    if (path.endsWith("Chroma")) return ["低", "高"];
    return [options[0]?.label || "低", options[options.length - 1]?.label || "高"];
  }

  function renderOptionScale(path, label, value, options, variant = "") {
    const normalized = options.map((option) => Array.isArray(option) ? { value: option[0], label: option[1] } : option);
    return `<div class="form-item option-scale--${escapeHtml(variant)}"><div class="form-item-header"><label>${escapeHtml(label)}</label><strong>${escapeHtml(translateValue(normalized.find((option) => String(option.value) === String(value))?.label || value || "需确认"))}</strong></div><div class="pill-segment-control segment-control--${Math.min(normalized.length, 6)}">${normalized.map((option) => `<button type="button" data-input-path="${escapeHtml(path)}" data-input-value="${escapeHtml(option.value)}" data-value="${escapeHtml(option.value)}" class="${String(option.value) === String(value) ? "is-active" : ""}">${escapeHtml(option.label)}</button>`).join("")}</div></div>`;
  }

  function renderTrendDirectionScale(path, label, value, options) {
    const normalized = options.map((option) => Array.isArray(option) ? { value: option[0], label: option[1] } : option);
    const directions = state.ruleSet.trendDirections || [];
    return `<div class="form-item option-scale--trend-flow">
      <div class="form-item-header"><label>${escapeHtml(label)}</label><strong>${escapeHtml(normalized.find((option) => String(option.value) === String(value))?.label || "不限定")}</strong></div>
      <div class="trend-option-list">
        ${normalized.map((option) => {
          const trend = directions.find((item) => item.value === option.value);
          return `<button type="button" class="trend-option-card ${String(option.value) === String(value) ? "is-active" : ""}" data-input-path="${escapeHtml(path)}" data-input-value="${escapeHtml(option.value)}" data-value="${escapeHtml(option.value)}">
            <strong>${escapeHtml(option.label)}</strong><small>${escapeHtml(trend?.reference || (option.value === "none" ? "保持经典稳妥路线" : "潮流方向"))}</small>
          </button>`;
        }).join("")}
      </div>
    </div>`;
  }

  function renderTrendSummary(activeTrend) {
    const familyLabels = { straight: "简洁直线", tailored: "利落结构", soft: "柔和收放", relaxed: "自然留量", street: "街头箱型", retro: "复古收放" };
    const families = (activeTrend.result?.families || []).map((family) => familyLabels[family] || family);
    return `<div class="trend-input-summary"><div><small>潮流核心理念</small><strong>${escapeHtml(activeTrend.name)}</strong> <small>${escapeHtml(activeTrend.reference || "")}</small></div><p class="trend-core-idea">${escapeHtml(activeTrend.coreIdea || "")}</p><p class="trend-route"><span>优先服装路线</span>${families.map((family) => `<b>${escapeHtml(family)}</b>`).join("")}</p><p class="trend-influence-list">${(activeTrend.influences || []).map((inf) => `<b>${escapeHtml(inf)}</b>`).join("")}</p></div>`;
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
    const btn = event.target.closest("button[data-input-path]");
    if (!btn) return;
    const path = btn.dataset.inputPath;
    let val = btn.dataset.inputValue;
    if (/^\d+$/.test(val)) val = Number(val);
    Engine.setByPath(state.input, path, val);
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
    const garment = category === "top" ? "上装" : category === "outer" ? "外层" : "下装";
    return roles.find((role) => role.garment === garment)
      || roles.find((role) => role.role === category)
      || null;
  }

  function renderIllustration(illustration, candidate) {
    const model = illustration || {};
    const layers = model.layers || [];
    const colorFor = (kind, fallback) => {
      const role = (candidate.palette?.roles || []).find((item) => item.garment === kind);
      return escapeHtml(role?.hex || fallback);
    };
    const topLayer = layers.find((layer) => layer.kind === "top") || {};
    const outerLayer = layers.find((layer) => layer.kind === "outer") || {};
    const bottomLayer = layers.find((layer) => layer.kind === "bottom") || {};
    const topColor = colorFor("上装", topLayer.color || "#dedbd1");
    const outerColor = colorFor("外层", outerLayer.color || "#a8b1af");
    const bottomColor = colorFor("下装", bottomLayer.color || "#4c5961");
    const outerVisible = outerLayer.visible !== false && outerLayer.type !== "none";
    const bottomType = bottomLayer.type || bottomLayer.bottomType || candidate.bottomType || "trouser";
    const sleeve = topLayer.sleeve || candidate.sleeve || "long";
    const neckline = model.neckline || candidate.neckline || "regular";
    const waist = model.waist || candidate.waist || "natural";
    const line = model.line || candidate.line || "balanced";
    const necklineText = String(neckline);
    const isOpenNeckline = neckline === "open" || necklineText.includes("开阔") || necklineText.includes("开放");
    const isSoftNeckline = neckline === "softCurve" || necklineText.includes("柔和") || necklineText.includes("曲线");
    const armPath = sleeve === "short"
      ? `<path d="M92 64 L76 91 M128 64 L144 91" fill="none" stroke="${topColor}" stroke-width="13" stroke-linecap="round"/>`
      : sleeve === "threeQuarter"
        ? `<path d="M92 64 L73 106 M128 64 L147 106" fill="none" stroke="${topColor}" stroke-width="13" stroke-linecap="round"/>`
        : `<path d="M92 64 L73 123 M128 64 L147 123" fill="none" stroke="${topColor}" stroke-width="13" stroke-linecap="round"/>`;
    const necklinePath = isOpenNeckline
      ? `<path d="M96 78 L110 92 L124 78" fill="none" stroke="#ffffff" stroke-opacity="0.78" stroke-width="3"/>`
      : isSoftNeckline
        ? `<path d="M96 80 Q110 96 124 80" fill="none" stroke="#ffffff" stroke-opacity="0.78" stroke-width="3"/>`
        : `<path d="M98 80 Q110 88 122 80" fill="none" stroke="#ffffff" stroke-opacity="0.78" stroke-width="3"/>`;
    const waistY = waist === "raised" ? 108 : waist === "defined" ? 126 : 143;
    const waistMark = waist === "defined"
      ? `<path d="M84 ${waistY} L136 ${waistY}" stroke="#ffffff" stroke-opacity="0.78" stroke-width="3"/>`
      : waist === "raised"
        ? `<path d="M87 ${waistY} L133 ${waistY}" stroke="#ffffff" stroke-opacity="0.58" stroke-width="2" stroke-dasharray="4 3"/>`
        : "";
    const lineMark = line === "continuous"
      ? `<path d="M110 96 L110 154" stroke="#ffffff" stroke-opacity="0.32" stroke-width="2"/>`
      : line === "sectioned"
        ? `<path d="M87 116 L133 116 M87 138 L133 138" stroke="#ffffff" stroke-opacity="0.35" stroke-width="2"/>`
        : "";
    const bottomShape = bottomType === "skirt"
      ? `<path d="M78 159 L142 159 L157 235 Q110 248 63 235 Z" fill="${bottomColor}"/>`
      : bottomType === "short"
        ? `<path d="M80 158 L140 158 L145 206 L114 206 L110 178 L106 206 L75 206 Z" fill="${bottomColor}"/>`
        : `<path d="M82 158 L138 158 L136 236 L111 236 L108 178 L104 236 L79 236 Z" fill="${bottomColor}"/>`;
    return `
      <div class="outfit-illustration" data-illustration-type="${escapeHtml(model.type || "outfit-schematic")}">
        <svg class="illustration-svg" viewBox="0 0 220 260" role="img" aria-label="${escapeHtml(candidate.title || "穿搭方案效果图")}">
          <circle cx="110" cy="37" r="18" fill="#e8d2c1"/>
          <path d="M93 55 L127 55 L143 92 L137 158 L83 158 L77 92 Z" fill="${topColor}"/>
          ${armPath}
          ${outerVisible ? `<path d="M88 62 L70 91 L78 166 L142 166 L150 91 L132 62 L125 80 L95 80 Z" fill="${outerColor}" opacity="0.92"/>` : ""}
          ${bottomShape}
          <path d="M100 235 L100 248 M120 235 L120 248" stroke="#39434a" stroke-width="7" stroke-linecap="round"/>
          <path d="M94 250 L105 250 M115 250 L126 250" stroke="#39434a" stroke-width="5" stroke-linecap="round"/>
          ${necklinePath}
          ${waistMark}
          ${lineMark}
        </svg>
        <span class="illustration-caption">${escapeHtml(model.layerCount || candidate.layerCount || 1)}层 · ${escapeHtml(model.silhouette || candidate.silhouette || "整体轮廓")} · ${escapeHtml(translateValue(sleeve))}</span>
      </div>
    `;
  }

  function renderCandidateCard(cand, index, result) {
    const palette = cand.palette || {};
    const roles = palette.roles || [];
    
    // Garments from candidate
    const garments = [
      { category: "top", name: cand.garments?.top || "上装" },
      { category: "outer", name: cand.garments?.outer || "无外层" },
      { category: "bottom", name: cand.garments?.bottom || "下装" }
    ];

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

        <!-- Garments & Color Combined List -->
        <div class="garment-color-list">
          ${garments.map((comp) => {
            const role = roleForGarment(roles, comp.category) || roles[0] || {};
            const catIcon = comp.category === "outer" ? "🦺" : comp.category === "bottom" ? "👖" : "🧥";
            return `
              <div class="garment-color-item">
                <span class="garment-icon">${catIcon}</span>
                <div class="garment-info">
                  <strong class="garment-name">${escapeHtml(comp.name)}</strong>
                  <span class="garment-color-pill">
                    <i style="background:${escapeHtml(role.hex || "#ccc")}"></i>
                    ${escapeHtml(role.colorName || "基础色")} ${role.ratio ? `${role.ratio}%` : ""}
                  </span>
                </div>
              </div>
            `;
          }).join("")}
        </div>

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
              ${candidates.map((c) => `<td>${[c.garments?.top, c.garments?.outer !== "无外层" ? c.garments?.outer : null, c.garments?.bottom].filter(Boolean).join(" ＋ ")}</td>`).join("")}
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
                <span>${[c.garments?.top, c.garments?.outer !== "无外层" ? c.garments?.outer : null, c.garments?.bottom].filter(Boolean).join(" ＋ ")}</span>
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
          <small>${comp.category === "top" ? "上装" : comp.category === "outer" ? "外层" : "下装"}</small>
          <strong>${escapeHtml(comp.name)}</strong>
          <small style="margin-top:4px;color:var(--text-soft);">${escapeHtml(role.colorName || "基础色")} (${role.ratio || 0}%)</small>
        </span>
      `;
    }).join("");

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
        <div class="dialog-garments">${garmentsHtml}</div>
      </section>

      <section class="dialog-section">
        <h3>配色与占比</h3>
        <div class="dialog-palette">${paletteHtml}</div>
      </section>

      <section class="dialog-section">
        <h3>预计上身效果</h3>
        <p>${escapeHtml(cand.expectedEffect || "")}</p>
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
