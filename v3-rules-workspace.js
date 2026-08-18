(function (global) {
  "use strict";

  const defaultRegistry = global.GarmentV3RuleRegistry;
  const fields = global.GarmentV3FieldRegistry;
  const capability = global.GarmentV3CapabilityRegistry;
  const effects = global.GarmentV3EffectRegistry;
  const actionContract = global.GarmentV3ActionContract;
  const runtime = global.GarmentV3Runtime;
  const MODE_KEY = "garment-engine-mode";
  const DRAFT_KEY = "garment-v3-rule-draft";
  const PUBLISHED_KEY = "garment-v3-rule-published";
  const $ = (selector) => document.querySelector(selector);
  const inputMap = new Map((fields?.inputs || []).map((field) => [field.id, field]));
  const outputMap = new Map((fields?.outputs || []).map((field) => [field.id, field]));
  const capabilityMap = new Map((capability?.fields || []).map((field) => [field.id, field]));
  const effectMap = new Map((effects?.dimensions || []).map((field) => [field.id, field]));

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function loadRegistry(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value?.rules ? value : clone(fallback);
    } catch (error) {
      return clone(fallback);
    }
  }

  const publishedRegistry = loadRegistry(PUBLISHED_KEY, defaultRegistry);
  const state = {
    engineMode: localStorage.getItem(MODE_KEY) === "v2" ? "v2" : "v3",
    ruleMode: "atomic",
    tier1: "context",
    tier2: null,
    tier3: null,
    ruleId: null,
    draft: loadRegistry(DRAFT_KEY, publishedRegistry),
    dirty: false,
    v2SaveState: { text: "草稿已保存", dirty: false }
  };
  runtime?.replaceV3RuleRegistry?.(publishedRegistry);

  const categories = [
    { id: "context", label: "场景条件", prefixes: ["context."] },
    { id: "personal", label: "个人特征", prefixes: ["appearance.", "body.", "face."] },
    { id: "preference", label: "风格偏好", prefixes: ["preference."] },
    { id: "goal", label: "目标边界", prefixes: ["goal.", "boundaries."] }
  ];
  const relationLabels = {
    temperature: "温度与热舒适", occasion: "场合与环境", color: "外观色彩", body: "体型与比例", face: "脸型与领口",
    style: "风格方向", formality: "正式程度", trend: "潮流方向", palette: "色系偏好", goal: "调整目标", boundaries: "穿着边界"
  };
  const operationLabels = { REQUIRE: "必须满足", ALLOW: "允许范围", PREFER: "优先选择", AVOID: "尽量回避", FORBID: "禁止出现", RANGE: "目标范围", ANNOTATE: "补充说明", SET_DERIVED: "派生结果" };
  const valueLabels = {
    long: "长袖", threeQuarter: "七分袖", short: "短袖", none: "无", light: "轻量", warm: "保暖",
    straight: "直筒", wide: "阔腿", tapered: "锥形", aLine: "A型", column: "直筒裙", raised: "偏高腰位", natural: "自然腰位",
    fitted: "修身", regular: "合体", oversized: "宽松", onePieceDress: "一件式", separatesTrouser: "分体裤装", separatesSkirt: "分体裙装",
    cool: "冷调", neutral: "中性", warmLean: "偏暖", coolLean: "偏冷", coldSensitive: "容易觉得冷", standard: "标准体感", heatSensitive: "容易觉得热", high: "高", medium: "中", low: "低",
    skirt: "裙装", tight: "紧绷贴身", definedWaist: "明显收腰", deepNeck: "低领开阔",
    torso: "躯干", armsUpper: "上臂", armsLower: "前臂", hips: "臀胯", legsUpper: "大腿", legsLower: "小腿", feet: "足部",
    relaxedTailoring: "松弛剪裁", utilityLayering: "轻机能层次", sheerLayering: "轻透叠穿"
  };
  const rangeLabels = {
    min: "最低", max: "最高", preferred: "建议", tolerance: "容差", requiredAreas: "覆盖区域", hardGate: "硬门槛",
    contrastMode: "对比方式", nearFacePalette: "近脸色谱", distribution: "全身配色", compatible: "兼容色", forbidden: "避开色",
    main: "主色", nearFace: "近脸色", accent: "点缀色"
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function conditionParts(condition) {
    if (condition?.field) return [condition];
    return [...(condition?.all || []), ...(condition?.any || [])].flatMap(conditionParts);
  }

  function categoryFor(rule) {
    const names = conditionParts(rule.when).map((part) => part.field);
    return categories.find((category) => names.every((name) => category.prefixes.some((prefix) => name.startsWith(prefix))))?.id || "personal";
  }

  function relationFor(rule) {
    const names = conditionParts(rule.when).map((part) => part.field);
    if (names.some((name) => name === "context.temperatureRange")) return "temperature";
    if (names.some((name) => name.startsWith("context."))) return "occasion";
    if (names.some((name) => name.startsWith("appearance."))) return "color";
    if (names.some((name) => name.startsWith("body."))) return "body";
    if (names.some((name) => name.startsWith("face."))) return "face";
    if (names.some((name) => name === "preference.formality")) return "formality";
    if (names.some((name) => name === "preference.palette")) return "palette";
    if (names.some((name) => name.startsWith("preference.trend"))) return "trend";
    if (names.some((name) => name.startsWith("preference."))) return "style";
    if (names.some((name) => name.startsWith("boundaries."))) return "boundaries";
    return "goal";
  }

  function fieldGroup(rule) {
    return conditionParts(rule.when).map((part) => part.field).join("|");
  }

  function branchEntryLabel(rule) {
    return conditionParts(rule.when).map((part) => Array.isArray(part.value)
      ? part.value.map((value) => optionLabel(part.field, value)).join("、")
      : optionLabel(part.field, part.value)).join(" · ");
  }

  function rulesForState() {
    return (state.draft?.rules || []).filter((rule) => rule.kind === state.ruleMode && categoryFor(rule) === state.tier1);
  }

  function fieldLabel(id) {
    return inputMap.get(id)?.label || id;
  }

  function optionLabel(fieldId, value) {
    const field = inputMap.get(fieldId);
    return field?.options?.find(([option]) => String(option) === String(value))?.[1] || valueLabels[value] || value;
  }

  function conditionLabel(rule) {
    return conditionParts(rule.when).map((part) => `${fieldLabel(part.field)}为${Array.isArray(part.value) ? part.value.map((value) => optionLabel(part.field, value)).join("、") : optionLabel(part.field, part.value)}`).join("，且");
  }

  function targetLabel(target) {
    if (target.startsWith("effect.")) return effectMap.get(target)?.label || "组合效果";
    if (target.startsWith("capability.")) return capabilityMap.get(target.slice("capability.".length))?.label || "单品能力";
    if (target.startsWith("output.")) return outputMap.get(target.slice("output.".length))?.label || "候选结果";
    if (target === "derived.color.profile") return "色彩画像";
    if (target === "derived.style.plugins") return "风格插件";
    return target.startsWith("trace.") ? "规则说明" : "派生事实";
  }

  function displayValue(value, target) {
    if (Array.isArray(value)) return value.map((item) => displayValue(item, target)).join("、");
    if (value && typeof value === "object") return Object.entries(value).map(([key, item]) => `${rangeLabels[key] || valueLabels[key] || key}：${displayValue(item, target)}`).join("；");
    const outputField = target?.startsWith("output.") ? outputMap.get(target.slice("output.".length)) : null;
    const outputLabel = outputField?.options?.find(([option]) => String(option) === String(value))?.[1];
    return outputLabel || valueLabels[value] || (value === true ? "是" : value === false ? "否" : String(value));
  }

  function normalizeSelection() {
    const tier1Rules = rulesForState();
    const relations = [...new Set(tier1Rules.map(relationFor))];
    if (!relations.includes(state.tier2)) state.tier2 = relations[0] || null;
    const relationRules = tier1Rules.filter((rule) => relationFor(rule) === state.tier2);
    const groups = [...new Set(relationRules.map(fieldGroup))];
    if (!groups.includes(state.tier3)) state.tier3 = groups[0] || null;
    const groupRules = relationRules.filter((rule) => fieldGroup(rule) === state.tier3);
    if (!groupRules.some((rule) => rule.id === state.ruleId)) state.ruleId = groupRules[0]?.id || null;
  }

  function renderNavigation() {
    normalizeSelection();
    const tier1Rules = rulesForState();
    const relations = [...new Set(tier1Rules.map(relationFor))];
    const relationRules = tier1Rules.filter((rule) => relationFor(rule) === state.tier2);
    const groups = [...new Set(relationRules.map(fieldGroup))];
    const groupRules = relationRules.filter((rule) => fieldGroup(rule) === state.tier3);
    $("#v3Tier1").innerHTML = categories.map((category) => `<button type="button" class="${category.id === state.tier1 ? "is-active" : ""}" data-v3-tier1="${category.id}">${category.label}</button>`).join("");
    $("#v3Tier2").innerHTML = relations.map((relation) => `<button type="button" class="${relation === state.tier2 ? "is-active" : ""}" data-v3-tier2="${relation}">${relationLabels[relation]}</button>`).join("");
    $("#v3Tier3").innerHTML = groups.map((group) => `<button type="button" class="${group === state.tier3 ? "is-active" : ""}" data-v3-tier3="${escapeHtml(group)}">${group.split("|").map(fieldLabel).join(" × ")}</button>`).join("");
    $("#v3Tier4").innerHTML = groupRules.map((rule) => `<button type="button" class="${rule.id === state.ruleId ? "is-active" : ""}" data-v3-rule-id="${rule.id}" title="${escapeHtml(conditionLabel(rule))}">${escapeHtml(branchEntryLabel(rule))}</button>`).join("");
  }

  function namespaceFor(target) {
    return (actionContract?.targetNamespaces || []).find((namespace) => target.startsWith(namespace.namespace));
  }

  function allowedOperations(target) {
    return namespaceFor(target)?.allowedOperations || [];
  }

  function targetChoices(currentTarget) {
    const groups = [
      ["共同效果", [...effectMap.keys()].map((id) => [id, effectMap.get(id).label])],
      ["单品能力", [...capabilityMap.keys()].map((id) => [`capability.${id}`, capabilityMap.get(id).label])],
      ["候选结果", [...outputMap.keys()].map((id) => [`output.${id}`, outputMap.get(id).label])]
    ];
    const specialTargets = [...new Set((state.draft?.rules || []).flatMap((rule) => rule.actions || []).map((action) => action.target))];
    const derivedTargets = specialTargets.filter((target) => target.startsWith("derived."));
    const traceTargets = specialTargets.filter((target) => target.startsWith("trace."));
    if (currentTarget.startsWith("derived.") && !derivedTargets.includes(currentTarget)) derivedTargets.push(currentTarget);
    if (currentTarget.startsWith("trace.") && !traceTargets.includes(currentTarget)) traceTargets.push(currentTarget);
    if (derivedTargets.length) groups.push(["派生事实", derivedTargets.map((target) => [target, targetLabel(target)])]);
    if (traceTargets.length) groups.push(["规则说明", traceTargets.map((target) => [target, targetLabel(target)])]);
    return groups;
  }

  function targetDefinition(target) {
    if (target.startsWith("effect.")) return effectMap.get(target);
    if (target.startsWith("capability.")) return capabilityMap.get(target.slice("capability.".length));
    if (target.startsWith("output.")) return outputMap.get(target.slice("output.".length));
    return null;
  }

  function valueOptions(target) {
    const definition = targetDefinition(target);
    if (definition?.options) return definition.options.map((option) => Array.isArray(option) ? option : [option, valueLabels[option] || option]);
    if (definition?.keys) return definition.keys.map((key) => [key, valueLabels[key] || key]);
    return [];
  }

  function reverseDisplayValue(value) {
    const pair = Object.entries(valueLabels).find(([, label]) => label === value);
    return pair?.[0] || value;
  }

  function flattenLeaves(value, path = []) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.entries(value).flatMap(([key, child]) => flattenLeaves(child, [...path, key]));
    }
    return [{ path, value }];
  }

  function renderRangeEditor(action, index) {
    const range = action.value && typeof action.value === "object" && !Array.isArray(action.value) ? action.value : {};
    const numericKeys = ["min", "max", "preferred", "tolerance"];
    return `<div class="v3-range-editor">${numericKeys.map((key) => `<label><span>${rangeLabels[key]}</span><input type="number" min="0" max="5" step="0.1" data-v3-action-range="${key}" data-v3-action-index="${index}" value="${range[key] ?? ""}"></label>`).join("")}<label class="v3-hard-gate"><input type="checkbox" data-v3-action-hard-gate data-v3-action-index="${index}" ${action.hardGate || range.hardGate ? "checked" : ""}><span>作为硬门槛</span></label></div>`;
  }

  function renderStructuredEditor(action, index) {
    return `<div class="v3-structured-editor">${flattenLeaves(action.value).map((leaf) => {
      const key = leaf.path.at(-1) || "value";
      const label = leaf.path.map((part) => rangeLabels[part] || valueLabels[part] || part).join(" / ");
      const kind = Array.isArray(leaf.value) ? "array" : typeof leaf.value;
      const display = Array.isArray(leaf.value) ? leaf.value.map((item) => displayValue(item, action.target)).join("、") : displayValue(leaf.value, action.target);
      if (kind === "boolean") return `<label><span>${escapeHtml(label)}</span><input type="checkbox" data-v3-value-path="${escapeHtml(leaf.path.join("."))}" data-v3-value-kind="boolean" data-v3-action-index="${index}" ${leaf.value ? "checked" : ""}></label>`;
      return `<label><span>${escapeHtml(label)}</span><input type="${kind === "number" ? "number" : "text"}" ${kind === "number" ? 'min="0" max="5" step="0.1"' : ""} data-v3-value-path="${escapeHtml(leaf.path.join("."))}" data-v3-value-kind="${kind}" data-v3-action-index="${index}" value="${escapeHtml(display)}"></label>`;
    }).join("")}</div>`;
  }

  function renderValueEditor(action, index) {
    if (action.operation === "RANGE") return renderRangeEditor(action, index);
    const options = valueOptions(action.target);
    if (options.length) {
      const selected = Array.isArray(action.value) ? action.value : [action.value];
      return `<div class="v3-value-options">${options.map(([value, label]) => `<label><input type="checkbox" data-v3-action-option data-v3-action-index="${index}" value="${escapeHtml(value)}" ${selected.some((item) => String(item) === String(value)) ? "checked" : ""}><span>${escapeHtml(label)}</span></label>`).join("")}</div>`;
    }
    if (action.value && typeof action.value === "object") return renderStructuredEditor(action, index);
    const kind = Array.isArray(action.value) ? "array" : typeof action.value;
    const display = Array.isArray(action.value) ? action.value.map((item) => displayValue(item, action.target)).join("、") : displayValue(action.value, action.target);
    return `<input class="v3-simple-value" type="${kind === "number" ? "number" : "text"}" data-v3-action-value data-v3-value-kind="${kind}" data-v3-action-index="${index}" value="${escapeHtml(display)}">`;
  }

  function renderActionEditor(action, index) {
    const targetGroups = targetChoices(action.target).map(([label, choices]) => `<optgroup label="${escapeHtml(label)}">${choices.map(([target, targetName]) => `<option value="${escapeHtml(target)}" ${target === action.target ? "selected" : ""}>${escapeHtml(targetName)}</option>`).join("")}</optgroup>`).join("");
    return `<div class="v3-action-editor-row" data-v3-action-row="${index}">
      <select data-v3-action-operation data-v3-action-index="${index}" aria-label="动作类型">${allowedOperations(action.target).map((operation) => `<option value="${operation}" ${operation === action.operation ? "selected" : ""}>${operationLabels[operation]}</option>`).join("")}</select>
      <select data-v3-action-target data-v3-action-index="${index}" aria-label="影响内容">${targetGroups}</select>
      <div class="v3-action-value-editor">${renderValueEditor(action, index)}</div>
      <button class="icon-button is-danger" type="button" data-v3-delete-action="${index}" title="删除动作" aria-label="删除动作">×</button>
    </div>`;
  }

  function objectiveTemperatureId(rule) {
    const parts = conditionParts(rule?.when);
    return parts.length === 1 && parts[0].field === "context.temperatureRange" ? parts[0].value : null;
  }

  function isObjectiveTemperatureRule(rule) {
    return Boolean(objectiveTemperatureId(rule));
  }

  function objectiveTargetRows(rule) {
    return (rule.actions || []).filter((action) => ["RANGE", "REQUIRE", "PREFER"].includes(action.operation)).map((action) => {
      const value = displayValue(action.value, action.target);
      return `<div class="v3-action-row"><span>${action.operation === "PREFER" ? "偏好" : "共同效果"}</span><strong>${escapeHtml(targetLabel(action.target))}</strong><em title="${escapeHtml(value)}">${escapeHtml(value)}</em></div>`;
    }).join("");
  }

  function renderObjectiveCalibration(rule) {
    const profileId = objectiveTemperatureId(rule);
    const profile = global.GarmentObjectiveProfileRegistry?.temperatureProfiles?.[profileId];
    const calibration = rule.metadata?.objectiveCalibration || {};
    const shift = typeof calibration.globalShift === "number" ? calibration.globalShift : 0;
    const warmth = profile?.targets?.["effect.thermal.warmth"] || {};
    const breathability = profile?.targets?.["effect.thermal.breathability"] || {};
    return `<div class="v3-objective-calibration">
      <div class="v3-objective-calibration-head"><strong>客观组合基准</strong><span>系统根据单品属性自动生成多种合格组合，不固定层数或具体单品。</span></div>
      <div class="v3-objective-calibration-grid">
        <div><span>当前温度</span><strong>${escapeHtml(profile?.label || profileId)}</strong></div>
        <div><span>保暖估算范围</span><strong>${warmth.min ?? "—"} 至 ${warmth.max ?? "—"}</strong></div>
        <div><span>透气最低约束</span><strong>${breathability.min ?? "—"}</strong></div>
        <label><span>全局基准偏移</span><input type="number" min="-0.75" max="0.75" step="0.05" value="${shift}" data-v3-objective-shift><small>范围 -0.75 至 0.75</small></label>
      </div>
      <p class="v3-objective-calibration-note">这里调整的是组合效果估算基准；保存后，案例运行会重新计算候选组合，不会直接把结果写成固定层数或指定单品。</p>
    </div>`;
  }

  function renderEditor() {
    const rule = state.draft.rules.find((item) => item.id === state.ruleId);
    if (!rule) {
      $("#v3EditorContent").innerHTML = `<div class="editor-empty"><strong>当前分类暂无${state.ruleMode === "atomic" ? "单项" : "协同"}规则</strong></div>`;
      return;
    }
    const objectiveRule = isObjectiveTemperatureRule(rule);
    const targets = [...new Map(rule.actions.map((action) => [action.target, targetLabel(action.target)])).values()];
    const actionRows = (objectiveRule ? objectiveTargetRows(rule) : rule.actions.map((action) => {
      const value = displayValue(action.value, action.target);
      return `<div class="v3-action-row"><span>${operationLabels[action.operation]}</span><strong>${escapeHtml(targetLabel(action.target))}</strong><em title="${escapeHtml(value)}">${escapeHtml(value)}</em></div>`;
    }).join(""));
    const regularConfig = `<article class="v3-natural-rule-card">
          <section class="v3-rule-clause v3-rule-clause--when"><div class="v3-rule-clause-label">当</div><p class="v3-when-statement">${escapeHtml(conditionLabel(rule))}时</p></section>
          <section class="v3-rule-clause v3-rule-clause--then"><div class="v3-rule-clause-label">则</div><div class="v3-action-editor-list">${rule.actions.map(renderActionEditor).join("")}</div><button class="text-button v3-add-action" type="button" data-v3-add-action>＋ 添加影响内容</button></section>
          <section class="v3-rule-clause v3-rule-clause--why"><div class="v3-rule-clause-label">依据</div><textarea rows="5" data-v3-rule-reason>${escapeHtml(rule.actions.map((action) => action.reason).filter((reason, index, all) => all.indexOf(reason) === index).join("；"))}</textarea></section>
        </article>`;
    const objectiveConfig = `<div class="v3-objective-when"><div class="v3-rule-clause-label">当</div><p class="v3-when-statement">${escapeHtml(conditionLabel(rule))}时，系统自动计算候选组合。</p></div>${renderObjectiveCalibration(rule)}<div class="v3-objective-why"><div class="v3-rule-clause-label">依据</div><p>${escapeHtml(rule.actions.map((action) => action.reason).filter((reason, index, all) => all.indexOf(reason) === index).join("；"))}</p></div>`;
    $("#v3EditorContent").innerHTML = `
      <section class="v3-rule-summary">
        <div class="v3-rule-summary-submodule v3-relation-impact"><div class="v3-rule-summary-heading"><span class="module-index">01</span><div><strong>关系影响输出</strong></div></div><div class="scope-pill-list">${targets.map((label) => `<span class="scope-pill">${escapeHtml(label)}</span>`).join("")}</div></div>
        <div class="v3-rule-summary-submodule v3-branch-output"><div class="v3-rule-summary-heading"><span class="module-index">02</span><div><strong>当前分支输出结果</strong><small>${escapeHtml(conditionLabel(rule))}</small></div></div><div class="v3-action-list">${actionRows}</div></div>
      </section>
      <section class="v3-rule-config">
        <div class="v3-rule-config-heading"><span>03</span><strong>规则配置</strong><small>${objectiveRule ? "客观组合基准 / 依据" : "条件 / 结果 / 依据"}</small><label class="v3-rule-enabled"><input type="checkbox" data-v3-rule-enabled ${rule.enabled !== false ? "checked" : ""}><span>启用分支</span></label></div>
        ${objectiveRule ? objectiveConfig : regularConfig}
      </section>`;
  }

  function currentRule() {
    return state.draft.rules.find((rule) => rule.id === state.ruleId) || null;
  }

  function recalculateTotals() {
    state.draft.totals ||= {};
    state.draft.totals.executableRules = state.draft.rules.length;
    state.draft.totals.atomicRules = state.draft.rules.filter((rule) => rule.kind === "atomic").length;
    state.draft.totals.jointRules = state.draft.rules.filter((rule) => rule.kind === "joint").length;
    state.draft.totals.actions = state.draft.rules.reduce((sum, rule) => sum + rule.actions.length, 0);
  }

  function markDirty() {
    state.dirty = true;
    state.draft.status = "user-draft";
    recalculateTotals();
    $("#saveState").textContent = "有未保存修改";
    $("#saveState").classList.add("is-dirty");
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    setTimeout(() => toast.classList.remove("is-visible"), 1800);
  }

  function setAtPath(target, path, value) {
    const parts = path.split(".").filter(Boolean);
    let current = target;
    parts.slice(0, -1).forEach((part) => {
      if (!current[part] || typeof current[part] !== "object") current[part] = {};
      current = current[part];
    });
    current[parts.at(-1)] = value;
  }

  function parseEditorValue(input) {
    const kind = input.dataset.v3ValueKind;
    if (kind === "boolean") return input.checked;
    if (kind === "number") return input.value === "" ? null : Number(input.value);
    if (kind === "array") return input.value.split(/[、,，]/).map((value) => reverseDisplayValue(value.trim())).filter(Boolean);
    return reverseDisplayValue(input.value);
  }

  function defaultActionValue(target, operation) {
    if (operation === "RANGE") return { preferred: 3, tolerance: 1 };
    if (operation === "ANNOTATE") return "补充业务说明";
    if (operation === "SET_DERIVED") return {};
    const options = valueOptions(target);
    if (options.length) return [options[0][0]];
    const definition = targetDefinition(target);
    if (definition?.kind === "ordinal" || definition?.kind === "number") return 3;
    return "";
  }

  function validateDraft() {
    const errors = [];
    const ruleIds = new Set();
    const actionIds = new Set();
    for (const rule of state.draft.rules) {
      if (ruleIds.has(rule.id)) errors.push("存在重复规则");
      ruleIds.add(rule.id);
      if (!rule.actions.length) errors.push(`${conditionLabel(rule)}没有配置结果`);
      for (const action of rule.actions) {
        if (actionIds.has(action.id)) errors.push(`${conditionLabel(rule)}存在重复动作`);
        actionIds.add(action.id);
        const namespace = namespaceFor(action.target);
        if (!namespace) errors.push(`${conditionLabel(rule)}包含未知影响内容`);
        else if (!namespace.allowedOperations.includes(action.operation)) errors.push(`${targetLabel(action.target)}不支持${operationLabels[action.operation] || action.operation}`);
        if (action.value === undefined || action.value === null || action.value === "") errors.push(`${targetLabel(action.target)}缺少具体值`);
        if (!action.reason?.trim()) errors.push(`${conditionLabel(rule)}缺少业务依据`);
      }
    }
    return [...new Set(errors)];
  }

  function saveDraft() {
    recalculateTotals();
    localStorage.setItem(DRAFT_KEY, JSON.stringify(state.draft));
    state.dirty = false;
    $("#saveState").textContent = "草稿已保存";
    $("#saveState").classList.remove("is-dirty");
    showToast("效果等价规则草稿已保存");
  }

  function publishDraft() {
    const errors = validateDraft();
    if (errors.length) {
      showToast(`发布前请修正：${errors[0]}`);
      return;
    }
    recalculateTotals();
    const published = clone(state.draft);
    published.status = "user-published";
    published.publishedAt = new Date().toISOString();
    localStorage.setItem(DRAFT_KEY, JSON.stringify(published));
    localStorage.setItem(PUBLISHED_KEY, JSON.stringify(published));
    runtime.replaceV3RuleRegistry(published);
    state.draft = clone(published);
    state.dirty = false;
    $("#saveState").textContent = "规则已发布";
    $("#saveState").classList.remove("is-dirty");
    showToast("效果等价规则已发布");
    render();
  }

  function render() {
    const isV3 = state.engineMode === "v3";
    document.body.dataset.engineMode = state.engineMode;
    $(".rules-main")?.classList.toggle("is-v3-mode", isV3);
    $("#v3RulesView").hidden = !isV3;
    $(".rules-mode-bar").hidden = isV3;
    $("#overviewView").hidden = isV3 ? true : $("#rulesModeTabs button.is-active")?.dataset.rulesMode !== "overview";
    $("#configureView").hidden = isV3 ? true : $("#rulesModeTabs button.is-active")?.dataset.rulesMode !== "configure";
    $("#saveButton").hidden = isV3;
    $("#publishButton").hidden = isV3;
    $("#v3SaveButton").hidden = !isV3;
    $("#v3PublishButton").hidden = !isV3;
    if (isV3) {
      $("#saveState").textContent = state.dirty ? "有未保存修改" : ["user-published", "user-published-shadow"].includes(state.draft.status) ? "规则已发布" : "草稿已保存";
      $("#saveState").classList.toggle("is-dirty", state.dirty);
    } else {
      $("#saveState").textContent = state.v2SaveState.text;
      $("#saveState").classList.toggle("is-dirty", state.v2SaveState.dirty);
    }
    $("#engineModeBar").querySelectorAll("button[data-engine-mode]").forEach((button) => {
      const active = button.dataset.engineMode === state.engineMode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-checked", String(active));
    });
    if (!isV3) return;
    $("#v3WorkbenchMeta").innerHTML = `<span>${state.draft.totals.executableRules} 条规则</span><span>${state.draft.totals.actions} 个动作</span><span>${state.draft.totals.alternativeCells} 组备选已保留</span>`;
    $("#v3RuleMode").querySelectorAll("button[data-v3-rule-mode]").forEach((button) => {
      const active = button.dataset.v3RuleMode === state.ruleMode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    renderNavigation();
    renderEditor();
    requestAnimationFrame(() => {
      const activeNavigation = [...document.querySelectorAll("#v3RulesView .v3-tier-bar button.is-active")].at(-1);
      activeNavigation?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }

  function bind() {
    $("#engineModeBar").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-engine-mode]");
      if (!button) return;
      if (state.engineMode === "v2" && button.dataset.engineMode === "v3") {
        state.v2SaveState = {
          text: $("#saveState").textContent,
          dirty: $("#saveState").classList.contains("is-dirty")
        };
      }
      state.engineMode = button.dataset.engineMode;
      localStorage.setItem(MODE_KEY, state.engineMode);
      render();
    });
    $("#v3RuleMode").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-v3-rule-mode]");
      if (!button) return;
      state.ruleMode = button.dataset.v3RuleMode;
      state.ruleId = null;
      render();
    });
    $("#v3SaveButton").addEventListener("click", saveDraft);
    $("#v3PublishButton").addEventListener("click", publishDraft);
    $("#v3RulesView").addEventListener("click", (event) => {
      const addAction = event.target.closest("button[data-v3-add-action]");
      const deleteAction = event.target.closest("button[data-v3-delete-action]");
      if (addAction) {
        const rule = currentRule();
        if (isObjectiveTemperatureRule(rule)) { showToast("客观温度分支由组合引擎计算，不能直接添加固定结果"); return; }
        const target = rule.actions[0]?.target || "effect.style.styleCoherence";
        const operations = allowedOperations(target);
        const operation = operations.includes("PREFER") ? "PREFER" : operations[0];
        rule.actions.push({
          id: `${rule.id}-USER-${Date.now()}`,
          operation,
          target,
          value: defaultActionValue(target, operation),
          sourceRuleId: rule.id,
          sourceInput: conditionParts(rule.when).map((part) => part.field),
          reason: rule.actions[0]?.reason || "补充候选影响规则。",
          weight: operation === "PREFER" || operation === "AVOID" ? 0.5 : undefined,
          metadata: { userAdded: true }
        });
        markDirty();
        render();
        return;
      }
      if (deleteAction) {
        const rule = currentRule();
        if (isObjectiveTemperatureRule(rule)) { showToast("客观温度分支不能删除计算约束"); return; }
        if (rule.actions.length <= 1) { showToast("每个分支至少保留一个结果动作"); return; }
        rule.actions.splice(Number(deleteAction.dataset.v3DeleteAction), 1);
        markDirty();
        render();
        return;
      }
      const tier1 = event.target.closest("button[data-v3-tier1]");
      const tier2 = event.target.closest("button[data-v3-tier2]");
      const tier3 = event.target.closest("button[data-v3-tier3]");
      const rule = event.target.closest("button[data-v3-rule-id]");
      if (tier1) { state.tier1 = tier1.dataset.v3Tier1; state.tier2 = null; state.tier3 = null; state.ruleId = null; }
      else if (tier2) { state.tier2 = tier2.dataset.v3Tier2; state.tier3 = null; state.ruleId = null; }
      else if (tier3) { state.tier3 = tier3.dataset.v3Tier3; state.ruleId = null; }
      else if (rule) state.ruleId = rule.dataset.v3RuleId;
      else return;
      render();
    });
    $("#v3RulesView").addEventListener("change", (event) => {
      const rule = currentRule();
      if (!rule) return;
      if (event.target.matches("[data-v3-objective-shift]")) {
        rule.metadata ||= {};
        rule.metadata.objectiveCalibration ||= {};
        const value = event.target.value === "" ? 0 : Number(event.target.value);
        rule.metadata.objectiveCalibration.globalShift = Math.max(-0.75, Math.min(0.75, Number.isFinite(value) ? value : 0));
        markDirty();
        render();
        return;
      }
      const index = Number(event.target.dataset.v3ActionIndex);
      const action = Number.isInteger(index) ? rule.actions[index] : null;
      if (event.target.matches("[data-v3-rule-enabled]")) rule.enabled = event.target.checked;
      else if (event.target.matches("[data-v3-action-operation]")) {
        action.operation = event.target.value;
        action.value = defaultActionValue(action.target, action.operation);
        if (["PREFER", "AVOID"].includes(action.operation)) action.weight ??= 0.5;
      } else if (event.target.matches("[data-v3-action-target]")) {
        action.target = event.target.value;
        const operations = allowedOperations(action.target);
        if (!operations.includes(action.operation)) action.operation = operations.includes("PREFER") ? "PREFER" : operations[0];
        action.value = defaultActionValue(action.target, action.operation);
      } else if (event.target.matches("[data-v3-action-range]")) {
        action.value ||= {};
        const key = event.target.dataset.v3ActionRange;
        if (event.target.value === "") delete action.value[key];
        else action.value[key] = Number(event.target.value);
      } else if (event.target.matches("[data-v3-action-hard-gate]")) {
        action.hardGate = event.target.checked;
        if (action.value && typeof action.value === "object") delete action.value.hardGate;
      } else if (event.target.matches("[data-v3-action-option]")) {
        const checked = [...event.target.closest(".v3-value-options").querySelectorAll("input:checked")].map((input) => input.value);
        action.value = checked;
      } else if (event.target.matches("[data-v3-action-value]")) action.value = parseEditorValue(event.target);
      else if (event.target.matches("[data-v3-value-path]")) setAtPath(action.value, event.target.dataset.v3ValuePath, parseEditorValue(event.target));
      else return;
      markDirty();
      render();
    });
    $("#v3RulesView").addEventListener("input", (event) => {
      if (!event.target.matches("[data-v3-rule-reason]")) return;
      const rule = currentRule();
      rule.actions.forEach((action) => { action.reason = event.target.value; });
      markDirty();
    });
  }

  queueMicrotask(() => { bind(); render(); });
}(window));
