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
        { id: "temperature", name: "冷暖属性" },
        { id: "contrast", name: "明度对比" },
        { id: "chroma", name: "彩度水平" },
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
    { id: "temperature", name: "温度与层次", topics: ["温度与层次"], inputs: ["近期气温"], outputs: ["层数", "袖长", "外层", "覆盖程度", "材质厚薄"], overview: { wear: { layerCount: "strong", sleeve: "strong", outer: "strong", coverage: "strong", material: "strong" } }, hard: true },
    { id: "occasion", name: "使用场合", topics: ["场合要求"], inputs: ["使用场合"], outputs: ["正式完成度", "行动便利"], overview: { wear: { formality: "strong", movement: "medium" } } },
    { id: "color", name: "外观色彩", topics: ["整体色彩"], inputs: ["肤色色调、明度、彩度", "发色色调、明度、彩度", "瞳色色调、明度、彩度"], outputs: ["服装冷暖属性", "配色明度对比", "配色彩度", "配色方案", "近脸色", "主色", "辅助色", "点缀色"], overview: { color: { temperature: "strong", contrast: "strong", chroma: "medium", palette: "strong", placement: "medium" } } },
    { id: "body", name: "体型比例", topics: ["身材与比例"], inputs: ["纵向高度", "腿身分布", "腰线特征", "横向轮廓"], outputs: ["外轮廓", "上下长度", "腰位", "线条方向", "服装量感"], overview: { style: { silhouette: "medium", length: "strong", waist: "strong", volume: "medium", details: "light" } } },
    { id: "face", name: "脸型特征", topics: ["脸型与领口"], inputs: ["脸型"], outputs: ["领口方向"], overview: { style: { neckline: "strong" } } },
    { id: "style", name: "风格方向", topics: ["风格方向"], inputs: ["风格方向"], outputs: ["外轮廓", "服装量感", "款式细节", "表面纹理"], overview: { style: { silhouette: "strong", volume: "strong", details: "strong" } } },
    { id: "formality", name: "正式程度", topics: ["正式程度"], inputs: ["正式程度"], outputs: ["结构完成度", "材质表面"], overview: { wear: { formality: "strong" }, style: { silhouette: "medium", details: "medium" } } },
    { id: "trend", name: "潮流方向", topics: ["潮流方向"], inputs: ["潮流方向", "表达强度"], outputs: ["外轮廓", "服装量感", "表面纹理", "款式细节"], overview: { style: { silhouette: "medium", volume: "medium", details: "strong" } } },
    { id: "goal", name: "调整目标", topics: ["本次偏好"], inputs: ["调整目标", "调整方向"], outputs: ["腰位", "线条方向", "配色对比"], overview: { style: { length: "medium", waist: "strong" }, color: { contrast: "medium" } } },
    { id: "boundaries", name: "拒绝边界", topics: ["拒绝与边界"], inputs: ["明确拒绝", "身体边界"], outputs: ["覆盖程度", "行动便利", "贴肤触感", "排除样式", "排除配色"], overview: { wear: { coverage: "strong", movement: "strong", material: "strong" }, style: { details: "strong" }, color: { contrast: "strong", palette: "strong" } }, hard: true }
  ];

  // Each business relation owns a bounded set of fields. The editor uses this
  // contract to keep a selected relation focused on its actual responsibility.
  const relationScopes = {
    temperature: {
      condition: ["input.context.temperatureRange"],
      result: ["requirements.layerCount", "requirements.sleeve", "requirements.outer", "requirements.coverage", "requirements.material"]
    },
    occasion: {
      condition: ["input.context.occasion"],
      result: ["requirements.formalityMin", "requirements.movement", "requirements.material"]
    },
    color: {
      condition: ["input.appearance.skinTemperature", "input.appearance.skinValue", "input.appearance.skinChroma", "input.appearance.hairTemperature", "input.appearance.hairValue", "input.appearance.hairChroma", "input.appearance.eyeTemperature", "input.appearance.eyeValue", "input.appearance.eyeChroma", "derived.color.temperature.label", "derived.color.contrast.label", "derived.color.chroma.label"],
      result: ["requirements.colorTemperature", "requirements.colorContrast", "requirements.colorContrastMax", "requirements.colorChroma", "requirements.palettePlanId"]
    },
    body: {
      condition: ["input.body.heightPresence", "input.body.legRatio", "input.body.waistDefinition", "input.body.shoulderHipBalance", "derived.body.slenderness.label", "derived.body.proportion.label", "derived.body.waistDefinition.label", "derived.body.shoulderHipBalance.label", "derived.body.shape.label"],
      result: ["requirements.waist", "requirements.line", "preferences.family"]
    },
    face: {
      condition: ["input.face.shape"],
      result: ["requirements.neckline", "requirements.faceEffect"]
    },
    style: {
      condition: ["input.preference.style"],
      result: ["preferences.family"]
    },
    formality: {
      condition: ["input.preference.formality"],
      result: ["requirements.formalityMin", "requirements.material"]
    },
    trend: {
      condition: ["input.preference.trendDirection", "input.preference.trendIntensity"],
      result: ["preferences.family"]
    },
    goal: {
      condition: ["input.goal.endpoint", "input.goal.direction", "derived.body.slenderness.label", "derived.body.proportion.label", "derived.color.contrast.label"],
      result: ["requirements.waist", "requirements.line", "requirements.colorContrast", "requirements.colorContrastMax", "preferences.family"]
    },
    boundaries: {
      condition: ["input.boundaries.rejectSkirt", "input.boundaries.rejectDefinedWaist", "input.boundaries.rejectHighContrast", "input.boundaries.strictCoverage", "input.boundaries.movementFriendly", "input.boundaries.sensitiveTexture"],
      result: ["requirements.coverage", "requirements.movement", "requirements.texture", "requirements.waist", "requirements.colorContrastMax", "candidate.bottomType"]
    }
  };

  businessDefinitions.forEach((definition) => {
    definition.scope = relationScopes[definition.id] || { condition: [], result: [] };
  });

  const inputTier1Categories = [
    {
      id: "context",
      name: "场景条件",
      relations: [
        { id: "temperature", name: "近期气温", tag: "边界" },
        { id: "occasion", name: "使用场合", tag: "搭配" }
      ]
    },
    {
      id: "personal",
      name: "个人特征",
      relations: [
        { id: "color", name: "外观色彩", tag: "搭配" },
        { id: "body", name: "体型比例", tag: "搭配" },
        { id: "face", name: "脸型特征", tag: "搭配" }
      ]
    },
    {
      id: "preference",
      name: "风格偏好",
      relations: [
        { id: "style", name: "风格方向", tag: "搭配" },
        { id: "formality", name: "正式程度", tag: "搭配" },
        { id: "trend", name: "潮流方向", tag: "搭配" }
      ]
    },
    {
      id: "goal-boundaries",
      name: "目标边界",
      relations: [
        { id: "goal", name: "调整目标", tag: "搭配" },
        { id: "boundaries", name: "拒绝边界", tag: "边界" }
      ]
    }
  ];

  // Personal-feature navigation is organised by input module. Branch values
  // remain inside the selected module so they can be traced to their outputs.
  const personalModuleDefinitions = {
    color: [
      {
        id: "skin",
        name: "肤色",
        conditionFields: ["input.appearance.skinTemperature", "input.appearance.skinValue", "input.appearance.skinChroma"],
        derivedOutputs: ["color.temperature", "color.contrast", "color.chroma"]
      },
      {
        id: "hair",
        name: "发色",
        conditionFields: ["input.appearance.hairTemperature", "input.appearance.hairValue", "input.appearance.hairChroma"],
        derivedOutputs: ["color.temperature", "color.contrast", "color.chroma"]
      },
      {
        id: "eye",
        name: "瞳色",
        conditionFields: ["input.appearance.eyeTemperature", "input.appearance.eyeValue", "input.appearance.eyeChroma"],
        derivedOutputs: ["color.temperature", "color.contrast", "color.chroma"]
      }
    ],
    body: [
      {
        id: "vertical",
        name: "纵向高度",
        conditionFields: ["input.body.heightPresence"],
        derivedOutputs: ["body.slenderness"]
      },
      {
        id: "legRatio",
        name: "腿身分布",
        conditionFields: ["input.body.legRatio"],
        relationFamily: "BODY-PROPORTION",
        derivedOutputs: ["body.slenderness", "body.proportion"]
      },
      {
        id: "waist",
        name: "腰线特征",
        conditionFields: ["input.body.waistDefinition"],
        derivedOutputs: ["body.waistDefinition", "body.shape"]
      },
      {
        id: "horizontal",
        name: "横向轮廓",
        conditionFields: ["input.body.shoulderHipBalance"],
        derivedOutputs: ["body.shoulderHipBalance", "body.shape"]
      }
    ],
    face: [
      {
        id: "shape",
        name: "脸型",
        conditionFields: ["input.face.shape"],
        relationFamily: "FACE-SHAPE"
      }
    ]
  };

  function getTier1ForRelation(relationId) {
    for (const cat of inputTier1Categories) {
      if (cat.relations.some((r) => r.id === relationId)) return cat.id;
    }
    return "context";
  }

  const overviewImpactSymbols = {
    strong: "●",
    medium: "◐",
    light: "○"
  };

  const resourceTabs = [
    { id: "inputs", label: "输入选项" },
    { id: "garments", label: "服装库" },
    { id: "palettes", label: "颜色搭配" },
    { id: "trends", label: "潮流方向" }
  ];

  const familyOptions = [["straight", "简洁直线"], ["tailored", "利落结构"], ["soft", "柔和收放"], ["relaxed", "自然留量"], ["street", "街头箱型"], ["retro", "复古收放"]];

  const state = {
    ruleSet: Engine.Store.loadDraft(),
    selectedTier1: "context",
    selectedId: "temperature",
    resourceTab: "inputs",
    resourceGarmentFilter: "all",
    resourceGarmentSearch: "",
    memberSelection: {},
    branchSelection: {},
    personalModuleSelection: {},
    personalValueSelections: {},
    mode: "overview",
    dirty: false,
    validation: null
  };

  window.addEventListener("DOMContentLoaded", init, { once: true });

  function init() {
    state.selectedTier1 = getTier1ForRelation(state.selectedId) || "context";
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
      const relId = target.dataset.overviewTarget;
      state.selectedId = relId;
      state.selectedTier1 = getTier1ForRelation(relId);
      state.mode = "configure";
      renderAll();
    });

    const tier1Nav = $("#configTier1Tabs");
    if (tier1Nav) {
      tier1Nav.addEventListener("click", (event) => {
        const btn = event.target.closest("button[data-tier1-id]");
        if (!btn) return;
        state.selectedTier1 = btn.dataset.tier1Id;
        const cat = inputTier1Categories.find((c) => c.id === state.selectedTier1);
        if (cat && cat.relations.length) {
          state.selectedId = cat.relations[0].id;
        }
        renderRelationPicker();
        renderEditor();
      });
    }

    const tier2Nav = $("#configTier2Chips");
    if (tier2Nav) {
      tier2Nav.addEventListener("click", (event) => {
        const chip = event.target.closest("button[data-tier2-id]");
        if (!chip) return;
        state.selectedId = chip.dataset.tier2Id;
        renderRelationPicker();
        renderEditor();
      });
    }

    const tier3Nav = $("#configTier3Chips");
    if (tier3Nav) {
      tier3Nav.addEventListener("click", (event) => {
        const moduleChip = event.target.closest("button[data-personal-module-id]");
        if (moduleChip) {
          state.personalModuleSelection[state.selectedId] = moduleChip.dataset.personalModuleId;
          renderRelationPicker();
          renderEditor();
          return;
        }
        const addBtn = event.target.closest("[data-add-branch-tier3]");
        if (addBtn) {
          duplicateRule();
          return;
        }
        const chip = event.target.closest("button[data-tier3-id]");
        if (!chip) return;
        const business = businessRelationById(state.selectedId);
        const memberId = chip.dataset.tier3MemberId;
        const relation = memberId
          ? business?.mappingMembers.find((item) => item.id === memberId)
          : activeAtomicRelation(business);
        if (relation) {
          if (memberId && business) state.memberSelection[business.id] = memberId;
          state.branchSelection[relation.id] = chip.dataset.tier3Id;
        }
        renderRelationPicker();
        renderEditor();
      });
    }

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
        const relId = jumpBtn.dataset.jumpRelation;
        state.selectedId = relId;
        state.selectedTier1 = getTier1ForRelation(relId);
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
      TEMP: "近期气温",
      OCCASION: "使用场合",
      "COLOR-TEMP": "冷暖属性",
      "COLOR-CONTRAST": "明度对比",
      "COLOR-CHROMA": "彩度水平",
      "FACE-SHAPE": "脸型特征",
      "BODY-PROPORTION": "体型比例",
      "GOAL-VERTICAL": "纵向比例调整",
      "GOAL-WAIST": "腰线特征调整",
      "GOAL-CONTRAST": "配色对比调整",
      BOUNDARY: "拒绝边界",
      "OUTFIT-风格方向": "风格方向",
      "OUTFIT-正式程度": "正式程度",
      "TREND-DIRECTION": "潮流方向"
    };
    return names[key] || (type === "outfit" ? `${branches[0].group}搭配` : branches[0].name);
  }

  function relationMemberName(relation) {
    const id = relation?.id || "";
    const key = relationFamilyKey(relation?.rule || {}, relation?.type);
    const names = {
      TEMP: "近期气温",
      OCCASION: "使用场合",
      "COLOR-TEMP": "冷暖属性",
      "COLOR-CONTRAST": "明度对比",
      "COLOR-CHROMA": "彩度水平",
      "FACE-SHAPE": "脸型特征",
      "BODY-PROPORTION": "体型比例",
      "GOAL-VERTICAL": "纵向比例调整",
      "GOAL-WAIST": "腰线特征调整",
      "GOAL-CONTRAST": "配色对比调整",
      BOUNDARY: "拒绝边界",
      "OUTFIT-风格方向": "风格方向",
      "OUTFIT-正式程度": "正式程度",
      "TREND-DIRECTION": "潮流方向"
    };
    return names[key] || relation?.rule?.name || relation?.name || id;
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

  function personalModulesFor(businessId) {
    return personalModuleDefinitions[businessId] || [];
  }

  function selectedPersonalModule(business) {
    const modules = personalModulesFor(business?.id);
    if (!modules.length) return null;
    const selected = state.personalModuleSelection[business.id];
    const module = modules.find((item) => item.id === selected) || modules[0];
    state.personalModuleSelection[business.id] = module.id;
    return module;
  }

  function personalModuleRelation(business, module) {
    if (!business || !module?.relationFamily) return null;
    const relation = (business.mappingMembers || []).find((item) => (
      relationFamilyKey(item.rule, item.type) === module.relationFamily
      || item.id === `SET-${module.relationFamily}`
      || (item.rules || []).some((branch) => relationFamilyKey(branch, item.type) === module.relationFamily)
    ));
    if (relation) state.memberSelection[business.id] = relation.id;
    return relation || null;
  }

  function personalModuleDerivations(business, module) {
    const fields = new Set(module?.conditionFields || []);
    return (business?.derivations || []).filter((relation) => {
      const inputs = relation.rule?.inputs || [];
      return inputs.some((input) => fields.has(input.field.startsWith("input.") ? input.field : `input.${input.field}`));
    });
  }

  const overviewRowSpecs = [
    { groupId: "context", label: "近期温度", relationId: "temperature", mappingId: "context.temperatureRange" },
    { groupId: "context", label: "使用场合", relationId: "occasion", mappingId: "context.occasion" },
    { groupId: "personal", label: "外观色彩", relationId: "color", mappingId: "personal.appearance" },
    { groupId: "personal", label: "体型比例", relationId: "body", mappingId: "personal.body" },
    { groupId: "personal", label: "脸型特征", relationId: "face", mappingId: "personal.face" },
    { groupId: "preference", label: "风格方向", relationId: "style", mappingId: "preference.style" },
    { groupId: "preference", label: "正式程度", relationId: "formality", mappingId: "preference.formality" },
    { groupId: "preference", label: "潮流方向", relationId: "trend", mappingId: "preference.trendDirection" },
    { groupId: "goal-boundaries", label: "调整目标", relationId: "goal", mappingId: "goal-boundaries" },
    { groupId: "goal-boundaries", label: "拒绝边界", relationId: "boundaries", mappingId: "goal-boundaries" }
  ];

  function canonicalOverviewRows() {
    const groups = state.ruleSet.inputGroups || [];
    const mappings = state.ruleSet.fieldMappings || [];
    return overviewRowSpecs.map((spec) => {
      const inputGroup = groups.find((group) => group.id === spec.groupId);
      const business = businessDefinitions.find((item) => item.id === spec.relationId);
      const mapping = mappings.find((item) => item.inputId === spec.mappingId);
      return {
        ...spec,
        groupName: inputGroup?.name || spec.groupId,
        groupDescription: inputGroup?.description || "",
        mapping,
        business,
        hard: business?.hard,
        inputs: business?.inputs || [],
        overview: business?.overview || {}
      };
    });
  }

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

  function overviewImpact(row, domainId, fieldId) {
    return row.overview?.[domainId]?.[fieldId] || null;
  }

  function schemaGroupName(id) {
    return state.ruleSet.inputGroups?.find((group) => group.id === id)?.name || id || "其他";
  }

  function renderOverviewImpact(row, domain, field) {
    const level = overviewImpact(row, domain.id, field.id);
    if (!level) {
      return `<td class="overview-impact-cell is-empty"><span class="overview-empty-mark" aria-label="${escapeHtml(row.label)}不影响${escapeHtml(field.name)}">—</span></td>`;
    }
    const symbol = overviewImpactSymbols[level] || "●";
    const label = overviewImpactLabels[level] || "有关联";
    return `<td class="overview-impact-cell is-${escapeHtml(level)}">
      <button type="button" class="overview-impact-btn is-${escapeHtml(level)}" data-overview-target="${escapeHtml(row.relationId)}" data-overview-domain="${escapeHtml(domain.id)}" data-overview-field="${escapeHtml(field.id)}" aria-label="${escapeHtml(row.label)}对${escapeHtml(field.name)}：${escapeHtml(label)}" title="${escapeHtml(row.label)} → ${escapeHtml(field.name)} (${escapeHtml(label)})，点击前往配置">
        <span class="impact-symbol" aria-hidden="true">${symbol}</span>
      </button>
    </td>`;
  }

  function renderOverview() {
    const rows = canonicalOverviewRows();
    const groupSpans = rows.reduce((acc, row) => { acc[row.groupId] = (acc[row.groupId] || 0) + 1; return acc; }, {});
    let previousGroup = null;
    $("#overviewMatrix").innerHTML = `
      <thead>
        <tr>
          <th class="overview-row-heading" rowspan="2">输入分类</th>
          <th class="overview-row-heading" rowspan="2">输入字段</th>
          ${overviewGroups.map((group) => `<th class="overview-group-heading overview-group-${escapeHtml(group.id)}" colspan="${group.fields.length}">${escapeHtml(group.name)}</th>`).join("")}
        </tr>
        <tr>
          ${overviewGroups.flatMap((group) => group.fields.map((field) => `<th class="overview-field-heading overview-group-${escapeHtml(group.id)}">${escapeHtml(field.name)}</th>`)).join("")}
        </tr>
      </thead>
      <tbody>${rows.map((row) => {
        const groupCell = row.groupId === previousGroup ? "" : `<th class="overview-group-label" rowspan="${groupSpans[row.groupId]}"><span>${escapeHtml(row.groupName)}</span></th>`;
        previousGroup = row.groupId;
        return `<tr class="${row.hard ? "is-hard" : ""}">${groupCell}
        <th class="overview-row-label"><span>${escapeHtml(row.label)}</span>${row.hard ? `<em>边界</em>` : `<em class="soft-tag">搭配</em>`}</th>
        ${overviewGroups.flatMap((domain) => domain.fields.map((field) => renderOverviewImpact(row, domain, field))).join("")}
      </tr>`;
      }).join("")}</tbody>`;

    $("#overviewMobileList").innerHTML = rows.map((row) => {
      const impacts = [];
      overviewGroups.forEach(domain => {
        domain.fields.forEach(field => {
          const level = overviewImpact(row, domain.id, field.id);
          if (level) {
            impacts.push({ domain, field, level });
          }
        });
      });
      if (impacts.length === 0) return '';
      return `
        <div class="mobile-relation-card ${row.hard ? "is-hard" : ""}">
          <div class="mobile-relation-header">
            <div>
              <strong>${escapeHtml(row.groupName)} · ${escapeHtml(row.label)}</strong>
              ${row.hard ? `<em>边界</em>` : `<em class="soft-tag">搭配</em>`}
            </div>
          </div>
          <div class="mobile-relation-impacts">
            ${impacts.map(i => {
              const label = overviewImpactLabels[i.level] || "有关联";
              const symbol = overviewImpactSymbols[i.level] || "●";
              return `
                <button type="button" class="mobile-impact-item is-${escapeHtml(i.level)}"
                  data-overview-target="${escapeHtml(row.relationId)}"
                  data-overview-domain="${escapeHtml(i.domain.id)}" 
                  data-overview-field="${escapeHtml(i.field.id)}"
                  aria-label="${escapeHtml(row.label)}对${escapeHtml(i.field.name)}：${escapeHtml(label)}">
                  <span class="impact-field">${escapeHtml(i.field.name)}</span>
                  <div class="impact-status-wrap">
                    <span class="impact-symbol" aria-hidden="true">${symbol}</span>
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
    if (!state.selectedTier1) {
      state.selectedTier1 = getTier1ForRelation(state.selectedId) || "context";
    }
    const currentCat = inputTier1Categories.find((cat) => cat.id === state.selectedTier1) || inputTier1Categories[0];
    const tier3Label = $("#configTier3Label");
    if (tier3Label) tier3Label.textContent = state.selectedTier1 === "personal" ? "具体输入项" : "具体分支";
    if (!currentCat.relations.some((r) => r.id === state.selectedId)) {
      state.selectedId = currentCat.relations[0]?.id || "temperature";
    }

    const tier1Nav = $("#configTier1Tabs");
    if (tier1Nav) {
      tier1Nav.innerHTML = inputTier1Categories.map((cat) => {
        const isActive = cat.id === state.selectedTier1;
        return `<button type="button" role="tab" aria-selected="${isActive}" class="config-tier1-btn ${isActive ? "is-active" : ""}" data-tier1-id="${escapeHtml(cat.id)}"><span>${escapeHtml(cat.name)}</span></button>`;
      }).join("");
    }

    const allRels = businessRelations();
    const tier2Nav = $("#configTier2Chips");
    if (tier2Nav) {
      tier2Nav.innerHTML = currentCat.relations.map((relItem) => {
        const fullRel = allRels.find((r) => r.id === relItem.id);
        const isActive = relItem.id === state.selectedId;
        const branchCount = fullRel?.branchCount || 0;
        const personalModuleCount = personalModulesFor(relItem.id).length;
        const countLabel = state.selectedTier1 === "personal" && personalModuleCount ? `${personalModuleCount}个输入项` : `${branchCount}个分支`;
        return `<button type="button" role="tab" aria-selected="${isActive}" class="config-tier2-btn ${isActive ? "is-active" : ""} ${relItem.tag === "边界" ? "is-hard-chip" : ""}" data-tier2-id="${escapeHtml(relItem.id)}"><span>${escapeHtml(relItem.name)}</span><small>${countLabel}</small></button>`;
      }).join("");
    }

    const tier3Nav = $("#configTier3Chips");
    if (tier3Nav) {
      const business = businessRelationById(state.selectedId);
      if (state.selectedTier1 === "personal" && business) {
        const modules = personalModulesFor(business.id);
        const selectedModule = selectedPersonalModule(business);
        tier3Nav.innerHTML = modules.map((module) => {
          const isActive = module.id === selectedModule?.id;
          const hasRuleBranch = Boolean(module.relationFamily);
          return `<button type="button" role="tab" aria-selected="${isActive}" class="config-tier3-btn config-tier3-module-btn ${isActive ? "is-active" : ""}" data-personal-module-id="${escapeHtml(module.id)}" title="${hasRuleBranch ? "具体分支在配置区展开" : "查看该输入项如何进入推导和服装输出"}">
            <span class="chip-status-dot ${hasRuleBranch ? "is-active" : "is-derived"}"></span>
            <span>${escapeHtml(module.name)}</span>
          </button>`;
        }).join("");
        return;
      }
      const members = business?.mappingMembers || [];
      const groups = members.map((member) => {
        const branches = member.rules || (member.rule ? [member.rule] : []);
        const activeBranch = activeRule(member);
        const branchButtons = branches.map((branch) => {
          const isActive = branch.id === activeBranch?.id;
          const isEnabled = branch.enabled !== false;
          const entryName = branchEntryName(branch, member);
          return `<button type="button" role="tab" aria-selected="${isActive}" class="config-tier3-btn ${isActive ? "is-active" : ""} ${isEnabled ? "" : "is-disabled"}" data-tier3-id="${escapeHtml(branch.id)}" data-tier3-member-id="${escapeHtml(member.id)}" title="分支入口：${escapeHtml(entryName)}">
            <span class="chip-status-dot ${isEnabled ? "is-active" : ""}"></span>
            <span>${escapeHtml(entryName)}</span>
          </button>`;
        }).join("");
        const memberLabel = members.length > 1 ? `<span class="config-tier3-group-label">${escapeHtml(relationMemberName(member))}</span>` : "";
        return `<section class="config-tier3-group ${members.length > 1 ? "is-grouped" : "is-single"}" data-tier3-group="${escapeHtml(member.id)}">
          ${memberLabel}
          <div class="config-tier3-group-items">${branchButtons || `<span class="config-tier3-empty">暂无分支</span>`}</div>
        </section>`;
      }).join("");
      tier3Nav.innerHTML = `${groups}<button type="button" class="config-tier3-add-btn" data-add-branch-tier3 title="新增分支">＋ 新增分支</button>`;
    }
  }

  function renderEditor() {
    const business = businessRelationById(state.selectedId);
    $("#editorTitle").textContent = business?.name || "选择一组关系";
    $(".editor-toolbar").hidden = !business;
    if (!business) {
      $("#editorActions").hidden = true;
      $("#editorContent").innerHTML = `<div class="editor-empty"><strong>选择一条关系开始配置</strong></div>`;
      return;
    }

    const personalModule = state.selectedTier1 === "personal" ? selectedPersonalModule(business) : null;
    const personalRelation = personalModule ? personalModuleRelation(business, personalModule) : null;
    $("#editorActions").hidden = personalModule ? !personalRelation : !business.mappingMembers.length;

    if (personalModule) {
      if (personalRelation) {
        const editable = activeRule(personalRelation);
        editable.analysis ||= { conclusion: editable.name, direction: editable.reason || "" };
        const editableRelation = { ...personalRelation, rule: editable };
        $("#editorContent").innerHTML = renderMappingEditor(editableRelation, business, { module: personalModule });
      } else {
        $("#editorContent").innerHTML = renderPersonalCalculationEditor(business, personalModule);
      }
      return;
    }

    const relation = activeAtomicRelation(business);
    if (!relation) {
      $("#editorContent").innerHTML = renderCalculationDetails(business, true);
      return;
    }
    const editable = activeRule(relation);
    editable.analysis ||= { conclusion: editable.name, direction: editable.reason || "" };
    const editableRelation = { ...relation, rule: editable };
    $("#editorContent").innerHTML = renderMappingEditor(editableRelation, business) + renderCalculationDetails(business);
  }

  function renderMemberSelector(business, relation) {
    return `<section class="member-selector"><label><span>配置内容</span><select data-member-select>${business.mappingMembers.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === relation.id ? "selected" : ""}>${escapeHtml(item.rule.name)}</option>`).join("")}</select></label></section>`;
  }

  const internalValueLabels = {
    none: "无外层",
    long: "长袖",
    threeQuarter: "七分袖",
    short: "短袖",
    light: "轻薄/轻量",
    warm: "保暖外层",
    full: "完整覆盖",
    regular: "适中覆盖",
    smooth: "表面平滑",
    natural: "自然腰位",
    raised: "偏高腰位",
    defined: "明确腰线",
    straight: "连续直线",
    tailored: "利落结构",
    soft: "柔和过渡",
    relaxed: "自然留量",
    street: "都市工装",
    retro: "复古精裁",
    classic: "经典稳妥",
    current: "适度当下",
    statement: "明显潮流",
    true: "是",
    false: "否"
  };

  const outputDisplayNames = {
    family: "服装路线",
    families: "候选路线",
    silhouette: "服装轮廓",
    detail: "款式细节",
    pattern: "图案纹理",
    finish: "材质表面",
    proportion: "版型比例",
    detailIntensity: "细节强度",
    note: "穿着表达",
    seasonVersion: "款式时效",
    trend: "潮流表达",
    layerCount: "推荐层数",
    sleeve: "推荐袖长",
    outer: "推荐外层",
    coverage: "身体覆盖程度",
    material: "材质厚薄表现"
  };

  function formatDisplayValue(definition, value, field = "") {
    const option = definition?.options?.find((item) => String(Array.isArray(item) ? item[0] : item.value) === String(value));
    if (option) return Array.isArray(option) ? option[1] : option.label;
    if (value === undefined || value === null || value === "") return "未设置";
    return internalValueLabels[String(value)] || String(value);
  }

  function formatOutputField(field) {
    const definition = resultDefinition(field);
    return definition?.name || outputDisplayNames[field.split(".").pop()] || field;
  }

  function formatActionOutput(action) {
    return `${formatOutputField(action.field)}：${formatDisplayValue(resultDefinition(action.field), action.value, action.field)}`;
  }

  function ruleBranchSummary(rule, type) {
    if (!rule) return "默认处理";
    if (type === "trend") return rule.coreIdea?.slice(0, 24) || "潮流表达";
    if (type === "outfit") return rule.result?.silhouette || "款式组合";
    const actions = rule.actions || [];
    if (!actions.length) return "默认处理";
    return actions.map(formatActionOutput).join(" · ");
  }

  function renderBranchOutputDetails(rule, relation) {
    if (relation.type === "decision") {
      const actions = rule.actions || [];
      return actions.length
        ? actions.map((action) => `<div class="branch-output-item"><span>${escapeHtml(formatOutputField(action.field))}</span><strong>${escapeHtml(formatDisplayValue(resultDefinition(action.field), action.value, action.field))}</strong></div>`).join("")
        : `<p class="muted-copy">当前分支尚未配置输出。</p>`;
    }
    const result = rule.result || {};
    const entries = Object.entries(result).filter(([key, value]) => value !== undefined && value !== null && value !== "" && key !== "families");
    if (relation.type === "trend" && rule.coreIdea) entries.unshift(["coreIdea", rule.coreIdea]);
    const labels = { coreIdea: "核心理念", reference: "理念来源", season: "适用时间" };
    return entries.length
      ? entries.map(([key, value]) => `<div class="branch-output-item"><span>${escapeHtml(labels[key] || outputDisplayNames[key] || key)}</span><strong>${escapeHtml(formatDisplayValue(null, Array.isArray(value) ? value.join("、") : value, key))}</strong></div>`).join("")
      : `<p class="muted-copy">当前分支尚未配置输出。</p>`;
  }

  function branchConditionValue(condition) {
    const definition = conditionDefinition(condition?.field);
    const option = definition?.options?.find(([value]) => String(value) === String(condition?.value));
    return option?.[1] || serializeValue(condition?.value);
  }

  function branchEntryName(branch, relation) {
    const conditions = branch?.conditions || [];
    if (conditions.length === 1) return branchConditionValue(conditions[0]);
    if (conditions.length > 1) {
      return conditions.map((condition) => {
        const definition = conditionDefinition(condition.field);
        return `${definition?.name || condition.field}：${branchConditionValue(condition)}`;
      }).join(" · ");
    }
    return branch?.name || relationMemberName(relation);
  }

  function renderEditorBase(relation) {
    return `<div class="rule-config-meta">
      <div class="rule-meta-kind"><span class="rule-kind-chip is-${relation.kind}">${relation.kind === "hard" ? "硬性边界" : "搭配偏好"}</span><span>当前分支</span></div>
      <div class="rule-meta-name">${field("分支名称", "name", relation.rule.name)}</div>
      <label class="switch-control"><input type="checkbox" data-edit="enabled" ${relation.rule.enabled === false ? "" : "checked"}><span></span>启用</label>
    </div>`;
  }

  function renderPersonalBranchSelector(relation, module) {
    const branches = relation.rules || (relation.rule ? [relation.rule] : []);
    const active = activeRule(relation);
    if (!branches.length) return "";
    return `<section class="personal-branch-selector">
      <div class="personal-branch-heading"><strong>具体分支</strong><small>${escapeHtml(module.name)}的条件值在此展开，推荐结果单独显示在下方。</small></div>
      <div class="personal-branch-list">${branches.map((branch) => {
        const isActive = branch.id === active?.id;
        return `<button type="button" class="personal-branch-btn ${isActive ? "is-active" : ""}" data-branch-chip="${escapeHtml(branch.id)}" aria-pressed="${isActive}">${escapeHtml(branchEntryName(branch, relation))}</button>`;
      }).join("")}</div>
    </section>`;
  }

  function moduleFieldLabels(module) {
    return (module.conditionFields || []).map((fieldId) => conditionDefinition(fieldId)).filter(Boolean);
  }

  function inputPath(fieldId) {
    return String(fieldId || "").replace(/^input\./, "");
  }

  function personalSelectionKey(business, module) {
    return `${business?.id || "personal"}.${module?.id || "input"}`;
  }

  function personalModuleInput(business, module) {
    const input = Engine.clone(Engine.Store.loadInput());
    const key = personalSelectionKey(business, module);
    const selected = state.personalValueSelections[key] || {};
    const values = {};
    (module.conditionFields || []).forEach((fieldId) => {
      const path = inputPath(fieldId);
      const definition = conditionDefinition(fieldId);
      const fallback = Engine.getByPath(input, path);
      const value = Object.prototype.hasOwnProperty.call(selected, fieldId) ? selected[fieldId] : fallback;
      values[fieldId] = value;
      Engine.setByPath(input, path, value);
      if (definition && !Object.prototype.hasOwnProperty.call(selected, fieldId)) selected[fieldId] = fallback;
    });
    state.personalValueSelections[key] = selected;
    return { input, values };
  }

  function personalPreview(business, module) {
    const { input, values } = personalModuleInput(business, module);
    return { ...Engine.run(input, state.ruleSet), values };
  }

  function previewValue(fieldId, preview) {
    const value = Engine.getByPath(preview, fieldId);
    if (Array.isArray(value)) return value.map((item) => formatDisplayValue(null, item, fieldId)).join("、");
    return formatDisplayValue(resultDefinition(fieldId), value, fieldId);
  }

  function previewPalette(preview) {
    const candidatePalette = preview?.candidates?.[0]?.palette;
    if (candidatePalette) return candidatePalette;
    const plan = state.ruleSet.palettePlans.find((item) => item.id === preview?.requirements?.palettePlanId);
    if (!plan) return null;
    const colors = new Map((state.ruleSet.colorLibrary || []).map((item) => [item.id, item]));
    return {
      ...plan,
      roles: (plan.roles || []).map((role) => {
        const color = colors.get(role.colorId);
        return { ...role, colorName: color?.name || "基础色", hex: color?.hex || "#c7c7c7" };
      })
    };
  }

  function paletteRoleLabel(role) {
    return ({ nearFace: "近脸色", main: "主色", secondary: "辅助色", accent: "点缀色" })[role] || role || "颜色";
  }

  function renderPersonalInputBranches(business, module) {
    const preview = personalPreview(business, module);
    const key = personalSelectionKey(business, module);
    return `<section class="personal-input-branches">
      <div class="personal-branch-heading"><strong>当前输入分支</strong><small>分支入口只代表输入条件，推荐结果在下方单独呈现。</small></div>
      <div class="personal-input-branch-list">${moduleFieldLabels(module).map((definition) => {
        const selected = preview.values[definition.id];
        const options = definition.options || [];
        return `<div class="personal-input-row"><span>${escapeHtml(definition.name)}</span><div class="personal-input-values" role="radiogroup" aria-label="${escapeHtml(definition.name)}">${options.map(([value, label]) => `<button type="button" class="personal-value-btn ${String(value) === String(selected) ? "is-active" : ""}" data-personal-value-field="${escapeHtml(definition.id)}" data-personal-value="${escapeHtml(String(value))}" data-personal-value-key="${escapeHtml(key)}" aria-pressed="${String(value) === String(selected)}">${escapeHtml(label)}</button>`).join("")}</div></div>`;
      }).join("")}</div>
    </section>`;
  }

  function personalOutputItems(business, module, preview) {
    const fields = (business.scope?.result || []).filter((fieldId) => resultDefinition(fieldId));
    const items = fields.map((fieldId) => ({ label: formatOutputField(fieldId), value: previewValue(fieldId, preview), fieldId }));
    const palette = previewPalette(preview);
    if (palette?.roles?.length) {
      palette.roles.forEach((role) => items.push({ label: paletteRoleLabel(role.role), value: role.colorName, color: role.hex, fieldId: `palette.${role.role}` }));
    }
    return items;
  }

  function renderPersonalDecisionMappings(business, module, preview) {
    const relations = (business.mappingMembers || []).filter((relation) => relation.type === "decision");
    if (!relations.length) return "";
    const context = { input: preview.input, derived: preview.derived };
    const resultDefinitions = scopedFields(state.ruleSet.resultFields, business.scope?.result);
    return `<div class="personal-decision-mappings"><div class="personal-config-subheading"><strong>服装输出映射</strong><small>当前输入经过推导后命中的决策分支，可直接修改输出值。</small></div>${relations.map((relation) => {
      const branches = relation.rules || (relation.rule ? [relation.rule] : []);
      const matched = branches.find((branch) => (branch.conditions || []).every((condition) => Engine.getByPath(context, condition.field) === condition.value)) || branches[0];
      if (!matched) return "";
      const conditionText = (matched.conditions || []).map((condition) => {
        const definition = conditionDefinition(condition.field);
        return `${definition?.name || condition.field} = ${branchConditionValue(condition)}`;
      }).join("；");
      return `<section class="personal-decision-map" data-personal-relation-id="${escapeHtml(relation.id)}" data-personal-branch-id="${escapeHtml(matched.id)}"><div class="personal-decision-map-head"><span>${escapeHtml(relationMemberName(relation))}</span><strong>${escapeHtml(branchEntryName(matched, relation))}</strong></div><div class="personal-decision-map-when">WHEN：${escapeHtml(conditionText || "满足当前推导条件")}</div>${renderDecisionActions(matched, resultDefinitions)}</section>`;
    }).join("")}</div>`;
  }

  function renderPersonalCalculationEditor(business, module) {
    const derivations = personalModuleDerivations(business, module);
    const preview = personalPreview(business, module);
    const outputNames = business.outputs || [];
    const derivedItems = (module.derivedOutputs || []).map((output) => ({
      label: derivedOutputName(output),
      value: previewValue(`derived.${output}.label`, preview)
    }));
    const outputItems = personalOutputItems(business, module, preview);
    const missing = moduleFieldLabels(module).filter((definition) => preview.values[definition.id] === undefined || preview.values[definition.id] === null || preview.values[definition.id] === "");
    const calculationBusiness = { ...business, derivations };
    return `
      <section class="rule-summary-module personal-module-summary">
        <div class="rule-summary-submodule relation-impact-submodule">
          <div class="rule-summary-heading"><span class="module-index">01</span><div><strong>关系影响输出</strong><small>${escapeHtml(module.name)}</small></div></div>
          <div class="scope-pill-list">${outputNames.map((name) => `<span class="scope-pill">${escapeHtml(name)}</span>`).join("") || `<span class="scope-pill">暂无已连接结果</span>`}</div>
        </div>
        <div class="rule-summary-submodule branch-output-submodule">
          <div class="rule-summary-heading"><span class="module-index">02</span><div><strong>当前分支具体输出</strong><small>${missing.length ? "条件未完整，结果仅作影响预览" : "已解析到具体服装输出"}</small></div></div>
          <div class="personal-output-status ${missing.length ? "is-incomplete" : "is-complete"}">${missing.length ? `还需要：${missing.map((definition) => escapeHtml(definition.name)).join("、")}` : "当前输入条件完整"}</div>
          <div class="branch-output-grid personal-derived-grid">${derivedItems.map((item) => `<div class="branch-output-item"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`).join("")}</div>
          <div class="branch-output-grid personal-clothing-grid">${outputItems.map((item) => `<div class="branch-output-item ${item.color ? "has-color" : ""}"><span>${escapeHtml(item.label)}</span><strong>${item.color ? `<i class="output-color-swatch" style="--swatch:${escapeHtml(item.color)}" aria-hidden="true"></i>` : ""}${escapeHtml(item.value)}</strong></div>`).join("")}</div>
        </div>
      </section>
      <section class="rule-config-module personal-calculation-module">
        <div class="rule-config-heading"><span>03</span><strong>规则配置</strong><small>WHEN / DERIVE / THEN / WHY</small></div>
        ${renderPersonalInputBranches(business, module)}
        <div class="personal-rule-flow"><div><span>WHEN</span><strong>${moduleFieldLabels(module).map((definition) => `${escapeHtml(definition.name)} = ${escapeHtml(formatDisplayValue(definition, preview.values[definition.id]))}`).join("；")}</strong></div><div><span>DERIVE</span><strong>${derivedItems.map((item) => `${escapeHtml(item.label)} = ${escapeHtml(item.value)}`).join("；") || "暂无推导"}</strong></div><div><span>THEN</span><strong>${outputItems.slice(0, 4).map((item) => `${escapeHtml(item.label)} = ${escapeHtml(item.value)}`).join("；") || "暂无服装输出"}</strong></div></div>
        ${renderCalculationDetails(calculationBusiness, false)}
        ${renderPersonalDecisionMappings(business, module, preview)}
        <div class="personal-why-note"><span>WHY</span><p>个人色彩先综合肤色、发色和瞳色，再结合冷暖、明度对比和彩度匹配服装配色。单独一个输入项不会被错误地视为唯一决定因素。</p></div>
      </section>
    `;
  }

  function renderMappingEditor(relation, business, options = {}) {
    const rule = relation.rule;
    const module = options.module;
    const conditionFields = scopedFields(state.ruleSet.conditionFields, business.scope?.condition);
    const resultFields = scopedFields(state.ruleSet.resultFields, business.scope?.result);
    const stepTwo = relation.type === "trend" ? renderTrendResults(rule) : relation.type === "outfit" ? renderOutfitResults(rule) : renderDecisionActions(rule, resultFields);
    const entryName = branchEntryName(rule, relation);
    const outputsList = (business.outputs || []).map((output) => `<span class="scope-pill">${escapeHtml(output)}</span>`).join("");

    return `
      <section class="rule-summary-module">
        <div class="rule-summary-submodule relation-impact-submodule">
          <div class="rule-summary-heading">
            <span class="module-index">01</span>
            <div><strong>关系影响输出</strong><small>${escapeHtml(business.name)}</small></div>
          </div>
          <div class="scope-pill-list">${outputsList || `<span class="scope-pill">全套穿着方案</span>`}</div>
        </div>
        <div class="rule-summary-submodule branch-output-submodule">
          <div class="rule-summary-heading">
            <span class="module-index">02</span>
            <div><strong>当前分支具体输出</strong><small>${escapeHtml(entryName)}</small></div>
          </div>
          <div class="branch-output-grid">${renderBranchOutputDetails(rule, relation)}</div>
        </div>
      </section>

      <section class="rule-config-module">
        <div class="rule-config-heading"><span>03</span><strong>规则配置</strong><small>WHEN / THEN / WHY</small></div>
        ${module ? renderPersonalBranchSelector(relation, module) : ""}
        ${renderEditorBase(relation)}
        <article class="natural-rule-card">
          <section class="rule-clause rule-clause--when">
            <div class="clause-heading">
              <span class="clause-prefix">WHEN</span>
              <strong>满足条件</strong>
              <div class="condition-mode-inline">
                ${(rule.conditions || []).length > 1 ? selectField("条件关系", "conditionMode", rule.conditionMode || "all", [["all", "全部满足 (AND)"], ["any", "任一满足 (OR)"]]) : `<span class="condition-lock-note">首条分支条件已固定</span>`}
                <button type="button" class="text-button" data-add-condition>＋ 添加条件</button>
              </div>
            </div>
            <div class="condition-list">
              ${(rule.conditions || []).map((condition, index) => renderConditionRow(condition, index, conditionFields)).join("") || `<p class="muted-copy">没有条件限制时，该规则默认始终适用。</p>`}
            </div>
          </section>

          <section class="rule-clause rule-clause--then">
            <div class="clause-heading">
              <span class="clause-prefix">THEN</span>
              <strong>输出结果</strong>
            </div>
            ${stepTwo}
          </section>

          <section class="rule-clause rule-clause--why">
            <div class="clause-heading">
              <span class="clause-prefix">WHY</span>
              <strong>配置依据</strong>
            </div>
            ${textareaField("说明理由", "reason", rule.reason || "")}
          </section>
        </article>
      </section>
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
    const definition = definitions.find((item) => item.id === condition.field) || conditionDefinition(condition.field);
    const fieldName = definition?.name || condition.field;
    const opText = condition.operator === "neq" ? "不等于" : condition.operator === "gt" ? "高于" : condition.operator === "gte" ? "不低于" : condition.operator === "lt" ? "低于" : condition.operator === "lte" ? "不高于" : "等于";
    const operatorOptions = [["eq", "等于"], ["neq", "不等于"], ["gt", "高于"], ["gte", "不低于"], ["lt", "低于"], ["lte", "不高于"]];
    const isBase = index === 0;
    const fieldOptions = definitions.map((item) => [item.id, item.name]);
    return `<div class="natural-condition-row">
      <span class="clause-tag">IF</span>
      ${isBase
        ? `<span class="condition-prefix-label">当</span><strong class="condition-locked-name">【${escapeHtml(fieldName)}】</strong><span class="condition-op-badge">${escapeHtml(opText)}</span><div class="condition-val-control">${typedValueField("", `conditions.${index}.value`, condition.value, definition, true)}</div>`
        : `<div class="condition-extra-field">${selectField("输入字段", `conditions.${index}.field`, condition.field, fieldOptions)}</div><div class="condition-extra-op">${selectField("关系", `conditions.${index}.operator`, condition.operator || "eq", operatorOptions)}</div><div class="condition-val-control">${typedValueField("", `conditions.${index}.value`, condition.value, definition)}</div>`}
      <span class="condition-suffix-label">时</span>
      ${index > 0 ? `<button class="icon-button is-danger" type="button" data-remove-condition="${index}" title="删除条件" aria-label="删除条件">×</button>` : ""}
    </div>`;
  }

  function renderDecisionActions(rule, definitions) {
    const actionTypeLabels = { SET: "设为", REQUIRE: "必须满足", FORBID: "禁止", FILTER: "过滤", BOOST: "优先", ADD: "追加", REPLACE: "替换" };
    const existingFields = new Set((rule.actions || []).map((action) => action.field));
    const availableFields = definitions.filter((definition) => !existingFields.has(definition.id));
    return `
      <div class="action-heading">
        <strong>输出决策项列表</strong>
        <div class="action-add-controls">
          ${availableFields.length ? `<select class="action-add-field" data-add-action-field aria-label="选择新增输出维度">${availableFields.map((definition) => `<option value="${escapeHtml(definition.id)}">${escapeHtml(definition.name)}</option>`).join("")}</select>` : `<span class="action-add-empty">当前关系的输出维度已配置</span>`}
          <button type="button" class="secondary-button action-add-btn" data-add-action ${availableFields.length ? "" : "disabled"}>＋ 添加输出项</button>
        </div>
      </div>
      <div class="action-column-head" aria-hidden="true"><span>输出维度</span><span>目标值</span><span>动作</span></div>
      <div class="natural-action-list">
        ${(rule.actions || []).map((action, index) => {
          const definition = definitions.find((item) => item.id === action.field) || resultDefinition(action.field);
          const allowedActionTypes = definition?.actions?.length ? definition.actions : ["SET"];
          const actionTypeOptions = [...new Set([...allowedActionTypes, action.type || "SET"])].map((value) => [value, actionTypeLabels[value] || value]);
          const actionLabel = actionTypeLabels[action.type] || "设为";
          const actionFieldOptions = definitions.map((item) => [item.id, item.name]);
          const actionMenuLabel = action.type === "SET" ? "⋯" : actionLabel;
          return `<div class="natural-action-row">
            <div class="action-field-control">${selectField("输出维度", `actions.${index}.field`, action.field, actionFieldOptions)}</div>
            <details class="action-type-details">
              <summary title="更改动作方式" aria-label="更改动作方式">${escapeHtml(actionMenuLabel)}</summary>
              ${selectField("动作方式", `actions.${index}.type`, action.type || "SET", actionTypeOptions)}
            </details>
            <div class="action-value-control">
              ${typedValueField("", `actions.${index}.value`, action.value, definition)}
            </div>
            <button class="icon-button is-danger" type="button" data-remove-action="${index}" title="删除该输出项" aria-label="删除该输出项">×</button>
          </div>`;
        }).join("") || `<p class="muted-copy">暂无动作，点击上方“＋ 添加输出决策项”。</p>`}
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

    const personalHost = event.target.closest("[data-personal-relation-id]");
    if (personalHost && business) {
      const personalRelation = (business.mappingMembers || []).find((item) => item.id === personalHost.dataset.personalRelationId);
      if (personalRelation) {
        const editable = personalRelation.rules?.find((rule) => rule.id === personalHost.dataset.personalBranchId) || activeRule(personalRelation);
        const control = event.target.closest("[data-edit]");
        if (!control || control.disabled) return;
        const path = control.dataset.edit;
        const previous = Engine.getByPath(editable, path);
        const value = control.type === "checkbox" ? control.checked : parseByPrevious(control.value, previous);
        Engine.setByPath(editable, path, value);
        if (/^actions\.\d+\.field$/.test(path)) resetActionValue(editable, path, value);
        markDirty();
        renderAll();
        return;
      }
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
    if (!business) return;

    const personalValueButton = event.target.closest("button[data-personal-value-field]");
    if (personalValueButton) {
      const module = selectedPersonalModule(business);
      if (!module) return;
      const definition = conditionDefinition(personalValueButton.dataset.personalValueField);
      const selectedOption = definition?.options?.find(([value]) => String(value) === personalValueButton.dataset.personalValue);
      const key = personalValueButton.dataset.personalValueKey || personalSelectionKey(business, module);
      state.personalValueSelections[key] ||= {};
      state.personalValueSelections[key][personalValueButton.dataset.personalValueField] = selectedOption?.[0] ?? personalValueButton.dataset.personalValue;
      renderEditor();
      return;
    }

    const personalHost = event.target.closest("[data-personal-relation-id]");
    const relation = personalHost
      ? (business.mappingMembers || []).find((item) => item.id === personalHost.dataset.personalRelationId)
      : activeAtomicRelation(business);
    if (!relation) return;
    const editable = relation.rules?.find((rule) => rule.id === personalHost?.dataset.personalBranchId) || activeRule(relation);

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
      const allowed = scopedFields(state.ruleSet.conditionFields, business.scope?.condition);
      const first = allowed[0];
      editable.conditions.push({ field: first?.id || "input.context.temperatureRange", operator: "eq", value: first?.options?.[0]?.[0] ?? "18_24" });
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
      const allowed = scopedFields(state.ruleSet.resultFields, business.scope?.result);
      const existingFields = new Set(editable.actions.map(a => a.field));
      const requestedField = event.target.closest("[data-add-action]")?.parentElement?.querySelector("[data-add-action-field]")?.value;
      const unassigned = allowed.find(f => f.id === requestedField && !existingFields.has(f.id))
        || allowed.find(f => !existingFields.has(f.id))
        || allowed[0]
        || state.ruleSet.resultFields[0];
      const defaultVal = unassigned?.options?.[0]?.[0] ?? (unassigned?.valueType === "boolean" ? true : unassigned?.valueType === "number" ? 1 : "");
      editable.actions.push({ type: unassigned?.actions?.[0] || "SET", field: unassigned?.id || "requirements.material", value: defaultVal });
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

  function selectField(label, path, value, options, disabled = false) {
    return `<label class="editor-field"><span>${label}</span><select data-edit="${path}" ${disabled ? "disabled" : ""}>${options.map(([option, name]) => `<option value="${escapeHtml(option)}" ${String(option) === String(value) ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}</select></label>`;
  }

  function groupedSelect(label, path, value, definitions) {
    const groups = [...new Set(definitions.map((item) => item.groupId || item.group || "其他"))];
    return `<label class="editor-field"><span>${label}</span><select data-edit="${path}">${groups.map((group) => `<optgroup label="${escapeHtml(schemaGroupName(group))}">${definitions.filter((item) => (item.groupId || item.group || "其他") === group).map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === value ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</optgroup>`).join("")}</select></label>`;
  }

  function scopedFields(definitions, allowedIds) {
    if (!Array.isArray(allowedIds) || !allowedIds.length) return definitions;
    const allowed = new Set(allowedIds);
    const scoped = definitions.filter((item) => allowed.has(item.id));
    return scoped.length ? scoped : definitions;
  }

  function typedValueField(label, path, value, definition, disabled = false) {
    if (definition?.options?.length) return selectField(label, path, value, definition.options, disabled);
    return field(label, path, serializeValue(value), definition?.valueType === "number" ? "number" : "text", disabled);
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
