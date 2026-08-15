(function () {
  "use strict";

  const DATA = window.GarmentPrototypeData;
  const Engine = window.GarmentRuleEngine;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const overviewGroups = [
    {
      id: "wear",
      name: "穿着框架",
      fields: [
        { id: "layerCount", name: "层数" },
        { id: "sleeve", name: "袖长" },
        { id: "outer", name: "外层" },
        { id: "coverage", name: "覆盖" },
        { id: "material", name: "厚薄" },
        { id: "formality", name: "正式完成度" },
        { id: "movement", name: "行动便利" }
      ]
    },
    {
      id: "style",
      name: "服装样式",
      fields: [
        { id: "silhouette", name: "外轮廓" },
        { id: "length", name: "上下长度" },
        { id: "waist", name: "腰位" },
        { id: "volume", name: "服装量感" },
        { id: "neckline", name: "领口" },
        { id: "details", name: "款式细节" }
      ]
    },
    {
      id: "color",
      name: "颜色搭配",
      fields: [
        { id: "temperature", name: "色温" },
        { id: "contrast", name: "明度对比" },
        { id: "chroma", name: "彩度" },
        { id: "palette", name: "配色方案" },
        { id: "placement", name: "颜色位置" }
      ]
    }
  ];

  const overviewImpactLabels = {
    strong: "直接影响",
    medium: "间接影响",
    light: "条件影响"
  };

  const businessDefinitions = [
    { id: "temperature", name: "温度与层次", topics: ["温度与层次"], inputs: ["近期温度"], outputs: ["层数", "袖长", "外层", "覆盖程度", "材质厚薄"], overview: { wear: { layerCount: "strong", sleeve: "strong", outer: "strong", coverage: "strong", material: "strong" } }, hard: true },
    { id: "occasion", name: "场合要求", topics: ["场合要求"], inputs: ["使用场合"], outputs: ["正式完成度", "行动便利"], overview: { wear: { formality: "strong", movement: "medium" } } },
    { id: "color", name: "整体色彩", topics: ["整体色彩"], inputs: ["肤色", "发色", "眼睛颜色"], outputs: ["服装色温", "明度对比", "彩度", "配色方案"], overview: { color: { temperature: "strong", contrast: "strong", chroma: "medium", palette: "strong", placement: "medium" } } },
    { id: "body", name: "身材与比例", topics: ["身材与比例"], inputs: ["身高表现", "腿身比例", "腰线", "肩胯关系"], outputs: ["外轮廓", "上下长度", "腰位", "线条方向", "服装量感"], overview: { style: { silhouette: "medium", length: "strong", waist: "strong", volume: "medium", details: "light" } } },
    { id: "face", name: "脸型与领口", topics: ["脸型与领口"], inputs: ["脸型"], outputs: ["领口方向"], overview: { style: { neckline: "strong" } } },
    { id: "style", name: "风格方向", topics: ["风格方向"], inputs: ["风格方向"], outputs: ["外轮廓", "服装量感", "款式细节", "表面纹理"], overview: { style: { silhouette: "strong", volume: "strong", details: "strong" } } },
    { id: "formality", name: "正式程度", topics: ["正式程度"], inputs: ["正式程度"], outputs: ["结构完成度", "材质表面"], overview: { wear: { formality: "strong" }, style: { silhouette: "medium", details: "medium" } } },
    { id: "trend", name: "潮流方向", topics: ["潮流方向"], inputs: ["潮流方向", "表达强度"], outputs: ["外轮廓", "服装量感", "表面纹理", "款式细节"], overview: { style: { silhouette: "medium", volume: "medium", details: "strong" } } },
    { id: "goal", name: "本次偏好", topics: ["本次偏好"], inputs: ["想调整什么", "希望如何调整"], outputs: ["腰位", "线条方向", "配色对比"], overview: { style: { length: "medium", waist: "strong" }, color: { contrast: "medium" } } },
    { id: "boundaries", name: "拒绝与边界", topics: ["拒绝与边界"], inputs: ["明确拒绝", "身体边界"], outputs: ["覆盖程度", "行动便利", "贴肤触感", "排除样式", "排除配色"], overview: { wear: { coverage: "strong", movement: "strong", material: "strong" }, style: { details: "strong" }, color: { contrast: "strong", palette: "strong" } }, hard: true }
  ];

  const resourceTabs = [
    { id: "inputs", label: "输入选项" },
    { id: "garments", label: "服装库" },
    { id: "palettes", label: "颜色搭配" },
    { id: "trends", label: "潮流方向" }
  ];

  const familyOptions = [["straight", "简洁直线"], ["tailored", "利落结构"], ["soft", "柔和收放"], ["relaxed", "自然留量"], ["street", "街头箱型"], ["retro", "复古收放"]];

  const state = {
    ruleSet: Engine.Store.loadDraft(),
    selectedId: null,
    resourceTab: "inputs",
    resourceGarmentFilter: "all",
    resourceGarmentSearch: "",
    memberSelection: {},
    branchSelection: {},
    mode: "overview",
    dirty: false,
    validation: null
  };

  init();

  function init() {
    state.selectedId = businessRelations()[0]?.id || null;
    bindEvents();
    renderAll();
  }

  function bindEvents() {
    $("#rulesModeTabs").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-rules-mode]");
      if (!button) return;
      state.mode = button.dataset.rulesMode;
      renderMode();
    });

    $("#overviewView").addEventListener("click", (event) => {
      const target = event.target.closest("button[data-overview-target]");
      if (!target) return;
      state.selectedId = target.dataset.overviewTarget;
      state.mode = "configure";
      renderAll();
    });

    $("#backToOverview").addEventListener("click", () => {
      state.mode = "overview";
      renderMode();
    });

    $("#relationSelect").addEventListener("change", (event) => {
      state.selectedId = event.target.value;
      renderRelationPicker();
      renderEditor();
    });

    $("#previousRelationButton").addEventListener("click", () => stepRelation(-1));
    $("#nextRelationButton").addEventListener("click", () => stepRelation(1));

    $("#editorContent").addEventListener("change", handleEditorChange);
    $("#editorContent").addEventListener("click", handleEditorClick);

    $("#duplicateButton").addEventListener("click", duplicateRule);
    $("#deleteButton").addEventListener("click", deleteRule);

    $("#saveButton").addEventListener("click", saveDraft);
    $("#publishButton").addEventListener("click", publishRules);
    $("#resetRulesButton").addEventListener("click", resetRules);

    $("#resourceButton").addEventListener("click", openResources);
    $("[data-close-resource]").addEventListener("click", () => $("#resourceDialog").close());
    $("#resourceDialog").addEventListener("click", (event) => { if (event.target === $("#resourceDialog")) $("#resourceDialog").close(); });

    const closeValBtn = $$("[data-close-validation]");
    closeValBtn.forEach((btn) => btn.addEventListener("click", () => $("#validationDialog")?.close()));

    const valContent = $("#validationContent");
    if (valContent) {
      valContent.addEventListener("click", (event) => {
        const jumpBtn = event.target.closest("button[data-jump-relation]");
        if (!jumpBtn) return;
        state.selectedId = jumpBtn.dataset.jumpRelation;
        if (jumpBtn.dataset.jumpBranch) {
          state.branchSelection[state.selectedId] = jumpBtn.dataset.jumpBranch;
        }
        state.mode = "configure";
        $("#validationDialog").close();
        renderAll();
      });
    }

    $("#resourceTabs").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-resource-tab]");
      if (!button) return;
      state.resourceTab = button.dataset.resourceTab;
      renderResources();
    });

    $("#resourceContent").addEventListener("change", handleResourceChange);
    $("#resourceContent").addEventListener("click", handleResourceClick);

    window.addEventListener("beforeunload", (event) => {
      if (!state.dirty) return;
      event.preventDefault();
      event.returnValue = "";
    });
  }

  function relations() {
    return [
      ...state.ruleSet.derivedRules.map((rule) => wrapRelation(rule, "analysis")),
      ...groupRelationBranches(state.ruleSet.decisionRules, "decision"),
      ...groupRelationBranches(state.ruleSet.outfitOutputs, "outfit"),
      ...groupRelationBranches(state.ruleSet.trendDirections || [], "trend")
    ];
  }

  function wrapRelation(rule, type) {
    const kind = type === "analysis" ? "analysis" : rule.kind === "hard" ? "hard" : "soft";
    return { id: rule.id, rule, type, kind, topic: topicFor(rule, type), domains: domainsFor(rule, type) };
  }

  function groupRelationBranches(rules, type) {
    const groups = new Map();
    rules.forEach((rule) => {
      const key = relationFamilyKey(rule, type);
      const current = groups.get(key) || [];
      current.push(rule);
      groups.set(key, current);
    });
    return [...groups.entries()].map(([key, branches]) => {
      if (branches.length === 1) return wrapRelation(branches[0], type);
      const name = relationFamilyName(key, branches, type);
      const topic = topicFor(branches[0], type);
      const domains = [...new Set(branches.flatMap((branch) => domainsFor(branch, type)))];
      const allHard = type === "decision" && branches.every((branch) => branch.kind === "hard");
      const pseudoRule = {
        id: `SET-${key}`,
        name,
        group: branches[0].group,
        enabled: branches.some((branch) => branch.enabled !== false),
        reason: `${branches.length} 种情况分别匹配对应处理。`
      };
      return { id: pseudoRule.id, rule: pseudoRule, rules: branches, type, kind: allHard ? "hard" : "soft", topic, domains };
    });
  }

  function relationFamilyKey(rule, type) {
    const id = rule.id || "";
    if (type === "trend") return "TREND-DIRECTION";
    if (type === "outfit") return `OUTFIT-${rule.group || id}`;
    const prefixes = ["TEMP", "OCCASION", "COLOR-TEMP", "COLOR-CONTRAST", "COLOR-CHROMA", "FACE-SHAPE", "BODY-PROPORTION", "GOAL-VERTICAL", "GOAL-WAIST", "GOAL-CONTRAST", "BOUNDARY"];
    return prefixes.find((prefix) => id.startsWith(prefix)) || id;
  }

  function relationFamilyName(key, branches, type) {
    const names = {
      TEMP: "近期温度与穿着层次",
      OCCASION: "场合与穿着要求",
      "COLOR-TEMP": "整体色温与服装色温",
      "COLOR-CONTRAST": "明度对比与配色层次",
      "COLOR-CHROMA": "整体彩度与服装彩度",
      "FACE-SHAPE": "脸型与领口方向",
      "BODY-PROPORTION": "身材比例与候选路线",
      "GOAL-VERTICAL": "整体修长感调整",
      "GOAL-WAIST": "腰线表现调整",
      "GOAL-CONTRAST": "配色对比调整",
      BOUNDARY: "明确拒绝与身体边界",
      "OUTFIT-风格方向": "风格与款式语言",
      "OUTFIT-正式程度": "正式程度与服装完成度",
      "TREND-DIRECTION": "潮流方向与款式表达"
    };
    return names[key] || (type === "outfit" ? `${branches[0].group}搭配关系` : branches[0].name);
  }

  function activeRule(relation) {
    if (!relation?.rules?.length) return relation?.rule || null;
    const selected = state.branchSelection[relation.id];
    return relation.rules.find((rule) => rule.id === selected) || relation.rules[0];
  }

  function topicFor(rule, type) {
    if (type === "trend") return "潮流方向";
    if (type === "analysis") return rule.output?.startsWith("color.") ? "整体色彩" : "身材与比例";
    if (rule.group === "温度") return "温度与层次";
    if (rule.group === "场合") return "场合要求";
    if (rule.group === "色彩") return "整体色彩";
    if (rule.group === "面部特征" || rule.id.startsWith("FACE-")) return "脸型与领口";
    if (rule.group?.includes("身材")) return "身材与比例";
    if (rule.group === "本次偏好") return "本次偏好";
    if (rule.group === "明确拒绝与身体边界") return "拒绝与边界";
    return rule.group || "款式表达";
  }

  function domainsFor(rule, type) {
    if (type === "analysis") return ["分析结果"];
    if (type === "trend") return ["版型比例", "颜色搭配"];
    if (type === "outfit") return [...new Set(Object.keys(rule.result || {}).map(domainForOutfitField).filter(Boolean))];
    return [...new Set((rule.actions || []).map((action) => domainForResultField(action.field)).filter(Boolean))];
  }

  function domainForResultField(field) {
    if (/layerCount|sleeve|outer|coverage|material|texture/.test(field)) return "厚薄层次";
    if (/formality|movement/.test(field)) return "场合完成度";
    if (/neckline|faceEffect/.test(field)) return "领口细节";
    if (/waist|line|family/.test(field)) return "版型比例";
    if (/color|palette/.test(field)) return "颜色搭配";
    if (/candidate|forbidden/.test(field)) return "边界排除";
    return "版型比例";
  }

  function domainForOutfitField(field) {
    if (["formality", "finish"].includes(field)) return "场合完成度";
    if (["family", "families", "silhouette", "proportion"].includes(field)) return "版型比例";
    if (["detail", "pattern", "trend", "detailIntensity", "note", "seasonVersion"].includes(field)) return "版型比例";
    return null;
  }

  function businessRelations() {
    const atomic = relations();
    return businessDefinitions.map((definition, order) => {
      const members = atomic.filter((relation) => definition.topics.includes(relation.topic));
      const mappingMembers = members.filter((relation) => relation.type !== "analysis");
      const derivations = members.filter((relation) => relation.type === "analysis");
      const rules = members.flatMap((relation) => relation.rules || [relation.rule]);
      return {
        ...definition,
        order,
        members,
        mappingMembers,
        derivations,
        rules,
        enabled: rules.some((rule) => rule.enabled !== false),
        branchCount: mappingMembers.reduce((count, relation) => count + (relation.rules?.length || 1), 0),
        domains: [...new Set(members.flatMap((relation) => relation.domains).filter((domain) => domain !== "分析结果"))]
      };
    }).filter((relation) => relation.members.length);
  }

  function businessRelationById(id) { return businessRelations().find((item) => item.id === id); }

  function activeAtomicRelation(business) {
    const mappings = business?.mappingMembers || [];
    const selected = state.memberSelection[business?.id];
    return mappings.find((relation) => relation.id === selected) || mappings[0] || null;
  }

  function renderAll() {
    state.validation = Engine.validateRuleSet(state.ruleSet);
    renderMode();
    renderOverview();
    renderRelationPicker();
    renderEditor();
    renderMeta();
  }

  function renderMode() {
    $("#rulesModeTabs").querySelectorAll("button[data-rules-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.rulesMode === state.mode);
    });
    $("#overviewView").hidden = state.mode !== "overview";
    $("#configureView").hidden = state.mode !== "configure";
  }

  function overviewImpact(group, domainId, fieldId) {
    return group.overview?.[domainId]?.[fieldId] || null;
  }

  function renderOverviewImpact(group, domain, field) {
    const level = overviewImpact(group, domain.id, field.id);
    if (!level) {
      return `<td class="overview-impact-cell is-empty"><span aria-label="${escapeHtml(group.name)}不影响${escapeHtml(field.name)}">—</span></td>`;
    }
    const label = overviewImpactLabels[level] || "有关联";
    return `<td class="overview-impact-cell is-${escapeHtml(level)}">
      <button type="button" data-overview-target="${escapeHtml(group.id)}" data-overview-domain="${escapeHtml(domain.id)}" data-overview-field="${escapeHtml(field.id)}" aria-label="${escapeHtml(group.name)}对${escapeHtml(field.name)}：${escapeHtml(label)}" title="${escapeHtml(group.name)} → ${escapeHtml(field.name)} (${escapeHtml(label)})，点击前往配置">
        <span class="impact-dot" aria-hidden="true"></span><span class="impact-status">${escapeHtml(label)}</span>
      </button>
    </td>`;
  }

  function renderOverview() {
    const groups = businessRelations();
    $("#overviewMatrix").innerHTML = `
      <thead>
        <tr>
          <th class="overview-row-heading" rowspan="2">输入主题</th>
          ${overviewGroups.map((group) => `<th class="overview-group-heading overview-group-${escapeHtml(group.id)}" colspan="${group.fields.length}">${escapeHtml(group.name)}</th>`).join("")}
        </tr>
        <tr>
          ${overviewGroups.flatMap((group) => group.fields.map((field) => `<th class="overview-field-heading overview-group-${escapeHtml(group.id)}">${escapeHtml(field.name)}</th>`)).join("")}
        </tr>
      </thead>
      <tbody>${groups.map((group) => `<tr class="${group.hard ? "is-hard" : ""}">
        <th class="overview-row-label"><span>${escapeHtml(group.name)}</span>${group.hard ? `<em>边界</em>` : `<em class="soft-tag">搭配</em>`}<small>${escapeHtml(group.inputs.join("、"))}</small></th>
        ${overviewGroups.flatMap((domain) => domain.fields.map((field) => renderOverviewImpact(group, domain, field))).join("")}
      </tr>`).join("")}</tbody>`;

    $("#overviewMobileList").innerHTML = groups.map((group) => {
      const impacts = [];
      overviewGroups.forEach(domain => {
        domain.fields.forEach(field => {
          const level = overviewImpact(group, domain.id, field.id);
          if (level) {
            impacts.push({ domain, field, level });
          }
        });
      });
      if (impacts.length === 0) return '';
      return `
        <div class="mobile-relation-card ${group.hard ? "is-hard" : ""}">
          <div class="mobile-relation-header">
            <div>
              <strong>${escapeHtml(group.name)}</strong>
              ${group.hard ? `<em>边界</em>` : `<em class="soft-tag">搭配</em>`}
            </div>
            <small>${escapeHtml(group.inputs.join("、"))}</small>
          </div>
          <div class="mobile-relation-impacts">
            ${impacts.map(i => {
              const label = overviewImpactLabels[i.level] || "有关联";
              return `
                <button type="button" class="mobile-impact-item is-${escapeHtml(i.level)}" 
                  data-overview-target="${escapeHtml(group.id)}" 
                  data-overview-domain="${escapeHtml(i.domain.id)}" 
                  data-overview-field="${escapeHtml(i.field.id)}"
                  aria-label="${escapeHtml(group.name)}对${escapeHtml(i.field.name)}：${escapeHtml(label)}">
                  <span class="impact-field">${escapeHtml(i.field.name)}</span>
                  <div class="impact-status-wrap">
                    <span class="impact-dot" aria-hidden="true"></span>
                    <span class="impact-status">${escapeHtml(label)}</span>
                  </div>
                </button>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }).join("");
  }

  function renderRelationPicker() {
    const groups = businessRelations();
    if (!groups.length) {
      $("#relationSelect").innerHTML = "<option value=\"\">暂无可配置关系</option>";
      $("#relationStatus").textContent = "暂无关系";
      $("#previousRelationButton").disabled = true;
      $("#nextRelationButton").disabled = true;
      return;
    }
    if (!groups.some((group) => group.id === state.selectedId)) state.selectedId = groups[0].id;
    const index = groups.findIndex((group) => group.id === state.selectedId);
    const selected = groups[index];
    $("#relationSelect").innerHTML = groups.map((group) => `<option value="${escapeHtml(group.id)}" ${group.id === selected.id ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("");
    $("#relationStatus").textContent = `${index + 1} / ${groups.length} · ${selected.enabled ? "已启用" : "已停用"} · ${selected.branchCount || 0} 个分支`;
    $("#previousRelationButton").disabled = index <= 0;
    $("#nextRelationButton").disabled = index >= groups.length - 1;
  }

  function stepRelation(direction) {
    const groups = businessRelations();
    const index = groups.findIndex((group) => group.id === state.selectedId);
    const nextIndex = Math.max(0, Math.min(groups.length - 1, index + direction));
    if (nextIndex === index || !groups[nextIndex]) return;
    state.selectedId = groups[nextIndex].id;
    renderRelationPicker();
    renderEditor();
  }

  function renderEditor() {
    const business = businessRelationById(state.selectedId);
    $("#editorTitle").textContent = business?.name || "选择一组关系";
    $("#editorKicker").textContent = business?.hard ? "硬性边界配置" : "关系配置";
    $("#editorSummary").textContent = business ? `${business.inputs.join("、")} → ${business.outputs.join("、")}` : "选择一条关系开始配置。";
    $("#editorActions").hidden = !business?.mappingMembers.length;
    if (!business) {
      $("#editorContent").innerHTML = `<div class="editor-empty"><strong>选择一条关系开始配置</strong></div>`;
      return;
    }
    const relation = activeAtomicRelation(business);
    if (!relation) {
      $("#editorContent").innerHTML = renderCalculationDetails(business, true);
      return;
    }
    const editable = activeRule(relation);
    editable.analysis ||= { conclusion: editable.name, direction: editable.reason || "" };
    const memberSelector = business.mappingMembers.length > 1 ? renderMemberSelector(business, relation) : "";
    const branchBar = relation.rules?.length ? renderBranchBar(relation, editable) : "";
    const editableRelation = { ...relation, rule: editable };
    $("#editorContent").innerHTML = memberSelector + branchBar + renderMappingEditor(editableRelation, business) + renderCalculationDetails(business);
  }

  function renderMemberSelector(business, relation) {
    return `<section class="member-selector"><label><span>配置内容</span><select data-member-select>${business.mappingMembers.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === relation.id ? "selected" : ""}>${escapeHtml(item.rule.name)}</option>`).join("")}</select></label></section>`;
  }

  function renderBranchBar(relation, editable) {
    const branches = relation.rules || [];
    return `
      <section class="branch-bar-section">
        <div class="branch-bar-header">
          <div class="branch-bar-label">
            <span>匹配分支概览</span>
            <strong>共 ${branches.length} 个分支</strong>
          </div>
          <button type="button" class="text-button" id="addBranchBtn" title="新增匹配分支">＋ 新增分支</button>
        </div>
        <div class="branch-segmented-bar" role="tablist" aria-label="分支切换">
          ${branches.map((rule) => {
            const isActive = rule.id === editable.id;
            const isEnabled = rule.enabled !== false;
            const summary = ruleBranchSummary(rule, relation.type);
            return `
              <button type="button" role="tab" aria-selected="${isActive}" class="branch-chip ${isActive ? "is-active" : ""} ${isEnabled ? "is-enabled" : "is-disabled"}" data-branch-chip="${escapeHtml(rule.id)}" title="${escapeHtml(rule.name)}">
                <span class="chip-status-dot ${isEnabled ? "is-active" : ""}"></span>
                <strong class="chip-name">${escapeHtml(rule.name)}</strong>
                <small class="chip-summary">${escapeHtml(summary)}</small>
              </button>
            `;
          }).join("")}
        </div>
        <select data-branch-select hidden>
          ${branches.map((rule) => `<option value="${escapeHtml(rule.id)}" ${rule.id === editable.id ? "selected" : ""}>${escapeHtml(rule.name)}</option>`).join("")}
        </select>
      </section>
    `;
  }

  function ruleBranchSummary(rule, type) {
    if (type === "trend") return rule.coreIdea?.slice(0, 16) || "潮流表达";
    if (type === "outfit") return rule.result?.silhouette || "款式组合";
    const actions = rule.actions || [];
    if (!actions.length) return "默认处理";
    return actions.slice(0, 2).map((a) => `${resultDefinition(a.field)?.name || a.field}: ${a.value}`).join(" · ");
  }

  function renderEditorBase(relation) {
    return `<section class="editor-section editor-section--base">
      <div class="editor-section-title">
        <div class="branch-title-wrap">
          <span class="rule-kind-chip is-${relation.kind}">${relation.kind === "hard" ? "硬性边界" : "搭配偏好"}</span>
          <h3>${escapeHtml(relation.rule.name)}</h3>
        </div>
        <label class="switch-control"><input type="checkbox" data-edit="enabled" ${relation.rule.enabled === false ? "" : "checked"}><span></span>启用分支</label>
      </div>
      <div class="form-grid">
        ${field("分支显示名称", "name", relation.rule.name)}
      </div>
      <details class="advanced-details"><summary>高级系统编号</summary>${field("规则 ID", "id", relation.rule.id)}</details>
    </section>`;
  }

  function renderMappingEditor(relation, business) {
    const rule = relation.rule;
    const conditionOptions = state.ruleSet.conditionFields.map((item) => [item.id, item.name]);
    const stepTwo = relation.type === "trend" ? renderTrendResults(rule) : relation.type === "outfit" ? renderOutfitResults(rule) : renderDecisionActions(rule);

    return `
      ${renderEditorBase(relation)}
      <article class="natural-rule-card">
        <section class="rule-clause rule-clause--when">
          <div class="clause-heading">
            <span class="clause-prefix">WHEN</span>
            <strong>当满足以下输入条件时</strong>
            <div class="condition-mode-inline">
              ${selectField("条件关系", "conditionMode", rule.conditionMode || "all", [["all", "全部满足 (AND)"], ["any", "任一满足 (OR)"]])}
              <button type="button" class="text-button" data-add-condition>＋ 添加条件</button>
            </div>
          </div>
          <div class="condition-list">
            ${(rule.conditions || []).map((condition, index) => renderConditionRow(condition, index, conditionOptions)).join("") || `<p class="muted-copy">没有条件限制时，该规则默认始终适用。</p>`}
          </div>
        </section>

        <section class="rule-clause rule-clause--then">
          <div class="clause-heading">
            <span class="clause-prefix">THEN</span>
            <strong>执行穿搭结果处理 · 会改变哪些穿搭内容</strong>
          </div>
          ${stepTwo}
        </section>

        <section class="rule-clause rule-clause--why">
          <div class="clause-heading">
            <span class="clause-prefix">WHY</span>
            <strong>规则制定理由与业务依据</strong>
          </div>
          ${textareaField("补充说明与设计原理", "reason", rule.reason || "")}
        </section>
      </article>
      ${renderSharedInfluence(business)}
    `;
  }

  function renderCalculationDetails(business, open = false) {
    if (!business.derivations.length) return "";
    const operationOptions = [["weightedAverage", "综合多个事实 (加权平均)"], ["range", "比较最大差异 (极差)"], ["passthrough", "直接采用确认结果"], ["bodyShape", "归纳身材轮廓"]];
    return `<details class="calculation-details" ${open ? "open" : ""}>
      <summary>特征归纳与计算方式 <span>${business.derivations.length} 项</span></summary>
      <div class="calculation-list">${business.derivations.map((relation) => {
        const rule = relation.rule;
        return `<section class="calculation-item">
          <div><strong>${escapeHtml(derivedOutputName(rule.output))}</strong><small>${rule.inputs.map((input) => escapeHtml(parameterName(input.field))).join(" ＋ ")}</small></div>
          <label class="editor-field"><span>归纳方式</span><select data-derived-id="${escapeHtml(rule.id)}" data-derived-edit="operation">${operationOptions.map(([value, label]) => `<option value="${value}" ${rule.operation === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
          <label class="editor-field editor-field--wide"><span>计算原理说明</span><textarea rows="2" data-derived-id="${escapeHtml(rule.id)}" data-derived-edit="reason">${escapeHtml(rule.reason || "")}</textarea></label>
        </section>`;
      }).join("")}</div>
    </details>`;
  }

  function renderSharedInfluence(business) {
    const related = businessRelations().filter((item) => item.id !== business.id && item.domains.some((domain) => business.domains.includes(domain))).slice(0, 5);
    if (!related.length) return "";
    return `<section class="related-rules"><div class="editor-section-title"><h3>协同影响规则</h3></div><div class="related-chips">${related.map((item) => `<button type="button" class="related-chip" data-open-related="${escapeHtml(item.id)}"><span>${escapeHtml(item.name)}</span><small>${escapeHtml(item.domains.filter((domain) => business.domains.includes(domain)).join("、"))}</small></button>`).join("")}</div></section>`;
  }

  function renderConditionRow(condition, index, definitions) {
    const definition = conditionDefinition(condition.field);
    return `<div class="condition-row">
      <span class="clause-sub-tag">IF</span>
      ${groupedSelect("输入或分析项", `conditions.${index}.field`, condition.field, state.ruleSet.conditionFields)}
      ${selectField("判断逻辑", `conditions.${index}.operator`, condition.operator, [["eq", "等于 (eq)"], ["neq", "不等于 (neq)"], ["gt", "高于 (gt)"], ["gte", "不低于 (gte)"], ["lt", "低于 (lt)"], ["lte", "不高于 (lte)"]])}
      ${typedValueField("设定值", `conditions.${index}.value`, condition.value, definition)}
      <button class="icon-button is-danger" type="button" data-remove-condition="${index}" title="删除条件" aria-label="删除条件">×</button>
    </div>`;
  }

  function renderDecisionActions(rule) {
    return `
      <div class="action-heading">
        <strong>结果动作列表</strong>
        <button type="button" class="text-button" data-add-action>＋ 添加动作处理</button>
      </div>
      <div class="action-list">
        ${(rule.actions || []).map((action, index) => {
          const definition = resultDefinition(action.field);
          return `<div class="action-row">
            <span class="clause-sub-tag is-then">SET</span>
            ${selectField("作用方式", `actions.${index}.type`, action.type, [["SET", "强制设定为 (SET)"], ["REQUIRE", "必须满足 (REQUIRE)"], ["FORBID", "排除该值 (FORBID)"], ["FILTER", "过滤该项 (FILTER)"], ["BOOST", "提升优先级 (BOOST)"], ["ADD", "增加候选 (ADD)"]])}
            ${groupedSelect("影响内容", `actions.${index}.field`, action.field, state.ruleSet.resultFields)}
            ${typedValueField("设定具体值", `actions.${index}.value`, action.value, definition)}
            <button class="icon-button is-danger" type="button" data-remove-action="${index}" title="删除处理" aria-label="删除处理">×</button>
          </div>`;
        }).join("") || `<p class="muted-copy">暂无动作，点击上方添加处理动作。</p>`}
      </div>
    `;
  }

  function renderOutfitResults(rule) {
    const result = rule.result || {};
    return `
      <div class="outfit-result-grid">
        ${selectField("服装路线", "result.family", result.family || "straight", familyOptions)}
        ${field("服装轮廓", "result.silhouette", result.silhouette || "")}
        ${field("款式细节", "result.detail", result.detail || "")}
        ${field("图案纹理", "result.pattern", result.pattern || "")}
        ${result.formality !== undefined ? selectField("正式程度", "result.formality", result.formality, [[1, "随性"], [2, "整洁"], [3, "偏正式"], [4, "正式"]]) : ""}
        ${result.finish !== undefined ? field("材质表面", "result.finish", result.finish || "") : ""}
        ${result.trend !== undefined ? selectField("潮流表达", "result.trend", result.trend, [["classic", "经典稳妥"], ["current", "适度当下"], ["statement", "明显潮流"]]) : ""}
        ${result.proportion !== undefined ? field("版型比例", "result.proportion", result.proportion || "") : ""}
        ${result.detailIntensity !== undefined ? field("细节强度", "result.detailIntensity", result.detailIntensity || "") : ""}
        ${result.note !== undefined ? field("穿着表达", "result.note", result.note || "") : ""}
        ${result.seasonVersion !== undefined ? field("款式时效", "result.seasonVersion", result.seasonVersion || "") : ""}
      </div>
      <div class="family-choice">
        <span>可生成的候选路线</span>
        <div class="family-choice-boxes">
          ${familyOptions.map(([value, label]) => `<label class="family-check"><input type="checkbox" data-family-option="${value}" ${(result.families || []).includes(value) ? "checked" : ""}><span>${label}</span></label>`).join("")}
        </div>
      </div>
    `;
  }

  function renderTrendResults(rule) {
    const result = rule.result || {};
    return `
      <div class="trend-rule-meta">
        ${field("理念来源", "reference", rule.reference || "")}
        ${field("适用时间", "season", rule.season || "")}
        ${textareaField("核心理念阐述", "coreIdea", rule.coreIdea || "")}
      </div>
      <div class="outfit-result-grid">
        ${field("服装廓形", "result.silhouette", result.silhouette || "")}
        ${field("版型比例", "result.proportion", result.proportion || "")}
        ${field("款式细节", "result.detail", result.detail || "")}
        ${field("图案纹理", "result.pattern", result.pattern || "")}
        ${field("材质表面", "result.finish", result.finish || "")}
        ${field("细节重点", "result.detailIntensity", result.detailIntensity || "")}
      </div>
      <div class="family-choice">
        <span>会优先使用的服装路线</span>
        <div class="family-choice-boxes">
          ${familyOptions.map(([value, label]) => `<label class="family-check"><input type="checkbox" data-family-option="${value}" ${(result.families || []).includes(value) ? "checked" : ""}><span>${label}</span></label>`).join("")}
        </div>
      </div>
    `;
  }

  function handleEditorChange(event) {
    const business = businessRelationById(state.selectedId);
    const member = event.target.closest("select[data-member-select]");
    if (member && business) {
      state.memberSelection[business.id] = member.value;
      renderEditor();
      return;
    }

    const derivedControl = event.target.closest("[data-derived-id][data-derived-edit]");
    if (derivedControl) {
      const derivedRule = state.ruleSet.derivedRules.find((rule) => rule.id === derivedControl.dataset.derivedId);
      if (!derivedRule) return;
      const path = derivedControl.dataset.derivedEdit;
      const previous = Engine.getByPath(derivedRule, path);
      Engine.setByPath(derivedRule, path, parseByPrevious(derivedControl.value, previous));
      markDirty();
      renderAll();
      return;
    }

    const relation = activeAtomicRelation(business);
    const branch = event.target.closest("select[data-branch-select]");
    if (branch && relation?.rules?.length) {
      state.branchSelection[relation.id] = branch.value;
      renderEditor();
      return;
    }

    const control = event.target.closest("[data-edit]");
    if (!control || !relation || control.disabled || control.dataset.edit === "__derivedOutput") return;
    const editable = activeRule(relation);
    const path = control.dataset.edit;
    const previous = Engine.getByPath(editable, path);
    const value = control.type === "checkbox" ? control.checked : parseByPrevious(control.value, previous);
    Engine.setByPath(editable, path, value);
    if (/^conditions\.\d+\.field$/.test(path)) resetConditionValue(editable, path, value);
    if (/^actions\.\d+\.field$/.test(path)) resetActionValue(editable, path, value);
    if (path === "id" && relation.rules?.length) state.branchSelection[relation.id] = String(value);
    else if (path === "id") state.selectedId = String(value);
    if (relation.type === "trend") refreshTrendReferences();
    markDirty();
    renderAll();
  }

  function handleEditorClick(event) {
    const business = businessRelationById(state.selectedId);
    const relation = activeAtomicRelation(business);
    if (!relation || !business) return;
    const editable = activeRule(relation);

    const branchChip = event.target.closest("button[data-branch-chip]");
    if (branchChip && relation.rules?.length) {
      state.branchSelection[relation.id] = branchChip.dataset.branchChip;
      renderEditor();
      return;
    }

    if (event.target.closest("#addBranchBtn")) {
      duplicateRule();
      return;
    }

    const related = event.target.closest("button[data-open-related]");
    if (related) {
      state.selectedId = related.dataset.openRelated;
      renderRelationPicker();
      renderEditor();
      return;
    }

    const family = event.target.closest("input[data-family-option]");
    if (family && ["outfit", "trend"].includes(relation.type)) {
      editable.result.families ||= [];
      editable.result.families = family.checked
        ? [...new Set([...editable.result.families, family.dataset.familyOption])]
        : editable.result.families.filter((item) => item !== family.dataset.familyOption);
      markDirty();
      renderEditor();
      return;
    }

    if (event.target.closest("[data-add-condition]")) {
      editable.conditions ||= [];
      editable.conditions.push({ field: "input.context.temperatureRange", operator: "eq", value: "18_24" });
      markDirty();
      renderEditor();
      return;
    }

    const removeCondition = event.target.closest("[data-remove-condition]");
    if (removeCondition) {
      editable.conditions.splice(Number(removeCondition.dataset.removeCondition), 1);
      markDirty();
      renderEditor();
      return;
    }

    if (event.target.closest("[data-add-action]") && relation.type === "decision") {
      editable.actions ||= [];
      editable.actions.push({ type: "SET", field: "requirements.material", value: "轻薄" });
      markDirty();
      renderEditor();
      return;
    }

    const removeAction = event.target.closest("[data-remove-action]");
    if (removeAction && relation.type === "decision") {
      editable.actions.splice(Number(removeAction.dataset.removeAction), 1);
      markDirty();
      renderEditor();
    }
  }

  function resetConditionValue(rule, path, fieldId) {
    const index = Number(path.split(".")[1]);
    const definition = conditionDefinition(fieldId);
    if (definition?.options?.length) rule.conditions[index].value = definition.options[0][0];
  }

  function resetActionValue(rule, path, fieldId) {
    const index = Number(path.split(".")[1]);
    const definition = resultDefinition(fieldId);
    if (definition?.options?.length) rule.actions[index].value = definition.options[0][0];
    else rule.actions[index].value = definition?.valueType === "boolean" ? true : definition?.valueType === "number" ? 1 : "";
  }

  function duplicateRule() {
    const business = businessRelationById(state.selectedId);
    const relation = activeAtomicRelation(business);
    if (!relation) return;
    const editable = activeRule(relation);
    const copy = Engine.clone(editable);
    copy.id = `${editable.id}-COPY-${Date.now().toString().slice(-4)}`;
    copy.name = `${editable.name} 副本`;
    if (relation.type === "trend") {
      copy.value = `${editable.value || "trend"}Copy${Date.now().toString().slice(-4)}`;
      copy.conditions = [{ field: "input.preference.trendDirection", operator: "eq", value: copy.value }];
    }
    collectionFor(relation.type).push(copy);
    if (relation.type === "trend") refreshTrendReferences();
    if (relation.rules?.length) state.branchSelection[relation.id] = copy.id;
    markDirty();
    renderAll();
    toast(`已创建分支副本: ${copy.name}`);
  }

  async function deleteRule() {
    const business = businessRelationById(state.selectedId);
    const relation = activeAtomicRelation(business);
    const editable = activeRule(relation);
    if (!relation || !editable || !await confirmAction("删除规则分支", `确定删除分支“${editable.name}”吗？`)) return;
    const collection = collectionFor(relation.type);
    collection.splice(collection.findIndex((item) => item.id === editable.id), 1);
    if (relation.type === "trend") refreshTrendReferences();
    if (relation.rules?.length > 2) delete state.branchSelection[relation.id];
    else state.selectedId = businessRelations()[0]?.id || null;
    markDirty();
    renderAll();
    toast("分支已删除");
  }

  function collectionFor(type) {
    return type === "analysis" ? state.ruleSet.derivedRules : type === "outfit" ? state.ruleSet.outfitOutputs : type === "trend" ? state.ruleSet.trendDirections : state.ruleSet.decisionRules;
  }

  function saveDraft() {
    state.ruleSet = Engine.Store.saveDraft(state.ruleSet);
    state.dirty = false;
    renderMeta();
    toast("草稿已保存");
  }

  async function publishRules() {
    const validation = Engine.validateRuleSet(state.ruleSet);
    const tests = Engine.runTests(state.ruleSet);
    const hasError = !validation.valid || tests.some((t) => !t.pass);

    if (hasError) {
      showValidationDiagnostics(validation, tests);
      return;
    }

    if (!await confirmAction("发布规则确认", "发布后，案例运行页与模拟器将立即同步使用这组规则关系。")) return;
    const result = Engine.Store.publish(state.ruleSet);
    state.ruleSet = result.ruleSet;
    state.dirty = false;
    renderAll();
    toast(`规则 ${state.ruleSet.meta.version} 已成功发布`);
  }

  function showValidationDiagnostics(validation, tests) {
    const valDialog = $("#validationDialog");
    const valContent = $("#validationContent");
    if (!valDialog || !valContent) {
      toast("规则校验未通过，请检查配置");
      return;
    }

    const failedTests = tests.filter((t) => !t.pass);
    const errors = validation.errors || [];

    valContent.innerHTML = `
      <div class="diagnostic-summary">
        <strong>发现 ${errors.length + failedTests.length} 处阻断发布的校验问题</strong>
        <p>必须修复以下问题后才能发布至案例运行环境：</p>
      </div>
      <div class="diagnostic-list">
        ${errors.map((err) => `
          <div class="diagnostic-card is-error">
            <div class="diagnostic-head">
              <span class="diagnostic-badge">语法结构错误</span>
              <strong>${escapeHtml(err.field || "规则配置")}</strong>
            </div>
            <p>${escapeHtml(err.message)}</p>
            ${err.ruleId ? `<button type="button" class="text-button" data-jump-relation="${escapeHtml(err.relationId || 'temperature')}" data-jump-branch="${escapeHtml(err.ruleId)}">立即前往修复 →</button>` : ""}
          </div>
        `).join("")}
        ${failedTests.map((t) => `
          <div class="diagnostic-card is-test-failure">
            <div class="diagnostic-head">
              <span class="diagnostic-badge is-test">场景回归测试未通过</span>
              <strong>${escapeHtml(t.name)}</strong>
            </div>
            <p>${escapeHtml(t.reason || "用例预期未能满足")}</p>
          </div>
        `).join("")}
      </div>
    `;
    valDialog.showModal();
  }

  async function resetRules() {
    if (!await confirmAction("恢复默认规则", "当前草稿和本地发布版将恢复为默认出厂设置，此操作不可撤销。")) return;
    state.ruleSet = Engine.Store.reset();
    state.selectedId = businessRelations()[0]?.id || null;
    state.dirty = false;
    renderAll();
    toast("已恢复默认规则");
  }

  function markDirty() {
    state.dirty = true;
    $("#saveState").textContent = "有未保存修改";
    $("#saveState").classList.add("is-dirty");
  }

  function renderMeta() {
    $("#saveState").textContent = state.dirty ? "有未保存修改" : "草稿已保存";
    $("#saveState").classList.toggle("is-dirty", state.dirty);
    const errors = state.validation?.errors?.length || 0;
    $("#ruleSetVersion").textContent = `${state.ruleSet.meta.status === "published" ? "发布版" : "草稿"} ${state.ruleSet.meta.version} · ${errors ? `${errors} 项待处理` : "结构完整"}`;
  }

  function openResources() {
    renderResources();
    $("#resourceDialog").showModal();
  }

  function renderResources() {
    $("#resourceTabs").innerHTML = resourceTabs.map((tab) => `<button type="button" data-resource-tab="${tab.id}" class="${state.resourceTab === tab.id ? "is-active" : ""}">${tab.label}</button>`).join("");
    if (state.resourceTab === "inputs") $("#resourceContent").innerHTML = renderInputResources();
    if (state.resourceTab === "garments") $("#resourceContent").innerHTML = renderGarmentResources();
    if (state.resourceTab === "palettes") $("#resourceContent").innerHTML = renderPaletteResources();
    if (state.resourceTab === "trends") $("#resourceContent").innerHTML = renderTrendResources();
  }

  function renderInputResources() {
    return `<div class="resource-table-wrap"><table class="resource-table"><thead><tr><th>输入名称</th><th>分组</th><th>选择方式</th><th>可选内容</th><th>启用</th></tr></thead><tbody>${state.ruleSet.parameters.map((item, index) => `<tr>
      <td>${resourceField("parameters", index, "name", item.name)}</td><td>${resourceField("parameters", index, "group", item.group)}</td>
      <td>${resourceSelect("parameters", index, "type", item.type, [["select", "单选"], ["scale", "分段选择"], ["boolean", "勾选"]])}</td>
      <td title="${escapeHtml((item.options || []).map((option) => option.label).join("、"))}">${item.type === "boolean" ? "是 / 否" : `${item.options?.length || 0} 项`}</td>
      <td>${resourceCheck("parameters", index, "enabled", item.enabled !== false)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function renderGarmentResources() {
    const filter = state.resourceGarmentFilter || "all";
    const search = (state.resourceGarmentSearch || "").trim().toLowerCase();

    const filtered = state.ruleSet.components.map((item, index) => ({ item, index })).filter(({ item }) => {
      if (filter !== "all" && item.category !== filter) return false;
      if (search && !item.name.toLowerCase().includes(search)) return false;
      return true;
    });

    return `
      <div class="garment-resource-toolbar">
        <div class="garment-filter-chips">
          <button type="button" class="chip ${filter === "all" ? "is-active" : ""}" data-garment-filter="all">全部 (${state.ruleSet.components.length})</button>
          <button type="button" class="chip ${filter === "top" ? "is-active" : ""}" data-garment-filter="top">上装</button>
          <button type="button" class="chip ${filter === "outer" ? "is-active" : ""}" data-garment-filter="outer">外层</button>
          <button type="button" class="chip ${filter === "bottom" ? "is-active" : ""}" data-garment-filter="bottom">下装</button>
        </div>
        <input type="search" class="search-input" placeholder="搜索服装名称..." value="${escapeHtml(state.resourceGarmentSearch || "")}" data-garment-search />
      </div>
      <div class="resource-table-wrap">
        <table class="resource-table">
          <thead>
            <tr><th>服装名称</th><th>部位</th><th>款式路线</th><th>正式程度</th><th>启用</th></tr>
          </thead>
          <tbody>
            ${filtered.map(({ item, index }) => `<tr>
              <td>${resourceField("components", index, "name", item.name)}</td>
              <td>${resourceSelect("components", index, "category", item.category, [["top", "上装"], ["outer", "外层"], ["bottom", "下装"]])}</td>
              <td>${resourceSelect("components", index, "attributes.family", item.attributes?.family, familyOptions)}</td>
              <td>${resourceSelect("components", index, "attributes.formality", item.attributes?.formality, [[1, "随性"], [2, "整洁"], [3, "偏正式"], [4, "正式"]])}</td>
              <td>${resourceCheck("components", index, "enabled", item.enabled !== false)}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderPaletteResources() {
    const colors = state.ruleSet.colorLibrary.filter((item) => item.enabled !== false).map((item) => [item.id, item.name]);
    return `<div class="palette-resource-list">${state.ruleSet.palettePlans.map((palette, index) => `<section class="palette-resource-card">
      <div class="palette-resource-head">${resourceField("palettePlans", index, "name", palette.name)}${resourceCheck("palettePlans", index, "enabled", palette.enabled !== false)}</div>
      <div class="palette-resource-meta">${resourceSelect("palettePlans", index, "temperature", palette.temperature, [["冷", "冷"], ["中间偏冷", "中间偏冷"], ["中间", "中间"], ["中间偏暖", "中间偏暖"], ["暖", "暖"]])}${resourceSelect("palettePlans", index, "contrast", palette.contrast, [["低", "低对比"], ["中等", "中等对比"], ["高", "高对比"]])}${resourceSelect("palettePlans", index, "chroma", palette.chroma, [["低", "低彩度"], ["中等", "中等彩度"], ["高", "高彩度"]])}</div>
      <div class="palette-resource-preview">${palette.roles.map((role) => { const color = state.ruleSet.colorLibrary.find((item) => item.id === role.colorId); return `<span style="background:${escapeHtml(color?.hex || "#ddd")};flex-grow:${Number(role.ratio || 1)}"></span>`; }).join("")}</div>
      <div class="palette-role-resource">${palette.roles.map((role, roleIndex) => `<div>${resourceSelect("palettePlans", index, `roles.${roleIndex}.colorId`, role.colorId, colors)}${resourceField("palettePlans", index, `roles.${roleIndex}.ratio`, role.ratio, "number")}</div>`).join("")}</div>
    </section>`).join("")}</div>`;
  }

  function renderTrendResources() {
    return `<div class="resource-list-heading"><strong>${state.ruleSet.trendDirections.length} 个潮流方向</strong><button type="button" class="secondary-button" data-add-trend>＋ 新增方向</button></div>
      <div class="trend-resource-list">${state.ruleSet.trendDirections.map((trend, index) => `<section class="trend-resource-card">
        <div class="trend-resource-head">${resourceField("trendDirections", index, "name", trend.name)}${resourceCheck("trendDirections", index, "enabled", trend.enabled !== false)}<button type="button" class="icon-button is-danger" data-remove-trend="${index}" title="删除潮流方向" aria-label="删除潮流方向">×</button></div>
        <div class="trend-resource-meta">${resourceField("trendDirections", index, "reference", trend.reference || "")}${resourceField("trendDirections", index, "season", trend.season || "")}</div>
        <label class="resource-textarea"><span>核心理念阐述</span><textarea rows="2" data-resource-collection="trendDirections" data-resource-index="${index}" data-resource-path="coreIdea">${escapeHtml(trend.coreIdea || "")}</textarea></label>
        <div class="trend-resource-tags"><span>影响穿搭维度</span>${(trend.influences || []).map((item) => `<b>${escapeHtml(item)}</b>`).join("")}</div>
      </section>`).join("")}</div>`;
  }

  function handleResourceChange(event) {
    const garmentFilter = event.target.closest("[data-garment-filter]");
    if (garmentFilter) {
      state.resourceGarmentFilter = garmentFilter.dataset.garmentFilter;
      renderResources();
      return;
    }

    const garmentSearch = event.target.closest("[data-garment-search]");
    if (garmentSearch) {
      state.resourceGarmentSearch = garmentSearch.value;
      renderResources();
      return;
    }

    const control = event.target.closest("[data-resource-collection]");
    if (!control) return;
    const collection = state.ruleSet[control.dataset.resourceCollection];
    const object = collection?.[Number(control.dataset.resourceIndex)];
    if (!object) return;
    const path = control.dataset.resourcePath;
    const previous = Engine.getByPath(object, path);
    const value = control.type === "checkbox" ? control.checked : parseByPrevious(control.value, previous);
    Engine.setByPath(object, path, value);
    if (control.dataset.resourceCollection === "parameters") refreshConditionFields();
    if (control.dataset.resourceCollection === "trendDirections") refreshTrendReferences();
    markDirty();
    renderResources();
    renderAll();
  }

  function handleResourceClick(event) {
    const garmentFilter = event.target.closest("[data-garment-filter]");
    if (garmentFilter) {
      state.resourceGarmentFilter = garmentFilter.dataset.garmentFilter;
      renderResources();
      return;
    }

    if (event.target.closest("[data-add-trend]")) {
      const suffix = Date.now().toString().slice(-5);
      const value = `customTrend${suffix}`;
      state.ruleSet.trendDirections.push({
        id: `TREND-CUSTOM-${suffix}`,
        value,
        name: "新潮流方向",
        enabled: true,
        reference: "现代设计理念",
        season: "长期方向",
        coreIdea: "说明这一潮流方向通过哪些服装路线、廓形和细节形成。",
        influences: ["服装路线", "廓形比例", "款式细节"],
        conditions: [{ field: "input.preference.trendDirection", operator: "eq", value }],
        result: { families: ["straight", "relaxed"], silhouette: "松量适度", detail: "结构细节", pattern: "纯色", finish: "质感平整", proportion: "常规比例", detailIntensity: "细节适中", note: "适度融入潮流", seasonVersion: "持续更新" },
        reason: "新增潮流方向，具体服装映射需继续配置。"
      });
      refreshTrendReferences();
      markDirty();
      renderResources();
      renderAll();
      return;
    }
    const remove = event.target.closest("[data-remove-trend]");
    if (!remove) return;
    state.ruleSet.trendDirections.splice(Number(remove.dataset.removeTrend), 1);
    refreshTrendReferences();
    markDirty();
    renderResources();
    renderAll();
  }

  function refreshTrendReferences() {
    const options = [["none", "不限定"], ...state.ruleSet.trendDirections.filter((item) => item.enabled !== false).map((item) => [item.value, item.name])];
    const parameter = state.ruleSet.parameters.find((item) => item.id === "preference.trendDirection");
    if (parameter) parameter.options = options.map(([value, label]) => ({ value, label }));
    const field = state.ruleSet.conditionFields.find((item) => item.id === "input.preference.trendDirection");
    if (field) field.options = options;
  }

  function refreshConditionFields() {
    state.ruleSet.conditionFields = [
      ...state.ruleSet.parameters.map((parameter) => ({
        id: `input.${parameter.id}`, name: parameter.name, group: parameter.group,
        valueType: parameter.type === "boolean" ? "boolean" : "select",
        options: parameter.type === "boolean" ? [[true, "是"], [false, "否"]] : (parameter.options || []).map((option) => [option.value, option.label])
      })),
      ...state.ruleSet.conditionFields.filter((item) => item.id.startsWith("derived."))
    ];
  }

  function resourceField(collection, index, path, value, type = "text") {
    return `<input type="${type}" data-resource-collection="${collection}" data-resource-index="${index}" data-resource-path="${path}" value="${escapeHtml(value)}">`;
  }

  function resourceSelect(collection, index, path, value, options) {
    return `<select data-resource-collection="${collection}" data-resource-index="${index}" data-resource-path="${path}">${options.map(([option, label]) => `<option value="${escapeHtml(option)}" ${String(option) === String(value) ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select>`;
  }

  function resourceCheck(collection, index, path, value) {
    return `<label class="table-switch"><input type="checkbox" data-resource-collection="${collection}" data-resource-index="${index}" data-resource-path="${path}" ${value ? "checked" : ""}><span></span></label>`;
  }

  function conditionDefinition(id) { return state.ruleSet.conditionFields.find((item) => item.id === id); }
  function resultDefinition(id) { return state.ruleSet.resultFields.find((item) => item.id === id); }
  function parameterName(id) { return state.ruleSet.parameters.find((item) => item.id === id)?.name || id; }
  function derivedOutputName(output) { return conditionDefinition(`derived.${output}.label`)?.name || state.ruleSet.derivedRules.find((item) => item.output === output)?.name || "分析结果"; }

  function field(label, path, value, type = "text", disabled = false) {
    return `<label class="editor-field"><span>${label}</span><input type="${type}" data-edit="${path}" value="${escapeHtml(value)}" ${disabled ? "disabled" : ""}></label>`;
  }

  function textareaField(label, path, value) {
    return `<label class="editor-field editor-field--wide"><span>${label}</span><textarea data-edit="${path}" rows="3">${escapeHtml(value)}</textarea></label>`;
  }

  function selectField(label, path, value, options) {
    return `<label class="editor-field"><span>${label}</span><select data-edit="${path}">${options.map(([option, name]) => `<option value="${escapeHtml(option)}" ${String(option) === String(value) ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}</select></label>`;
  }

  function groupedSelect(label, path, value, definitions) {
    const groups = [...new Set(definitions.map((item) => item.group || "其他"))];
    return `<label class="editor-field"><span>${label}</span><select data-edit="${path}">${groups.map((group) => `<optgroup label="${escapeHtml(group)}">${definitions.filter((item) => (item.group || "其他") === group).map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === value ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</optgroup>`).join("")}</select></label>`;
  }

  function typedValueField(label, path, value, definition) {
    if (definition?.options?.length) return selectField(label, path, value, definition.options);
    return field(label, path, serializeValue(value), definition?.valueType === "number" ? "number" : "text");
  }

  function parseByPrevious(rawValue, previous) {
    if (typeof previous === "number") return Number(rawValue);
    if (typeof previous === "boolean") return rawValue === true || rawValue === "true";
    return parseValue(rawValue);
  }

  function serializeValue(value) { return typeof value === "string" ? value : JSON.stringify(value); }
  function parseValue(value) {
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === "null") return null;
    if (/^-?\d+(\.\d+)?$/.test(String(value))) return Number(value);
    return value;
  }

  function confirmAction(title, message) {
    const dialog = $("#confirmDialog");
    $("#confirmTitle").textContent = title;
    $("#confirmMessage").textContent = message;
    dialog.showModal();
    return new Promise((resolve) => {
      const finish = (value) => { dialog.close(); resolve(value); };
      $("[data-confirm-ok]").onclick = () => finish(true);
      $("[data-confirm-cancel]").onclick = () => finish(false);
      dialog.oncancel = () => finish(false);
    });
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function toast(message) {
    const element = $("#toast");
    element.textContent = message;
    element.classList.add("is-visible");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => element.classList.remove("is-visible"), 2600);
  }
})();
