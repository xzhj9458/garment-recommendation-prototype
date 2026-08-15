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
    { id: "context", label: "穿着条件" },
    { id: "color", label: "整体色彩" },
    { id: "body", label: "身材情况" },
    { id: "face", label: "脸型" },
    { id: "preference", label: "穿着偏好" },
    { id: "goal", label: "本次偏好" },
    { id: "boundaries", label: "拒绝与边界" }
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

    $("#analysisTrace").addEventListener("click", (event) => {
      const row = event.target.closest(".impact-link-row");
      if (!row) return;
      const ruleId = row.dataset.ruleId;
      state.highlightRuleId = state.highlightRuleId === ruleId ? null : ruleId;
      renderAnalysisHighlights();
      renderCandidateHighlights();
    });

    $("#analysisTrace").addEventListener("mouseenter", handleTraceHover, true);
    $("#analysisTrace").addEventListener("mouseleave", handleTraceLeave, true);

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
    renderAnalysis(result);
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
      $(".analysis-content"),
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
    const boundaryCount = (b.forbiddenCategories?.length || 0) + (b.bodyBoundaries?.length || 0);

    $("#conditionSnapshot").innerHTML = `
      <div class="snapshot-inner">
        <span class="snapshot-label">已选条件</span>
        <div class="snapshot-badges">
          <button type="button" class="snapshot-chip" data-jump-group="context" title="点击修改气温与场合">${escapeHtml(tempLabel)} · ${escapeHtml(occasionLabel)}</button>
          <button type="button" class="snapshot-chip" data-jump-group="preference" title="点击修改风格与潮流">${escapeHtml(styleLabel)} · ${escapeHtml(trendLabel)}</button>
          <button type="button" class="snapshot-chip" data-jump-group="goal" title="点击修改本次偏好">${g.endpoint && g.endpoint !== "unknown" ? translateValue(g.endpoint) : "保持原样"}</button>
          <button type="button" class="snapshot-chip ${boundaryCount ? "is-active" : ""}" data-jump-group="boundaries" title="点击修改禁忌边界">${boundaryCount ? `${boundaryCount}项禁忌` : "无禁忌"}</button>
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
    } else if (group === "color") {
      const fields = [
        ["skin", "肤色"], ["hair", "发色"], ["eye", "眼睛颜色"]
      ];
      content.innerHTML = `<div class="appearance-matrix-wrap">${fields.map(([part, label]) => `
        <div class="appearance-row-card">
          <div class="appearance-row-title"><strong>${label}</strong><span>用户确认的外观事实</span></div>
          <div class="appearance-row-scales">
            ${renderParameterScale(`appearance.${part}Temperature`, "冷暖", parameter(`appearance.${part}Temperature`))}
            ${renderParameterScale(`appearance.${part}Value`, "明度", parameter(`appearance.${part}Value`))}
            ${renderParameterScale(`appearance.${part}Chroma`, "彩度", parameter(`appearance.${part}Chroma`))}
          </div>
        </div>`).join("")}</div>`;
    } else if (group === "body") {
      content.innerHTML = `<div class="field-stack-grid">
        ${renderParameterScale("body.heightPresence", "身高表现", parameter("body.heightPresence"))}
        ${renderParameterScale("body.legRatio", "腿身比例", parameter("body.legRatio"))}
        ${renderParameterScale("body.waistDefinition", "腰线明显程度", parameter("body.waistDefinition"))}
        ${renderParameterScale("body.shoulderHipBalance", "肩胯轮廓关系", parameter("body.shoulderHipBalance"))}
      </div>`;
    } else if (group === "face") {
      content.innerHTML = `<div class="field-stack-grid--single">${renderParameterScale("face.shape", "脸型轮廓", parameter("face.shape"))}</div>`;
    } else if (group === "preference") {
      const activeTrend = (state.ruleSet.trendDirections || []).find((item) => item.value === state.input.preference.trendDirection);
      const styleOptions = parameter("preference.style");
      const formalityOptions = parameter("preference.formality");
      const trendOptions = [{ value: "none", label: "不限定" }, ...(state.ruleSet.trendDirections || []).filter((item) => item.enabled !== false).map((item) => ({ value: item.value, label: item.name }))];
      content.innerHTML = `<div class="field-stack-grid--preference">
        ${renderParameterScale("preference.style", "风格方向", styleOptions)}
        ${renderParameterScale("preference.formality", "正式程度偏好", formalityOptions)}
        ${renderOptionScale("preference.trendDirection", "潮流方向", state.input.preference.trendDirection, trendOptions)}
        ${state.input.preference.trendDirection !== "none" ? renderOptionScale("preference.trendIntensity", "潮流表达强度", state.input.preference.trendIntensity, parameter("preference.trendIntensity").options) : ""}
        ${activeTrend ? `<div class="trend-input-summary" style="grid-column:1 / -1;"><div><small>潮流核心理念</small><strong>${escapeHtml(activeTrend.name)}</strong> <small>${escapeHtml(activeTrend.reference || "")}</small></div><p class="trend-core-idea">${escapeHtml(activeTrend.coreIdea || "")}</p><p>${(activeTrend.influences || []).map((inf) => `<b>${escapeHtml(inf)}</b>`).join("")}</p></div>` : ""}
      </div>`;
    } else if (group === "goal") {
      const endpoint = parameter("goal.endpoint");
      const direction = parameter("goal.direction");
      content.innerHTML = `<div class="field-stack-grid">
        ${renderParameterSelect("goal.endpoint", "本次重点调整什么", endpoint)}
        ${renderParameterSelect("goal.direction", "希望如何调整", direction)}
      </div>`;
    } else if (group === "boundaries") {
      const boundaryFields = [
        ["rejectSkirt", "拒绝裙装", "排除所有裙装下装"],
        ["rejectDefinedWaist", "拒绝明显收腰", "排除明确腰位或高腰表达"],
        ["rejectHighContrast", "拒绝高对比配色", "配色对比不高于中等"],
        ["strictCoverage", "要求完整覆盖", "上下装都必须满足完整覆盖"],
        ["movementFriendly", "行动不能受限", "抬手、行走和坐下保持便利"],
        ["sensitiveTexture", "避免粗糙触感", "排除粗糙贴肤表面"]
      ];
      content.innerHTML = `<div class="checkbox-grid">${boundaryFields.map(([field, title, desc]) => renderBooleanCheckbox(`boundaries.${field}`, title, desc)).join("")}</div>`;
    }
  }

  function renderParameterScale(path, label, definition) {
    return renderOptionScale(path, label, Engine.getByPath(state.input, path), definition?.options || []);
  }

  function renderOptionScale(path, label, value, options) {
    const normalized = options.map((option) => Array.isArray(option) ? { value: option[0], label: option[1] } : option);
    return `<div class="form-item"><div class="form-item-header"><label>${escapeHtml(label)}</label><strong>${escapeHtml(translateValue(normalized.find((option) => String(option.value) === String(value))?.label || value || "需确认"))}</strong></div><div class="pill-segment-control segment-control--${Math.min(normalized.length, 6)}">${normalized.map((option) => `<button type="button" data-input-path="${escapeHtml(path)}" data-input-value="${escapeHtml(option.value)}" data-value="${escapeHtml(option.value)}" class="${String(option.value) === String(value) ? "is-active" : ""}">${escapeHtml(option.label)}</button>`).join("")}</div></div>`;
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

  function renderAnalysis(result) {
    const trace = result.trace || [];
    const traceContainer = $("#analysisTrace");

    if (!trace.length) {
      traceContainer.innerHTML = `<div class="analysis-empty"><p>暂无影响计算结果</p></div>`;
      return;
    }

    const hardRows = trace.filter((r) => r.kind === "hard" || r.group === "温度" || r.group === "明确拒绝与身体边界");
    const styleRows = trace.filter((r) => !hardRows.includes(r) && (r.group?.includes("风格") || r.group?.includes("身材") || r.group?.includes("场合") || r.group?.includes("潮流") || r.group?.includes("偏好") || r.group?.includes("面部")));
    const colorRows = trace.filter((r) => !hardRows.includes(r) && !styleRows.includes(r));

    traceContainer.innerHTML = `
      <div class="analysis-categorized-list">
        ${hardRows.length ? `
          <div class="analysis-sub-group is-hard-section">
            <div class="analysis-sub-title">穿着框架 · 硬性边界</div>
            ${hardRows.map(renderImpactLinkRow).join("")}
          </div>
        ` : ""}
        ${styleRows.length ? `
          <div class="analysis-sub-group">
            <div class="analysis-sub-title">服装样式 · 轮廓细节</div>
            ${styleRows.map(renderImpactLinkRow).join("")}
          </div>
        ` : ""}
        ${colorRows.length ? `
          <div class="analysis-sub-group">
            <div class="analysis-sub-title">颜色搭配 · 色温明度</div>
            ${colorRows.map(renderImpactLinkRow).join("")}
          </div>
        ` : ""}
      </div>
    `;
  }

  function renderImpactLinkRow(row) {
    const isHard = row.kind === "hard" || row.group === "温度" || row.group === "明确拒绝与身体边界";
    const statusLabel = row.status === "skipped" ? "未改变" : row.status === "partial" ? "部分应用" : row.status === "conflict" ? "冲突" : row.status === "needs_verification" ? "待确认" : "已应用";
    const inputsStr = formatTraceInput(row);
    const outputsFormatted = formatTraceOutput(row);

    return `
      <button type="button" class="impact-link-row ${isHard ? "is-hard-row" : ""} is-${escapeHtml(row.status || "matched")}" data-rule-id="${escapeHtml(row.ruleId || "")}" title="点击高亮与此规则关联的方案">
        <span class="impact-input-text" title="${escapeHtml(inputsStr)}">${escapeHtml(inputsStr)}</span>
        <span class="impact-arrow" aria-hidden="true">→</span>
        <span class="impact-output-text" title="${escapeHtml(outputsFormatted)}">${escapeHtml(outputsFormatted)}</span>
        ${isHard ? `<em class="impact-required">硬性边界</em>` : ""}
        <em class="impact-status">${statusLabel}</em>
      </button>
    `;
  }

  function formatTraceInput(item) {
    if (item.conditions && item.conditions.length) {
      return item.conditions.map((c) => {
        const condDef = state.ruleSet.conditionFields?.find((f) => f.id === c.field) ||
                        state.ruleSet.parameters?.find((p) => `input.${p.id}` === c.field);
        const fieldName = condDef?.name || (c.field.includes("temperature") ? "近期温度" : c.field.includes("occasion") ? "使用场合" : c.field.includes("style") ? "风格方向" : c.field.includes("trend") ? "潮流方向" : c.field.includes("shape") ? "脸型" : c.field.split(".").pop());
        
        let valName = c.value;
        if (condDef?.options) {
          const opt = condDef.options.find((o) => (Array.isArray(o) ? o[0] : o.value) === c.value);
          if (opt) valName = Array.isArray(opt) ? opt[1] : opt.label;
        }
        valName = translateValue(valName);
        return `${fieldName}为${valName}`;
      }).join(" · ");
    }
    if (item.inputs?.length) return item.inputs.map((path) => path.split(".").pop()).join("、");
    return item.name || "输入条件";
  }

  function formatTraceOutput(item) {
    if (item.actions && item.actions.length) {
      return item.actions.map((a) => {
        const fieldDef = state.ruleSet.resultFields?.find((f) => f.id === a.field);
        const name = fieldDef?.name?.replace(/^推荐/, "").replace(/表现$/, "") || (a.field.includes("layer") ? "层数" : a.field.includes("sleeve") ? "袖长" : a.field.includes("outer") ? "外层" : a.field.includes("neckline") ? "领口" : a.field.includes("formality") ? "正式程度" : a.field.split(".").pop());
        
        let valName = a.value;
        if (fieldDef?.options) {
          const opt = fieldDef.options.find((o) => (Array.isArray(o) ? o[0] : o.value) === a.value);
          if (opt) valName = Array.isArray(opt) ? opt[1] : opt.label;
        }
        valName = translateValue(valName);
        return `${name}: ${valName}`;
      }).join(" · ");
    }
    if (item.outputResult) {
      const parts = [];
      if (item.name) parts.push(item.name);
      if (item.outputResult.silhouette) parts.push(`廓形: ${item.outputResult.silhouette}`);
      if (item.outputResult.detail) parts.push(`细节: ${item.outputResult.detail}`);
      return parts.join(" · ");
    }
    return item.reason || item.name || "已生效处理";
  }

  function handleTraceHover(event) {
    const row = event.target.closest(".impact-link-row");
    if (!row) return;
    const ruleId = row.dataset.ruleId;
    highlightCandidatesByRule(ruleId);
  }

  function handleTraceLeave() {
    if (!state.highlightRuleId) {
      clearCandidateHighlights();
    }
  }

  function highlightCandidatesByRule(ruleId) {
    const relatedIds = new Set((state.lastResult?.insights || [])
      .filter((insight) => insight.ruleId === ruleId)
      .flatMap((insight) => insight.candidateIds || []));
    const trace = state.lastResult?.trace?.find((item) => item.ruleId === ruleId);
    const global = !relatedIds.size && trace?.stage === "derive";
    $$(".candidate-card").forEach((card) => {
      const candidate = state.lastResult?.candidates?.[Number(card.dataset.index)];
      const related = Boolean(candidate && (global || relatedIds.has(candidate.id) || candidate.traceRuleIds?.includes(ruleId)));
      card.classList.toggle("is-related", related);
      card.classList.toggle("is-dimmed", !related);
    });
  }

  function clearCandidateHighlights() {
    const cards = $$(".candidate-card");
    cards.forEach((card) => {
      card.classList.remove("is-related", "is-dimmed");
    });
  }

  function renderAnalysisHighlights() {
    const rows = $$(".impact-link-row");
    rows.forEach((row) => {
      row.classList.toggle("is-active", row.dataset.ruleId === state.highlightRuleId);
    });
  }

  function renderCandidateHighlights() {
    const cards = $$(".candidate-card");
    cards.forEach((card, index) => {
      const isSelected = state.selectedCandidateIndex === index;
      card.classList.toggle("is-active-selection", isSelected);
      if (state.highlightRuleId) {
        const candidate = state.lastResult?.candidates?.[index];
        const related = Boolean(candidate && candidate.traceRuleIds?.includes(state.highlightRuleId));
        card.classList.toggle("is-related", related);
        card.classList.toggle("is-dimmed", !related);
      } else {
        card.classList.remove("is-related", "is-dimmed");
      }
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
    const featureBadge = index === 0 ? "基准推荐" : (cand.differenceSummary || "候选方案");
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
