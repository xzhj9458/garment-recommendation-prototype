(function () {
  "use strict";

  const DATA = window.GarmentPrototypeData;
  const Engine = window.GarmentRuleEngine;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const groups = [
    { id: "context", label: "穿着条件", parameterGroups: ["温度与场合"] },
    { id: "appearance", label: "整体色彩", parameterGroups: ["外观色彩"] },
    { id: "body", label: "身材情况", parameterGroups: ["身材比例", "身材轮廓"] },
    { id: "face", label: "脸型", parameterGroups: ["脸型"] },
    { id: "preference", label: "穿着偏好", parameterGroups: ["穿着偏好"] },
    { id: "goal", label: "本次偏好", parameterGroups: ["本次偏好"] },
    { id: "boundaries", label: "拒绝与边界", parameterGroups: ["明确拒绝与身体边界"] }
  ];

  const state = {
    ruleSet: Engine.Store.loadPublished(),
    input: Engine.Store.loadInput(),
    activeGroup: "context",
    result: null,
    previousResult: null,
    lastInputChange: null,
    activeInsightId: null,
    imageName: "",
    appearancePart: "skin"
  };

  init();

  function init() {
    bindStaticEvents();
    renderTabs();
    renderInputGroup();
    calculate(false);
  }

  function bindStaticEvents() {
    $("#resetInputButton").addEventListener("click", () => {
      state.input = Engine.clone(DATA.defaultInput);
      state.lastInputChange = { name: "输入", before: "当前设置", after: "默认设置" };
      Engine.Store.saveInput(state.input);
      renderInputGroup();
      calculate(true);
      toast("已恢复默认输入");
    });

    $("#inputTabs").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-group]");
      if (!button) return;
      state.activeGroup = button.dataset.group;
      renderTabs();
      renderInputGroup();
    });

    $("#inputContent").addEventListener("change", handleInputChange);
    $("#inputContent").addEventListener("click", (event) => {
      const appearancePart = event.target.closest("button[data-appearance-part]");
      if (appearancePart) {
        state.appearancePart = appearancePart.dataset.appearancePart;
        renderInputGroup();
        return;
      }
      const segment = event.target.closest("button[data-input-path]");
      if (!segment) return;
      updateInput(segment.dataset.inputPath, parseValue(segment.dataset.value), segment.textContent.trim());
      renderInputGroup();
    });

    $("#candidateGrid").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-candidate-id]");
      if (!button) return;
      openCandidate(button.dataset.candidateId);
    });

    $("#analysisTrace").addEventListener("click", (event) => {
      const card = event.target.closest("button[data-insight-id]");
      if (!card) return;
      state.activeInsightId = state.activeInsightId === card.dataset.insightId ? null : card.dataset.insightId;
      renderAnalysis(false);
      renderCandidates();
    });

    $("[data-close-dialog]").addEventListener("click", () => $("#candidateDialog").close());
    $("#candidateDialog").addEventListener("click", (event) => {
      if (event.target === $("#candidateDialog")) $("#candidateDialog").close();
    });

    window.addEventListener("storage", (event) => {
      if (event.key === Engine.Store.keys.published) {
        state.ruleSet = Engine.Store.loadPublished();
        renderTabs();
        renderInputGroup();
        calculate(true);
        toast("已载入新发布的规则");
      }
    });
  }

  function renderTabs() {
    $("#inputTabs").innerHTML = groups.map((group) => `
      <button type="button" class="${group.id === state.activeGroup ? "is-active" : ""}" data-group="${group.id}">
        ${escapeHtml(group.label)}
      </button>
    `).join("");
    $("#ruleVersion").textContent = `规则 ${state.ruleSet.meta.version || "草稿"}`;
  }

  function renderInputGroup() {
    const group = groups.find((item) => item.id === state.activeGroup);
    const trendSelected = Engine.getByPath(state.input, "preference.trendDirection") !== "none";
    const parameters = state.ruleSet.parameters.filter((item) => (
      item.enabled
      && group.parameterGroups.includes(item.group)
      && (item.id !== "preference.trendIntensity" || trendSelected)
    ));
    const content = $("#inputContent");
    content.classList.toggle("is-preference", state.activeGroup === "preference");

    if (state.activeGroup === "appearance") {
      content.innerHTML = renderAppearance(parameters);
      syncSegmentSelection();
      return;
    }

    if (state.activeGroup === "boundaries") {
      content.innerHTML = `
        <div class="input-group-heading">
          <div><strong>明确拒绝与身体边界</strong><p>勾选项会直接过滤或改写候选。</p></div>
        </div>
        <div class="checkbox-grid">
          ${parameters.map(renderBooleanParameter).join("")}
        </div>
        <div class="source-line"><span>来源</span><strong>客户明确陈述</strong></div>
      `;
      return;
    }

    const intro = state.activeGroup === "context"
      ? "近期温度使用范围选择；不推测湿度、室内外和活动强度。"
      : state.activeGroup === "preference"
        ? "风格、正式程度和潮流方向分别参与穿搭；潮流可以不限定。"
        : state.activeGroup === "goal"
        ? "暂不确定也可以继续，系统不会自动制造需要纠正的问题。"
      : state.activeGroup === "face"
        ? "脸型只用于领口和脸部周边细节参考，不影响身材判断。"
        : "这些是已确认的当前关系，只描述起点，不判断好坏。";

    const parameterContent = state.activeGroup === "body"
      ? group.parameterGroups.map((parameterGroup) => {
          const items = parameters.filter((item) => item.group === parameterGroup);
          return items.length ? `<section class="body-input-section"><h3>${escapeHtml(parameterGroup)}</h3><div class="field-stack-grid">${items.map(renderParameter).join("")}</div></section>` : "";
        }).join("")
      : `<div class="field-stack-grid ${["context", "goal", "face"].includes(state.activeGroup) ? "field-stack-grid--single" : state.activeGroup === "preference" ? "field-stack-grid--preference" : ""}">${parameters.map(renderParameter).join("")}</div>`;

    content.innerHTML = `
      <div class="input-group-heading">
        <div><strong>${escapeHtml(group.label)}</strong><p>${escapeHtml(intro)}</p></div>
        ${["body", "face"].includes(state.activeGroup) ? renderImageUpload() : ""}
      </div>
      ${parameterContent}
      ${state.activeGroup === "preference" ? renderTrendSummary() : ""}
      <div class="source-line"><span>来源</span><strong>${["body", "face"].includes(state.activeGroup) && state.imageName ? "图片上传后由用户确认" : "客户确认"}</strong></div>
    `;
    syncSegmentSelection();
    const upload = $("#photoUpload");
    if (upload) upload.addEventListener("change", handlePhotoUpload);
  }

  function renderTrendSummary() {
    const value = Engine.getByPath(state.input, "preference.trendDirection");
    if (!value || value === "none") return "";
    const trend = (state.ruleSet.trendDirections || []).find((item) => item.value === value && item.enabled !== false);
    if (!trend) return "";
    return `<section class="trend-input-summary">
      <div><small>潮流理念</small><strong>${escapeHtml(trend.coreIdea || trend.reason || trend.name)}</strong></div>
      <p>${(trend.influences || []).map((item) => `<b>${escapeHtml(item)}</b>`).join("")}</p>
    </section>`;
  }

  function renderAppearance(parameters) {
    const rows = [
      { key: "skin", label: "肤色" },
      { key: "hair", label: "发色" },
      { key: "eye", label: "眼睛" }
    ];
    const find = (id) => parameters.find((item) => item.id === id);
    const active = rows.find((row) => row.key === state.appearancePart) || rows[0];
    return `
      <div class="input-group-heading">
        <div><strong>外观色彩</strong><p>分别确认肤色、发色和眼睛颜色，再计算整体结果。</p></div>
      </div>
      <div class="appearance-part-tabs" role="tablist" aria-label="外观部位">
        ${rows.map((row) => `<button type="button" role="tab" aria-selected="${row.key === active.key}" class="${row.key === active.key ? "is-active" : ""}" data-appearance-part="${row.key}">${row.label}</button>`).join("")}
      </div>
      <div class="appearance-scales">
        ${renderScaleParameter(find(`appearance.${active.key}Temperature`))}
        ${renderScaleParameter(find(`appearance.${active.key}Value`))}
        ${renderScaleParameter(find(`appearance.${active.key}Chroma`))}
      </div>
      <div class="source-line"><span>来源</span><strong>客户确认 · 后续可由图片写入待确认值</strong></div>
    `;
  }

  function renderImageUpload() {
    return `
      <label class="upload-button" for="photoUpload">
        <span aria-hidden="true">＋</span>
        <span>${state.imageName ? escapeHtml(state.imageName) : "上传照片"}</span>
        <input id="photoUpload" type="file" accept="image/*" hidden>
      </label>
    `;
  }

  function handlePhotoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    state.imageName = file.name;
    renderInputGroup();
    toast("图片已上传；本原型不执行识别，请确认下方参数");
  }

  function renderParameter(parameter) {
    if (parameter.type === "boolean") return renderBooleanParameter(parameter);
    if (parameter.type === "select") {
      if (["context", "preference", "goal", "face"].includes(state.activeGroup)) return renderChoiceParameter(parameter);
      const value = Engine.getByPath(state.input, parameter.id);
      return `
        <label class="field-control">
          <span>${escapeHtml(parameter.name)}</span>
          <select data-input-path="${escapeHtml(parameter.id)}">
            ${(parameter.options || []).map((option) => `<option value="${escapeHtml(option.value)}" ${String(option.value) === String(value) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
          </select>
          <small>${escapeHtml(parameter.description || "")}</small>
        </label>
      `;
    }
    if (parameter.type === "scale") return renderScaleParameter(parameter);
    return "";
  }

  function renderChoiceParameter(parameter) {
    const value = Engine.getByPath(state.input, parameter.id);
    const optionCount = parameter.options?.length || 1;
    return `
      <div class="scale-control choice-control">
        <div class="scale-label"><span>${escapeHtml(parameter.name)}</span><strong>${escapeHtml(labelForParameter(parameter, value))}</strong></div>
        <div class="segment-control segment-control--${optionCount}" role="group" aria-label="${escapeHtml(parameter.name)}">
          ${(parameter.options || []).map((option) => `
            <button type="button" data-input-path="${escapeHtml(parameter.id)}" data-value="${escapeHtml(option.value)}" aria-pressed="${String(option.value) === String(value)}" title="${escapeHtml(option.label)}">
              ${escapeHtml(option.label)}
            </button>
          `).join("")}
        </div>
        ${state.activeGroup === "preference" ? "" : `<small>${escapeHtml(parameter.description || "")}</small>`}
      </div>
    `;
  }

  function renderScaleParameter(parameter) {
    const value = Engine.getByPath(state.input, parameter.id);
    return `
      <div class="scale-control">
        <div class="scale-label"><span>${escapeHtml(parameter.name)}</span><strong>${escapeHtml(labelForParameter(parameter, value))}</strong></div>
        <div class="segment-control" role="group" aria-label="${escapeHtml(parameter.name)}">
          ${(parameter.options || []).map((option) => `
            <button type="button" data-input-path="${escapeHtml(parameter.id)}" data-value="${escapeHtml(option.value)}" aria-pressed="${String(option.value) === String(value)}" title="${escapeHtml(option.label)}">
              ${escapeHtml(option.label)}
            </button>
          `).join("")}
        </div>
      </div>
    `;
  }

  function renderBooleanParameter(parameter) {
    const checked = Boolean(Engine.getByPath(state.input, parameter.id));
    return `
      <label class="check-control">
        <input type="checkbox" data-input-path="${escapeHtml(parameter.id)}" ${checked ? "checked" : ""}>
        <span class="check-box" aria-hidden="true">✓</span>
        <span><strong>${escapeHtml(parameter.name)}</strong><small>${escapeHtml(parameter.description || "")}</small></span>
      </label>
    `;
  }

  function handleInputChange(event) {
    const control = event.target.closest("[data-input-path]");
    if (!control) return;
    const value = control.type === "checkbox" ? control.checked : parseValue(control.value);
    const label = control.type === "checkbox" ? (control.checked ? "是" : "否") : control.selectedOptions?.[0]?.textContent || String(value);
    updateInput(control.dataset.inputPath, value, label);
    if (control.type !== "checkbox") renderInputGroup();
  }

  function updateInput(path, value, displayValue) {
    const beforeValue = Engine.getByPath(state.input, path);
    if (String(beforeValue) === String(value)) return;
    const parameter = state.ruleSet.parameters.find((item) => item.id === path);
    state.lastInputChange = {
      path,
      name: parameter?.name || path,
      before: labelForParameter(parameter, beforeValue),
      after: displayValue || labelForParameter(parameter, value)
    };
    Engine.setByPath(state.input, path, value);
    Engine.Store.saveInput(state.input);
    calculate(true);
  }

  function calculate(showChange) {
    const calculationState = $("#calculationState");
    calculationState.textContent = "计算中";
    calculationState.classList.add("is-working");
    state.previousResult = state.result;
    state.result = Engine.run(state.input, state.ruleSet);
    renderAnalysis(showChange);
    renderCandidates();
    requestAnimationFrame(() => {
      calculationState.textContent = "已更新";
      calculationState.classList.remove("is-working");
    });
  }

  function renderAnalysis(showChange) {
    const groups = groupInsights(state.result.insights || []);
    $("#analysisTrace").innerHTML = groups.length ? groups.map((insight) => {
      const active = state.activeInsightId === insight.id;
      const changed = insightMatchesInput(insight, state.lastInputChange?.path);
      return `
        <button type="button" class="impact-link-row ${active ? "is-active" : ""} ${showChange && changed ? "is-changed" : ""}" data-insight-id="${escapeHtml(insight.id)}">
          <span class="impact-capsules is-input">${insight.inputs.map((item) => `<b>${escapeHtml(item)}</b>`).join("")}</span>
          <span class="impact-arrow" aria-hidden="true">→</span>
          <span class="impact-capsules is-output">${insight.outputResults.map((item) => `<b>${escapeHtml(item)}</b>`).join("")}</span>
          ${insight.kind === "hard" ? `<em class="impact-required">必须</em>` : ""}
        </button>`;
    }).join("") : `<div class="analysis-empty"><strong>当前没有额外处理方向</strong><p>服装方案将按基础组合生成。</p></div>`;
  }

  function groupInsights(insights) {
    const grouped = new Map();
    insights.forEach((insight) => {
      const key = ({
        温度: "温度与层次",
        场合: "场合要求",
        色彩: "整体色彩",
        身材比例: "身材与比例",
        身材与脸型适配: "脸型与领口"
      })[insight.group] || insight.group || "其他";
      const current = grouped.get(key) || {
        id: `GROUP-${key}`,
        group: key,
        kind: insight.kind,
        priority: insight.priority,
        findings: [],
        conclusions: [],
        directions: [],
        inputs: [],
        outputResults: [],
        impactTargets: [],
        candidateIds: [],
        sourcePaths: []
      };
      if (insight.kind === "hard") current.kind = "hard";
      current.priority = Math.max(current.priority, insight.priority);
      current.findings.push(insight.finding);
      current.conclusions.push(insight.conclusion);
      current.directions.push(insight.direction);
      current.inputs.push(...(insight.inputs || [insight.finding]));
      current.outputResults.push(...(insight.outputResults || insight.impactTargets));
      current.impactTargets.push(...insight.impactTargets);
      current.candidateIds.push(...insight.candidateIds);
      current.sourcePaths.push(...insight.sourcePaths);
      grouped.set(key, current);
    });
    return [...grouped.values()].map((item) => ({
      ...item,
      finding: [...new Set(item.findings)].join("；"),
      conclusion: [...new Set(item.conclusions)].join("；"),
      direction: [...new Set(item.directions.map((text) => String(text).replace(/[。；]+$/g, "")))].join("；") + "。",
      impactTargets: [...new Set(item.impactTargets)],
      candidateIds: [...new Set(item.candidateIds)],
      sourcePaths: [...new Set(item.sourcePaths)],
      inputs: [...new Set(item.inputs)],
      outputResults: [...new Set(item.outputResults)].slice(0, 7)
    })).filter((item) => item.inputs.length && item.outputResults.length).sort((a, b) => b.priority - a.priority);
  }

  function insightMatchesInput(insight, inputPath) {
    if (!inputPath) return false;
    if (insight.sourcePaths.includes(`input.${inputPath}`)) return true;
    return insight.sourcePaths.some((path) => {
      if (!path.startsWith("derived.")) return false;
      const output = path.replace(/^derived\./, "").replace(/\.label$/, "");
      return state.ruleSet.derivedRules.some((rule) => rule.output === output && rule.inputs.some((item) => item.field === inputPath));
    });
  }

  function renderCandidates() {
    const result = state.result;
    const grid = $("#candidateGrid");
    const empty = $("#emptyResult");
    $("#candidateSummary").textContent = result.candidates.length >= 2
      ? `根据当前规则生成 ${result.candidates.length} 个不同方向 · ${result.version}`
      : `当前只有 ${result.candidates.length} 个可行方案 · ${result.version}`;

    if (!result.candidates.length) {
      grid.innerHTML = "";
      empty.hidden = false;
      empty.innerHTML = result.conflicts.length
        ? `<strong>规则存在冲突，暂时无法生成方案</strong><p>${result.conflicts.map((item) => `${item.field}：${item.rules.join(" / ")}`).join("；")}</p><a href="rules.html">前往规则配置</a>`
        : `<strong>当前硬性条件下没有完整方案</strong><p>${escapeHtml(result.blocked.map((item) => item.reason).join("；") || "请检查输入和结果字典。")}</p><a href="rules.html">检查规则与组件</a>`;
      return;
    }

    empty.hidden = true;
    grid.innerHTML = result.candidates.map((candidate, index) => renderCandidateCard(candidate, index)).join("");
  }

  function renderCandidateCard(candidate, index) {
    const palette = candidate.palette?.roles || [];
    const comparedWithFirst = index === 0 ? [] : Engine.meaningfulDifference(state.result.candidates[0], candidate);
    const activeInsight = groupInsights(state.result.insights || []).find((item) => item.id === state.activeInsightId);
    const related = !activeInsight || activeInsight.candidateIds.includes(candidate.id);
    return `
      <article class="candidate-card ${state.activeInsightId ? (related ? "is-related" : "is-dimmed") : ""}" data-family="${escapeHtml(candidate.family)}">
        <div class="candidate-card-head">
          <div>
            <span class="candidate-number">方案 ${index + 1}</span>
            <h3>${escapeHtml(candidate.name)}</h3>
          </div>
          <div class="palette-strip" aria-label="${escapeHtml(candidate.palette?.name || "配色待确认")}" title="${escapeHtml(candidate.palette?.name || "配色待确认")}">
            ${palette.map((item) => `<span style="background:${escapeHtml(item.color?.hex || "#d9ddda")};flex-grow:${Number(item.ratio || 1)}"></span>`).join("")}
          </div>
        </div>

        <div class="garment-stack">
          <div><span>上装</span><strong>${escapeHtml(candidate.garments.top)}</strong></div>
          <div><span>外层</span><strong>${escapeHtml(candidate.garments.outer)}</strong></div>
          <div><span>下装</span><strong>${escapeHtml(candidate.garments.bottom)}</strong></div>
        </div>

        <div class="candidate-specs">
          <span><small>层次</small><strong>${candidate.layerCount} 层</strong></span>
          <span><small>风格</small><strong>${escapeHtml(candidate.styleName)}</strong></span>
          <span><small>轮廓</small><strong>${escapeHtml(candidate.silhouette)}</strong></span>
          <span><small>潮流方向</small><strong>${escapeHtml(candidate.trendName || "未指定")}</strong></span>
        </div>

        <div class="outfit-detail-summary">
          <span><small>款式细节</small><strong>${escapeHtml(candidate.detail)}</strong></span>
          <span><small>图案纹理</small><strong>${escapeHtml(candidate.pattern)}</strong></span>
          <span><small>材质表面</small><strong>${escapeHtml(candidate.finish)} · ${escapeHtml(candidate.material)}</strong></span>
          <span><small>版型比例</small><strong>${escapeHtml(candidate.trendProportion)}</strong></span>
        </div>

        <div class="palette-summary">
          <span>配色</span>
          <strong>${escapeHtml(candidate.palette?.name || "需验证")}</strong>
          <small>${palette.map((item) => `${escapeHtml(item.garment)}：${escapeHtml(item.color?.name || "未设置")} ${item.ratio}%`).join(" · ")}</small>
        </div>

        <p class="expected-effect"><b>预计效果</b>${escapeHtml(candidate.expectedEffect)}</p>

        <div class="implementation-line">
          <span>本套如何落实</span>
          <p>${(candidate.implementationTags || []).map((item) => `<b>${escapeHtml(item)}</b>`).join("") || "按基础组合生成"}</p>
        </div>
        <div class="difference-line">
          <span>${index === 0 ? "主要方向" : "与方案 1 的差异"}</span>
          <strong>${escapeHtml(index === 0 ? `${candidate.line} · ${candidate.colorContrast}对比` : comparedWithFirst.slice(0, 3).join("、") || "细节处理")}</strong>
        </div>
        <button class="detail-button" type="button" data-candidate-id="${escapeHtml(candidate.id)}">查看方案详情</button>
      </article>
    `;
  }

  function openCandidate(id) {
    const candidate = state.result.candidates.find((item) => item.id === id);
    if (!candidate) return;
    $("#dialogTitle").textContent = candidate.name;
    $("#dialogContent").innerHTML = `
      <section class="dialog-section">
        <h3>完整方案</h3>
        <div class="dialog-garments">
          <span><small>上装</small><strong>${escapeHtml(candidate.garments.top)}</strong></span>
          <span><small>外层</small><strong>${escapeHtml(candidate.garments.outer)}</strong></span>
          <span><small>下装</small><strong>${escapeHtml(candidate.garments.bottom)}</strong></span>
        </div>
        <p>${candidate.layerCount} 层 · ${escapeHtml(Engine.labels.sleeveLabel(candidate.sleeve))} · ${escapeHtml(Engine.labels.coverageLabel(candidate.coverage))} · ${escapeHtml(candidate.material)} · ${escapeHtml(candidate.line)} · ${escapeHtml(Engine.labels.waistLabel(candidate.waist))}</p>
        <p>${escapeHtml(candidate.styleName)} · ${escapeHtml(candidate.silhouette)} · ${escapeHtml(candidate.detail)} · ${escapeHtml(candidate.pattern)} · ${escapeHtml(candidate.trendName || "未指定潮流")}</p>
      </section>
      <section class="dialog-section">
        <h3>配色方案</h3>
        ${candidate.palette ? `
          <div class="dialog-palette">
            ${(candidate.palette.roles || []).map((item) => `<span><i style="background:${escapeHtml(item.color?.hex || "#d9ddda")}"></i><small>${escapeHtml(item.garment)}</small><strong>${escapeHtml(item.color?.name || "未设置")} ${item.ratio}%</strong></span>`).join("")}
          </div>
          <p>${escapeHtml(candidate.palette.reason || "")}</p>
        ` : `<p class="muted-copy">当前没有可用的配色方案。</p>`}
      </section>
      <section class="dialog-section">
        <h3>预计上身效果</h3>
        <p>${escapeHtml(candidate.expectedEffect)}</p>
      </section>
      <section class="dialog-section">
        <h3>满足的硬性条件</h3>
        ${renderEvidenceList(candidate.hardRequirementsMet, "当前没有额外硬性条件。")}
      </section>
      <section class="dialog-section">
        <h3>本套如何落实</h3>
        ${renderImplementation(candidate)}
      </section>
      <section class="dialog-section">
        <h3>需验证</h3>
        <div class="verification-list">
          ${candidate.unverified.map((item) => `
            <article>
              <div><strong>${escapeHtml(item.item)}</strong><span class="impact-badge ${item.affectsPlan ? "is-impact" : ""}">${item.affectsPlan ? "影响方案" : "不改变路线"}</span></div>
              <p><b>怎么验证：</b>${escapeHtml(item.validation)}</p>
              <p><b>失败条件：</b>${escapeHtml(item.failure)}</p>
            </article>
          `).join("")}
        </div>
      </section>
      <section class="dialog-section trace-id-line">
        <details class="advanced-details"><summary>高级信息</summary><p>${candidate.traceRuleIds.map((id) => `<code>${escapeHtml(id)}</code>`).join(" ")}</p></details>
      </section>
    `;
    $("#candidateDialog").showModal();
  }

  function renderEvidenceList(items, fallback) {
    if (!items.length) return `<p class="muted-copy">${escapeHtml(fallback)}</p>`;
    return `<ul class="evidence-list">${items.map((item) => `<li><strong>${escapeHtml(item.name || "推荐依据")}</strong><span>${escapeHtml(item.text)}</span></li>`).join("")}</ul>`;
  }

  function renderImplementation(candidate) {
    const insights = (state.result.insights || []).filter((item) => candidate.appliedInsightIds?.includes(item.id));
    if (!insights.length) return `<p class="muted-copy">按基础组合生成。</p>`;
    return `<ul class="implementation-list">${insights.slice(0, 6).map((item) => `
      <li><strong>${escapeHtml(item.conclusion)}</strong><span>${item.impactTargets.map((target) => escapeHtml(target)).join("、")}</span></li>
    `).join("")}</ul>`;
  }

  function labelForParameter(parameter, value) {
    if (!parameter) return String(value ?? "未设置");
    if (parameter.type === "boolean") return value ? "是" : "否";
    return parameter.options?.find((item) => String(item.value) === String(value))?.label || String(value ?? "未设置");
  }

  function syncSegmentSelection() {
    $$(".segment-control button").forEach((button) => {
      const selected = String(Engine.getByPath(state.input, button.dataset.inputPath)) === String(button.dataset.value);
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function parseValue(value) {
    if (value === "true") return true;
    if (value === "false") return false;
    if (/^-?\d+(\.\d+)?$/.test(String(value))) return Number(value);
    return value;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function toast(message) {
    const element = $("#toast");
    element.textContent = message;
    element.classList.add("is-visible");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => element.classList.remove("is-visible"), 2600);
  }
})();
