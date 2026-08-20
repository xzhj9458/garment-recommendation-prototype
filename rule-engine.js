(function () {
  "use strict";

  const DATA = window.GarmentPrototypeData;
  const STORAGE_KEYS = {
    published: "garment-prototype-v121-published",
    draft: "garment-prototype-v121-draft",
    input: "garment-prototype-v121-input"
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getByPath(target, path) {
    return String(path || "").split(".").reduce((value, key) => (
      value === undefined || value === null ? undefined : value[key]
    ), target);
  }

  function setByPath(target, path, value) {
    const keys = String(path).split(".");
    const last = keys.pop();
    const parent = keys.reduce((cursor, key) => {
      if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = {};
      return cursor[key];
    }, target);
    parent[last] = clone(value);
  }

  function mergeKnown(target, source) {
    Object.entries(source || {}).forEach(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        if (!target[key] || typeof target[key] !== "object" || Array.isArray(target[key])) target[key] = {};
        mergeKnown(target[key], value);
      } else if (value !== undefined) {
        target[key] = clone(value);
      }
    });
    return target;
  }

  function normalizeInput(input) {
    const source = clone(input || {});
    const normalized = mergeKnown(clone(DATA.defaultInput), source);
    const migrate = (legacyPath, canonicalPath, transform = (value) => value) => {
      if (isKnown(getByPath(source, canonicalPath))) return;
      const legacyValue = getByPath(source, legacyPath);
      if (isKnown(legacyValue)) setByPath(normalized, canonicalPath, transform(legacyValue));
    };

    ["skin", "hair", "eye"].forEach((part) => {
      migrate(`color.${part}.hue`, `appearance.${part}Temperature`);
      migrate(`color.${part}.contrast`, `appearance.${part}Value`);
      migrate(`color.${part}.chroma`, `appearance.${part}Chroma`);
    });
    const legacyScale = (value) => Math.max(0, Math.min(4, Number(value) <= 2 ? Number(value) + 1 : Number(value)));
    migrate("body.heightScale", "body.heightPresence", legacyScale);
    migrate("body.legBodyRatio", "body.legRatio", legacyScale);
    migrate("body.waistLine", "body.waistDefinition", legacyScale);
    migrate("body.shoulderHip", "body.shoulderHipBalance", legacyScale);
    migrate("goal.target", "goal.endpoint", (value) => ({ none: "unknown" })[value] || value);
    migrate("goal.direction", "goal.direction", (value) => ({ auto: "keep", soften: "weaken" })[value] || value);

    const valueAliases = {
      "context.occasion": { party: "social", trip: "travel" },
      "preference.style": { relaxed: "casual", cityboy: "urban" },
      "preference.trendIntensity": { subtle: "light" },
      "face.shape": { oval: "standard" }
    };
    Object.entries(valueAliases).forEach(([path, aliases]) => {
      const value = getByPath(normalized, path);
      if (aliases[value]) setByPath(normalized, path, aliases[value]);
    });

    const legacyForbidden = source.boundaries?.forbiddenCategories || [];
    const legacyBody = source.boundaries?.bodyBoundaries || [];
    if (!isKnown(source.boundaries?.strictCoverage) && legacyBody.includes("hideMidriff")) normalized.boundaries.strictCoverage = true;
    if (!isKnown(source.boundaries?.movementFriendly) && legacyBody.includes("looseArm")) normalized.boundaries.movementFriendly = true;
    if (!isKnown(source.boundaries?.rejectDefinedWaist) && legacyForbidden.includes("tightTop")) normalized.boundaries.rejectDefinedWaist = true;

    return normalized;
  }

  function isKnown(value) {
    return value !== undefined && value !== null && value !== "" && !Number.isNaN(value);
  }

  function bandFor(value, bands) {
    if (!isKnown(value)) return null;
    return bands.find((band) => Number(value) <= Number(band.max)) || bands[bands.length - 1] || null;
  }

  function labelForOption(ruleSet, parameterId, value) {
    const parameter = ruleSet.parameters.find((item) => item.id === parameterId);
    const option = parameter?.options?.find((item) => String(item.value) === String(value));
    return option?.label ?? String(value ?? "需验证");
  }

  function normalizeRuleSet(ruleSet) {
    const normalized = clone(ruleSet || DATA.defaultRuleSet);
    normalized.meta ||= {};
    normalized.parameters ||= [];
    normalized.derivedRules ||= [];
    normalized.decisionRules ||= [];
    normalized.components ||= [];
    normalized.outfitOutputs ||= clone(DATA.defaultRuleSet.outfitOutputs || []);
    normalized.colorLibrary ||= clone(DATA.defaultRuleSet.colorLibrary || []);
    normalized.palettePlans ||= clone(DATA.defaultRuleSet.palettePlans || []);
    normalized.patternLibrary ||= clone(DATA.defaultRuleSet.patternLibrary || []);
    normalized.trendDirections ||= clone(DATA.defaultRuleSet.trendDirections || []);
    normalized.conditionFields ||= clone(DATA.defaultRuleSet.conditionFields || []);
    normalized.resultFields ||= clone(DATA.defaultRuleSet.resultFields || []);
    normalized.inputGroups ||= clone(DATA.defaultRuleSet.inputGroups || []);
    normalized.fieldMappings ||= clone(DATA.defaultRuleSet.fieldMappings || []);
    normalized.operatorDictionary ||= clone(DATA.defaultRuleSet.operatorDictionary || {});
    normalized.tests ||= [];

    const visibleParameterLabels = {
      "appearance.skinTemperature": "肤色色调",
      "appearance.hairTemperature": "发色色调",
      "appearance.eyeTemperature": "瞳色色调",
      "body.heightPresence": "纵向高度",
      "body.legRatio": "腿身分布",
      "body.waistDefinition": "腰线特征",
      "body.shoulderHipBalance": "横向轮廓"
    };
    normalized.parameters.forEach((parameter) => {
      if (visibleParameterLabels[parameter.id]) parameter.name = visibleParameterLabels[parameter.id];
    });
    normalized.conditionFields.forEach((field) => {
      if (!field.id?.startsWith("input.")) return;
      const parameter = normalized.parameters.find((item) => `input.${item.id}` === field.id);
      if (parameter) {
        field.name = parameter.name;
        field.group = parameter.group;
        field.options = (parameter.options || []).map((item) => Array.isArray(item) ? [item[0], item[1]] : [item.value, item.label]);
      }
    });
    const visibleResultLabels = {
      "requirements.colorTemperature": "服装冷暖属性"
    };
    normalized.resultFields.forEach((field) => {
      if (visibleResultLabels[field.id]) field.name = visibleResultLabels[field.id];
    });
    const trendParameter = normalized.parameters.find((item) => item.id === "preference.trendDirection");
    if (trendParameter) {
      trendParameter.options = [
        { value: "none", label: "不限定" },
        ...normalized.trendDirections.filter((item) => item.enabled !== false).map((item) => ({ value: item.value, label: item.name }))
      ];
    }
    return normalized;
  }

  function deriveFeatures(input, ruleSet) {
    const derived = {};
    const trace = [];
    const missing = [];
    const rules = [...ruleSet.derivedRules]
      .filter((rule) => rule.enabled)
      .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));

    rules.forEach((rule) => {
      const values = rule.inputs
        .map((item) => ({ ...item, value: getByPath(input, item.field) }))
        .filter((item) => isKnown(item.value));

      if (!values.length || values.length < rule.inputs.length) {
        setByPath(derived, rule.output, {
          value: null,
          label: "需验证",
          ruleId: rule.id,
          missing: rule.inputs.filter((item) => !isKnown(getByPath(input, item.field))).map((item) => item.field)
        });
        missing.push({
          feature: rule.output,
          ruleId: rule.id,
          fields: rule.inputs.filter((item) => !isKnown(getByPath(input, item.field))).map((item) => item.field)
        });
        trace.push({ stage: "derive", status: "needs_verification", ruleId: rule.id, name: rule.name, reason: "缺少必要事实，暂不计算。" });
        return;
      }

      let value;
      if (rule.operation === "weightedAverage") {
        const totalWeight = values.reduce((sum, item) => sum + Number(item.weight || 1), 0);
        value = values.reduce((sum, item) => sum + Number(item.value) * Number(item.weight || 1), 0) / totalWeight;
      } else if (rule.operation === "range") {
        value = Math.max(...values.map((item) => Number(item.value))) - Math.min(...values.map((item) => Number(item.value)));
      } else if (rule.operation === "bodyShape") {
        const waist = Number(getByPath(input, "body.waistDefinition"));
        const balance = Number(getByPath(input, "body.shoulderHipBalance"));
        if (waist >= 3 && balance === 2) value = 2;
        else if (waist <= 1 && balance >= 3) value = 1;
        else if (waist >= 3 && balance <= 1) value = 4;
        else if (balance >= 3) value = 3;
        else value = 0;
      } else {
        value = Number(values[0].value);
      }

      const rounded = Math.round(value * 100) / 100;
      const band = bandFor(rounded, rule.bands || []);
      setByPath(derived, rule.output, {
        value: rounded,
        label: band?.label || String(rounded),
        ruleId: rule.id,
        inputs: rule.inputs.map((item) => item.field)
      });
      trace.push({
        stage: "derive",
        status: "matched",
        ruleId: rule.id,
        name: rule.name,
        reason: rule.reason,
        inputs: rule.inputs.map((item) => item.field),
        sourcePaths: rule.inputs.map((item) => item.field),
        output: rule.output,
        value: rounded,
        label: band?.label || String(rounded)
      });
    });

    return { derived, trace, missing };
  }

  function conditionMatches(condition, context) {
    const actual = getByPath(context, condition.field);
    const expected = condition.value;
    switch (condition.operator) {
      case "neq": return actual !== expected;
      case "gt": return Number(actual) > Number(expected);
      case "gte": return Number(actual) >= Number(expected);
      case "lt": return Number(actual) < Number(expected);
      case "lte": return Number(actual) <= Number(expected);
      case "in": return Array.isArray(expected) && expected.includes(actual);
      case "contains": return Array.isArray(actual) ? actual.includes(expected) : String(actual || "").includes(String(expected));
      case "exists": return isKnown(actual) === Boolean(expected);
      case "eq":
      default: return actual === expected;
    }
  }

  function ruleConditionsMatch(rule, context) {
    const conditions = rule.conditions || [];
    if (!conditions.length) return true;
    if (rule.conditionMode === "any") return conditions.some((condition) => conditionMatches(condition, context));
    return conditions.every((condition) => conditionMatches(condition, context));
  }

  function applyDecisionRules(input, derived, ruleSet) {
    const context = { input, derived };
    const state = {
      requirements: {
        layerCount: 1,
        sleeve: "threeQuarter",
        outer: "none",
        coverage: "regular",
        material: "轻薄",
        formalityMin: 1,
        movement: false,
        waist: null,
        line: null,
        texture: "regular",
        colorTemperature: derived.color?.temperature?.label || "需验证",
        colorContrast: derived.color?.contrast?.label || "需验证",
        colorChroma: derived.color?.chroma?.label || "需验证",
        colorContrastMax: "高",
        palettePlanId: null,
        neckline: null,
        faceEffect: null,
        faceShape: input.face?.shape || null
      },
      preferences: { family: [] },
      notes: [],
      forbidden: [],
      locks: {},
      trace: [],
      conflicts: []
    };

    const rules = [...ruleSet.decisionRules]
      .filter((rule) => rule.enabled)
      .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));

    rules.forEach((rule) => {
      const matched = ruleConditionsMatch(rule, context);
      if (!matched) return;

      const actionResults = [];
      (rule.actions || []).forEach((action) => {
        const lockedBy = state.locks[action.field];
        const current = getByPath(state, action.field);
        const hardRule = rule.kind === "hard";

        if (lockedBy && lockedBy.kind === "hard" && (!hardRule || Number(rule.priority || 0) < Number(lockedBy.priority || 0))) {
          actionResults.push({ ...action, status: "skipped", reason: `被硬性规则 ${lockedBy.ruleId} 覆盖` });
          return;
        }

        if (hardRule && lockedBy?.kind === "hard" && lockedBy.priority === rule.priority && current !== action.value) {
          state.conflicts.push({ field: action.field, rules: [lockedBy.ruleId, rule.id], values: [current, action.value] });
          actionResults.push({ ...action, status: "conflict" });
          return;
        }

        switch (action.type) {
          case "ADD": {
            const list = Array.isArray(current) ? current : [];
            if (!list.includes(action.value)) setByPath(state, action.field, [...list, action.value]);
            break;
          }
          case "BOOST": {
            const list = Array.isArray(current) ? current : [];
            setByPath(state, action.field, [action.value, ...list.filter((value) => value !== action.value)]);
            break;
          }
          case "FORBID":
          case "FILTER":
            state.forbidden.push({ field: action.field, value: action.value, ruleId: rule.id, reason: rule.reason });
            break;
          case "REPLACE":
            if (!isKnown(action.from) || current === action.from) setByPath(state, action.field, action.value);
            break;
          case "REQUIRE":
          case "SET":
          default:
            setByPath(state, action.field, action.value);
            break;
        }

        if (hardRule && ["SET", "REQUIRE", "REPLACE"].includes(action.type)) {
          state.locks[action.field] = { ruleId: rule.id, kind: "hard", priority: Number(rule.priority || 0) };
        }
        actionResults.push({ ...action, status: "applied" });
      });

      state.trace.push({
        stage: rule.kind === "hard" ? "hard" : "soft",
        status: actionResults.some((item) => item.status === "conflict")
          ? "conflict"
          : actionResults.length && actionResults.every((item) => item.status === "skipped")
            ? "skipped"
            : actionResults.some((item) => item.status === "skipped")
              ? "partial"
              : "matched",
        ruleId: rule.id,
        name: rule.name,
        kind: rule.kind,
        priority: Number(rule.priority || 0),
        reason: rule.reason,
        analysis: rule.analysis || null,
        group: rule.group || "其他",
        conditions: clone(rule.conditions || []),
        actions: actionResults
      });
    });

    enforceDerivedLimits(state);
    applyOutfitOutputs(input, derived, state, ruleSet);
    applyTrendDirection(input, state, ruleSet);
    resolvePalettePlan(state, ruleSet);
    return state;
  }

  function canonicalStyleFamilies(style, silhouette) {
    const byStyle = {
      minimal: ["straight", "tailored", "soft"],
      urban: ["tailored", "straight", "soft"],
      elegant: ["soft", "retro", "tailored"],
      casual: ["relaxed", "straight", "soft"],
      street: ["street", "relaxed", "straight"],
      retro: ["retro", "soft", "tailored"],
      cityboy: ["relaxed", "street", "straight"]
    };
    const bySilhouette = {
      H: ["straight", "tailored", "soft"],
      A: ["soft", "retro", "straight"],
      X: ["soft", "retro", "tailored"],
      Y: ["tailored", "street", "straight"],
      O: ["relaxed", "street", "soft"],
      shortWideLongSlim: ["street", "relaxed", "straight"]
    };
    const preferred = byStyle[style] || bySilhouette[silhouette] || ["straight", "soft", "relaxed"];
    return [...preferred, ...(bySilhouette[silhouette] || []).filter((family) => !preferred.includes(family))];
  }

  function canonicalTrendFamilies(direction) {
    return {
      utilityLayering: ["street", "relaxed", "straight"],
      relaxedTailoring: ["relaxed", "tailored", "straight"],
      sheerLayering: ["soft", "relaxed", "straight"]
    }[direction] || [];
  }

  function canonicalPresentationResource(input, ruleSet) {
    const style = input.preference?.style;
    const styleOutput = (ruleSet.outfitOutputs || []).find((output) => (
      output.enabled !== false
      && (output.conditions || []).some((condition) => condition.field === "input.preference.style" && condition.value === style)
    ));
    const trendValue = input.preference?.trendDirection;
    const trend = (ruleSet.trendDirections || []).find((item) => item.enabled !== false && item.value === trendValue);
    return { styleOutput, trend };
  }

  function createCanonicalDecision(input, canonical, ruleSet) {
    const output = canonical.result;
    const canonicalInput = canonical.migration?.input || {};
    const canonicalTrace = output.trace || {};
    const goalPreferences = clone(canonicalTrace.goalPreferences || []);
    const boundaryActions = clone(canonicalTrace.boundaryActions || []);
    const presentation = canonicalPresentationResource(input, ruleSet);
    const style = input.preference?.style;
    const trendDirection = input.preference?.trendDirection;
    const trendIntensity = input.preference?.trendIntensity === "clear" ? "clear" : "light";
    const styleFamilies = canonicalStyleFamilies(style, output.garment?.silhouette);
    const trendFamilies = canonicalTrendFamilies(trendDirection);
    const family = trendFamilies.length && trendIntensity === "clear"
      ? [...trendFamilies, ...styleFamilies.filter((item) => !trendFamilies.includes(item))]
      : [...styleFamilies, ...trendFamilies.filter((item) => !styleFamilies.includes(item))];
    const occasionFormality = { daily: 1, commute: 2, formal: 4, social: 2, travel: 1 }[input.context?.occasion] || 1;
    const preferenceFormality = { relaxed: 1, commute: 2, formal: 4 }[input.preference?.formality] || 1;
    const necklineLabels = { vNeck: "V领", uNeck: "U领", boatNeck: "船领", squareNeck: "方领", crewNeck: "小圆领/立领" };
    const materialLabels = { lightweight: "轻薄", medium: "适中", heavy: "厚重" };
    const contrastLabels = { low: "低", medium: "中等", high: "高" };
    const waistValues = { raised: "raised", natural: "natural", relaxed: "relaxed" };
    const lineValues = { H: "balanced", A: "sectioned", X: "sectioned", Y: "continuous", O: "balanced", shortWideLongSlim: "continuous" };
    const styleNames = { minimal: "极简", urban: "都市", elegant: "优雅", casual: "休闲", street: "街头", retro: "复古", cityboy: "Cityboy" };
    const hardFields = {
      "boundaries.rejectSkirt": ["requirements.canonicalForm", "requirements.canonicalBottomCut", "requirements.canonicalDressCut"],
      "boundaries.rejectTight": ["requirements.canonicalTopFit", "requirements.canonicalBottomCut", "requirements.canonicalDressCut"],
      "boundaries.rejectDefinedWaist": ["requirements.waist", "requirements.silhouette"],
      "boundaries.rejectDeepNeck": ["requirements.neckline"],
      "boundaries.rejectHighContrast": ["requirements.colorContrast"],
      "boundaries.strictCoverage": ["requirements.coverage", "requirements.sleeve"],
      "boundaries.movementFriendly": ["requirements.movement"],
      "boundaries.sensitiveTexture": ["requirements.texture", "requirements.material"]
    };
    const locks = {};
    const trace = [];
    Object.entries(hardFields).forEach(([field, affected]) => {
      if (!canonicalInput[field]) return;
      affected.forEach((path) => { locks[path] = { ruleId: field, kind: "hard", priority: 1000 }; });
      const labels = {
        "boundaries.rejectSkirt": "拒绝裙装",
        "boundaries.rejectTight": "拒绝紧绷贴身",
        "boundaries.rejectDefinedWaist": "拒绝明显收腰",
        "boundaries.rejectDeepNeck": "拒绝低领开阔",
        "boundaries.rejectHighContrast": "拒绝高对比配色",
        "boundaries.strictCoverage": "要求完整覆盖",
        "boundaries.movementFriendly": "行动不能受限",
        "boundaries.sensitiveTexture": "避免粗糙触感"
      };
      const action = boundaryActions.find((item) => item.boundaryField === field);
      const status = action?.status || "satisfied";
      const rewritten = (action?.changes || []).filter((change) => change.status === "rewritten");
      const reason = status === "rewritten"
        ? `“${labels[field]}”已执行硬性改写：${rewritten.map((change) => `${change.field} 从 ${String(change.before ?? "未设置")} 调整为 ${String(change.after)}`).join("；")}。`
        : `基础结果已自然满足“${labels[field]}”，无需改写。`;
      trace.push({ stage: "hard", status, ruleId: field, name: labels[field], reason, actions: clone(action?.changes || []) });
    });

    const styleResult = presentation.styleOutput?.result || {};
    if (style) trace.push({ stage: "soft", status: "matched", ruleId: "canonical-style", name: `${styleNames[style] || "当前"}风格`, reason: presentation.styleOutput?.reason || "主风格用于排序服装路线，不覆盖身体和边界约束。", outputResult: { families: styleFamilies }, actions: [] });
    if (trendFamilies.length) trace.push({ stage: "soft", status: "matched", ruleId: "canonical-trend", name: presentation.trend?.name || "潮流方向", reason: presentation.trend?.reason || "潮流方向只调整服装细节和路线顺序。", outputResult: { families: trendFamilies }, actions: [] });
    const goalEndpointLabels = { vertical: "纵向比例", waist: "腰线表达", volume: "服装量感", contrast: "色彩对比" };
    const goalDirectionLabels = { keep: "保持", strengthen: "强化", weaken: "弱化", balance: "平衡" };
    const layeringLabels = { noPreference: "不限定", singleLayer: "单层优先", lightLayering: "轻度叠穿", pronouncedLayering: "明显叠穿" };
    const goalEndpoint = canonicalInput["goal.endpoint"] || null;
    const goalDirection = canonicalInput["goal.direction"] || "keep";
    const layeringPreference = canonicalInput["goal.layeringPreference"] || "noPreference";
    if (goalEndpoint || layeringPreference !== "noPreference") {
      const descriptions = [];
      if (goalEndpoint) descriptions.push(`${goalEndpointLabels[goalEndpoint] || goalEndpoint} · ${goalDirectionLabels[goalDirection] || goalDirection}`);
      if (layeringPreference !== "noPreference") descriptions.push(layeringLabels[layeringPreference] || layeringPreference);
      trace.push({
        stage: "soft",
        status: goalPreferences.length ? "matched" : "satisfied",
        ruleId: "canonical-goal",
        name: "本次调整目标",
        reason: `${descriptions.join("；")}作为软偏好参与候选排序，不覆盖场景骨架和穿着边界。`,
        actions: goalPreferences.map((item) => ({ field: item.outputField, type: "PREFER", value: item.value, status: "pending" }))
      });
    }

    return {
      canonicalPrimary: true,
      requirements: {
        layerCount: output.framework?.layerCount || 1,
        sleeve: output.framework?.sleeve || "threeQuarter",
        outer: output.framework?.outer || "none",
        coverage: canonicalInput["boundaries.strictCoverage"] ? "full" : null,
        material: materialLabels[output.framework?.materialWeight] || "适中",
        formalityMin: Math.max(occasionFormality, preferenceFormality),
        movement: Boolean(canonicalInput["boundaries.movementFriendly"]),
        waist: waistValues[output.garment?.waistline] || "natural",
        line: lineValues[output.garment?.silhouette] || "balanced",
        texture: canonicalInput["boundaries.sensitiveTexture"] ? "smooth" : "regular",
        colorTemperature: "按近脸安全色",
        colorContrast: contrastLabels[output.color?.contrastMode] || "中等",
        colorChroma: "按安全色谱",
        colorContrastMax: canonicalInput["boundaries.rejectHighContrast"] ? "中等" : "高",
        palettePlanId: null,
        neckline: necklineLabels[output.garment?.neckline] || "常规领口",
        faceEffect: `使用${necklineLabels[output.garment?.neckline] || "常规领口"}协调当前脸型轮廓。`,
        faceShape: input.face?.shape || null,
        canonicalForm: output.framework?.form || "separatesTrouser",
        canonicalTopFit: output.garment?.topFit || null,
        canonicalBottomCut: output.garment?.bottomCut || null,
        canonicalDressCut: output.garment?.dressCut || null,
        silhouette: output.garment?.silhouette || "H",
        styleName: styleNames[style] || "未限定风格",
        detail: presentation.trend?.result?.detail || styleResult.detail || "与主风格匹配的克制细节",
        pattern: presentation.trend?.result?.pattern || styleResult.pattern || "纯色或低存在感纹理",
        finish: presentation.trend?.result?.finish || styleResult.finish || "按场合保持整洁",
        trend: trendDirection || "none",
        trendName: presentation.trend?.name || "未指定潮流",
        trendIntensity: trendFamilies.length ? trendIntensity : null,
        trendReference: presentation.trend?.reference || null,
        proportion: presentation.trend?.result?.proportion || "按统一版型结果执行",
        detailIntensity: presentation.trend?.result?.detailIntensity || "适度使用",
        note: presentation.trend?.result?.note || "长期可穿",
        seasonVersion: presentation.trend?.season || "长期"
      },
      preferences: {
        family,
        styleFamilies,
        trendFamilies,
        trendIntensity,
        goalProfile: {
          endpoint: goalEndpoint,
          direction: goalDirection,
          layeringPreference,
          preferences: goalPreferences,
          resolved: {},
          blocked: []
        }
      },
      notes: [],
      forbidden: [],
      locks,
      trace,
      conflicts: [],
      decisionRecord: {
        baseline: clone(canonicalTrace.baseline || {}),
        goalPreferences,
        boundaryActions,
        finalOutput: clone({
          framework: output.framework,
          garment: output.garment,
          accessories: output.accessories,
          constraints: output.constraints,
          color: output.color
        })
      }
    };
  }

  function resolveCanonicalGoalPreferences(decision, ruleSet) {
    const profile = decision.preferences?.goalProfile;
    if (!profile) return;
    const requirements = decision.requirements;
    const boundaryActions = decision.decisionRecord?.boundaryActions || [];
    const isBlocked = (preference) => boundaryActions.some((action) => (
      (action.changes || []).some((change) => change.field === preference.outputField && Array.isArray(change.allowed) && !change.allowed.includes(preference.value))
    ));
    const contrastLabels = { low: "低", medium: "中等", high: "高" };

    profile.preferences.forEach((preference) => {
      if (isBlocked(preference)) {
        profile.blocked.push({ ...preference, reason: "与穿着边界冲突，保持边界结果。" });
        return;
      }
      profile.resolved[preference.outputField] = preference.value;
      if (preference.outputField === "garment.waistline") requirements.goalWaist = preference.value;
      if (preference.outputField === "garment.topFit") requirements.goalTopFit = preference.value;
      if (preference.outputField === "color.contrastMode") requirements.goalColorContrast = contrastLabels[preference.value] || preference.value;
      if (preference.outputField === "garment.silhouette") requirements.goalSilhouette = preference.value;
    });

    if (profile.endpoint === "vertical") {
      requirements.goalLine = profile.direction === "strengthen" ? "continuous" : profile.direction === "weaken" ? "balanced" : null;
    }
    if (requirements.goalColorContrast) {
      requirements.colorContrast = requirements.goalColorContrast;
      resolvePalettePlan(decision, ruleSet);
    }
    requirements.goalProfile = profile;
  }

  function applyOutfitOutputs(input, derived, state, ruleSet) {
    const context = { input, derived };
    const matched = (ruleSet.outfitOutputs || [])
      .filter((output) => output.enabled !== false)
      .filter((output) => ruleConditionsMatch(output, context));

    matched.forEach((output) => {
      const result = output.result || {};
      if (result.family) {
        const current = state.preferences.family || [];
        const styleFamilies = result.families || [result.family];
        state.preferences.family = [...styleFamilies, ...current.filter((value) => !styleFamilies.includes(value))];
        state.preferences.styleFamilies = styleFamilies;
        state.requirements.styleName = output.name.replace("服装搭配", "");
      }
      if (result.formality) {
        state.requirements.formalityMin = Math.max(Number(state.requirements.formalityMin || 1), Number(result.formality));
      }
      ["silhouette", "detail", "pattern", "finish", "trend", "proportion", "detailIntensity", "note", "seasonVersion"].forEach((field) => {
        if (isKnown(result[field])) state.requirements[field] = result[field];
      });
      state.trace.push({
        stage: "soft",
        status: "matched",
        ruleId: output.id,
        name: output.name,
        kind: "soft",
        priority: 520,
        reason: output.reason,
        analysis: output.analysis || null,
        group: output.group || "款式表达",
        conditions: clone(output.conditions || []),
        outputResult: clone(output.result || {}),
        actions: []
      });
    });
  }

  function applyTrendDirection(input, state, ruleSet) {
    const selectedValue = input.preference?.trendDirection;
    if (!selectedValue || selectedValue === "none") {
      state.requirements.trendName = "未指定潮流";
      state.requirements.trendIntensity = null;
      return;
    }

    const trend = (ruleSet.trendDirections || []).find((item) => (
      item.enabled !== false
      && item.value === selectedValue
      && ruleConditionsMatch(item, { input })
    ));
    if (!trend) {
      state.requirements.trendName = "潮流方向需确认";
      return;
    }

    const intensity = input.preference?.trendIntensity === "clear" ? "clear" : "light";
    const result = trend.result || {};
    const families = result.families || [];
    state.preferences.trendFamilies = clone(families);
    state.preferences.trendIntensity = intensity;
    state.preferences.family = [...families, ...(state.preferences.family || []).filter((item) => !families.includes(item))];
    state.requirements.trend = trend.value;
    state.requirements.trendName = trend.name;
    state.requirements.trendIntensity = intensity;
    state.requirements.trendReference = trend.reference || "运营配置";
    state.requirements.trendCoreIdea = trend.coreIdea || trend.reason;
    state.requirements.silhouette = result.silhouette || state.requirements.silhouette;
    state.requirements.detail = result.detail || state.requirements.detail;
    state.requirements.pattern = result.pattern || state.requirements.pattern;
    state.requirements.finish = result.finish || state.requirements.finish;
    state.requirements.proportion = `${intensity === "clear" ? "明确体现" : "少量借鉴"}：${result.proportion || "按潮流方向调整"}`;
    state.requirements.detailIntensity = intensity === "clear" ? `明确使用：${result.detailIntensity || "潮流细节"}` : `少量使用：${result.detailIntensity || "潮流细节"}`;
    state.requirements.note = result.note || trend.coreIdea;
    state.requirements.seasonVersion = trend.season || result.seasonVersion || "持续更新";

    state.trace.push({
      stage: "soft",
      status: "matched",
      ruleId: trend.id,
      name: trend.name,
      kind: "soft",
      priority: 515,
      reason: trend.reason,
      group: "潮流方向",
      conditions: clone(trend.conditions || []),
      outputResult: {
        families: clone(families),
        trendName: trend.name,
        silhouette: state.requirements.silhouette,
        proportion: state.requirements.proportion,
        detail: state.requirements.detail,
        finish: state.requirements.finish
      },
      actions: []
    });
  }

  function resolvePalettePlan(state, ruleSet) {
    const enabledPlans = ruleSet.palettePlans.filter((item) => item.enabled !== false);
    if (!enabledPlans.length) return;
    const requested = state.requirements;
    const temperatureOrder = ["冷", "中间偏冷", "中间", "中间偏暖", "暖"];
    const levelOrder = ["低", "中等", "高"];
    const distance = (order, first, second) => {
      const a = order.indexOf(first);
      const b = order.indexOf(second);
      return a < 0 || b < 0 ? 2 : Math.abs(a - b);
    };
    const allowedContrast = levelOrder.indexOf(requested.colorContrastMax);
    const eligible = enabledPlans.filter((plan) => {
      const planContrast = levelOrder.indexOf(plan.contrast);
      return allowedContrast < 0 || planContrast < 0 || planContrast <= allowedContrast;
    });
    const compatible = eligible.filter((plan) => (
      distance(temperatureOrder, plan.temperature, requested.colorTemperature) <= 1
      && distance(levelOrder, plan.contrast, requested.colorContrast) === 0
      && distance(levelOrder, plan.chroma, requested.colorChroma) === 0
    ));
    const pool = compatible.length ? compatible : eligible.length ? eligible : enabledPlans;
    const preferredId = requested.palettePlanId;
    const scored = pool.map((plan) => ({
      plan,
      score:
        distance(temperatureOrder, plan.temperature, requested.colorTemperature) * 4 +
        distance(levelOrder, plan.contrast, requested.colorContrast) * 2 +
        distance(levelOrder, plan.chroma, requested.colorChroma) -
        (plan.id === preferredId ? 2 : 0)
    })).sort((a, b) => a.score - b.score);
    const selected = scored[0]?.plan;
    if (!selected) return;
    if (preferredId && preferredId !== selected.id) {
      const previous = ruleSet.palettePlans.find((item) => item.id === preferredId);
      state.trace.push({
        stage: "soft",
        status: "rewritten",
        ruleId: "ENGINE-PALETTE-MATCH",
        name: "匹配可用配色方案",
        reason: `“${previous?.name || preferredId}”与当前配色对比或彩度不完全一致，改用“${selected.name}”。`
      });
    }
    requested.palettePlanId = selected.id;
    requested.palettePlanName = selected.name;
    requested.palettePlanIds = scored.slice(0, 3).map((item) => item.plan.id);
  }

  function enforceDerivedLimits(state) {
    const contrastOrder = ["低", "中等", "高"];
    const currentIndex = contrastOrder.indexOf(state.requirements.colorContrast);
    const maxIndex = contrastOrder.indexOf(state.requirements.colorContrastMax);
    if (currentIndex > maxIndex && maxIndex >= 0) {
      const before = state.requirements.colorContrast;
      state.requirements.colorContrast = state.requirements.colorContrastMax;
      state.trace.push({
        stage: "hard",
        status: "rewritten",
        ruleId: "ENGINE-CONTRAST-LIMIT",
        name: "执行配色对比上限",
        reason: `服装对比由${before}改为${state.requirements.colorContrastMax}，以满足明确拒绝。`
      });
    }
  }

  function requirementMaterialClass(value) {
    const text = String(value || "");
    if (/保暖|御寒|厚重/.test(text)) return "warm";
    if (/轻|薄|透气/.test(text)) return "light";
    return "regular";
  }

  function componentMatches(component, family, requirements, forbidden, category, locks = {}) {
    if (!component.enabled || component.category !== category) return false;
    const attributes = component.attributes || {};
    if (category === "top" && attributes.sleeve !== requirements.sleeve) return false;
    if (category === "dress" && attributes.sleeve !== requirements.sleeve) return false;
    if (category === "outer" && attributes.outerKind !== requirements.outer) return false;
    if (category === "bottom" && requirements.canonicalForm === "separatesTrouser" && attributes.bottomType !== "trouser") return false;
    if (category === "bottom" && requirements.canonicalForm === "separatesSkirt" && attributes.bottomType !== "skirt") return false;
    if (category === "bottom" && requirements.coverage && attributes.coverage !== requirements.coverage) return false;
    if (!(category === "outer" && attributes.outerKind === "none") && Number(attributes.formality || 0) < Number(requirements.formalityMin || 0)) return false;
    if (requirements.movement && !attributes.movement) return false;
    if (family && attributes.family !== family && !(category === "outer" && attributes.outerKind === "none")) return false;

    const materialClass = requirementMaterialClass(requirements.material);
    if (materialClass === "light" && attributes.materialClass === "warm") return false;
    if (locks["requirements.texture"] && requirements.texture === "smooth" && attributes.texture === "rough") return false;
    if (locks["requirements.waist"] && requirements.waist && ["bottom", "dress"].includes(category) && attributes.waistPosition !== requirements.waist) return false;
    if (locks["requirements.coverage"] && category === "bottom" && Number(attributes.coverageRank || 0) < Number({ light: 0, regular: 1, full: 2 }[requirements.coverage] ?? 1)) return false;

    const candidateShape = category === "bottom" ? { bottomType: attributes.bottomType } : {};
    return !forbidden.some((item) => {
      if (item.field === `candidate.${category}Id`) return component.id === item.value;
      if (item.field === "candidate.bottomType") return candidateShape.bottomType === item.value;
      return false;
    });
  }

  function componentScore(component, requirements, category) {
    const attributes = component.attributes || {};
    let score = 0;
    if (["bottom", "dress"].includes(category) && requirements.waist && attributes.waistPosition === requirements.waist) score += 8;
    if (requirements.line && attributes.lineDirection === requirements.line) score += 5;
    if (["top", "dress"].includes(category) && requirements.neckline && attributes.neckline === requirements.neckline) score += 5;
    if (category === "top" && requirements.canonicalTopFit && attributes.topFit === requirements.canonicalTopFit) score += 12;
    if (category === "top" && requirements.goalTopFit && attributes.topFit === requirements.goalTopFit) score += 6;
    if (category === "dress" && requirements.goalTopFit && attributes.topFit === requirements.goalTopFit) score += 4;
    if (["bottom", "dress"].includes(category) && requirements.goalWaist && attributes.waistPosition === requirements.goalWaist) score += 6;
    if (requirements.goalLine && attributes.lineDirection === requirements.goalLine) score += 4;
    if (category === "bottom" && requirements.canonicalBottomCut && attributes.bottomCut === requirements.canonicalBottomCut) score += 12;
    if (category === "dress" && requirements.canonicalDressCut && attributes.dressCut === requirements.canonicalDressCut) score += 16;
    if (requirements.texture && attributes.texture === requirements.texture) score += 2;
    if (requirements.material && requirementMaterialClass(requirements.material) === attributes.materialClass) score += 1;
    return score;
  }

  function chooseComponent(components, family, requirements, forbidden, category, strictFamily, locks) {
    const eligible = components
      .filter((item) => componentMatches(item, family, requirements, forbidden, category, locks))
      .sort((a, b) => componentScore(b, requirements, category) - componentScore(a, requirements, category));
    const exact = eligible[0];
    if (exact) return exact;
    if (strictFamily) return null;
    return components
      .filter((item) => componentMatches(item, null, requirements, forbidden, category, locks))
      .sort((a, b) => componentScore(b, requirements, category) - componentScore(a, requirements, category))[0] || null;
  }

  function candidateBlocked(candidate, forbidden) {
    return forbidden.find((item) => {
      const actual = getByPath({ candidate }, item.field);
      return actual === item.value;
    });
  }

  function canonicalFamilyScore(family, requirements) {
    const fitFamilies = {
      fitted: ["tailored"],
      regular: ["straight", "soft", "retro"],
      oversized: ["relaxed", "street"]
    };
    const cutFamilies = {
      straightLeg: ["straight", "soft", "retro"],
      wideLeg: ["relaxed", "street"],
      tapered: ["tailored"],
      aLineSkirt: ["soft", "retro"],
      straightSkirt: ["straight", "tailored"]
    };
    let score = 0;
    if ((fitFamilies[requirements.canonicalTopFit] || []).includes(family)) score += 2;
    if ((cutFamilies[requirements.canonicalBottomCut] || []).includes(family)) score += 3;
    const goal = requirements.goalProfile || {};
    if (goal.endpoint === "vertical" && goal.direction === "strengthen" && ["straight", "tailored"].includes(family)) score += 3;
    if (goal.endpoint === "vertical" && goal.direction === "weaken" && ["soft", "relaxed"].includes(family)) score += 2;
    if (goal.endpoint === "waist" && goal.direction === "strengthen" && ["tailored", "soft", "retro"].includes(family)) score += 3;
    if (goal.endpoint === "waist" && goal.direction === "weaken" && ["relaxed", "straight"].includes(family)) score += 3;
    if (goal.endpoint === "volume" && goal.direction === "strengthen" && ["relaxed", "street"].includes(family)) score += 3;
    if (goal.endpoint === "volume" && goal.direction === "weaken" && ["straight", "tailored"].includes(family)) score += 3;
    if (goal.layeringPreference === "singleLayer" && ["straight", "tailored"].includes(family)) score += 2;
    if (goal.layeringPreference === "lightLayering" && ["soft", "straight"].includes(family)) score += 2;
    if (goal.layeringPreference === "pronouncedLayering" && ["relaxed", "street"].includes(family)) score += 3;
    return score;
  }

  function materializeCanonicalComponent(component, category, requirements) {
    if (!component || !requirements) return component;
    const adapted = clone(component);
    const attributes = adapted.attributes ||= {};
    const familyLabel = {
      straight: "简洁",
      soft: "柔和",
      relaxed: "松弛",
      tailored: "利落",
      street: "街头",
      retro: "复古"
    }[attributes.family] || "日常";
    const sleeveLabelText = { long: "长袖", threeQuarter: "七分袖", short: "短袖" }[requirements.sleeve] || "";
    const necklineLabelText = {
      "开阔领口": "开阔领",
      "柔和开阔领口": "船形领",
      "常规领口": "小圆领"
    }[requirements.neckline] || "常规领";

    if (category === "top") {
      const fit = requirements.goalTopFit || requirements.canonicalTopFit || attributes.topFit || "regular";
      attributes.topFit = fit;
      attributes.neckline = requirements.neckline || attributes.neckline;
      if (requirements.goalLine) attributes.lineDirection = requirements.goalLine;
      const fitLabel = { fitted: "合体版", regular: "常规版", oversized: "宽松版" }[fit] || "常规版";
      adapted.name = `${familyLabel}${fitLabel}${sleeveLabelText}${necklineLabelText}上衣`;
    }

    if (category === "bottom") {
      const cut = requirements.canonicalBottomCut || attributes.bottomCut;
      if (cut) attributes.bottomCut = cut;
      if (requirements.goalWaist || requirements.waist) attributes.waistPosition = requirements.goalWaist || requirements.waist;
      if (requirements.goalLine) attributes.lineDirection = requirements.goalLine;
      const waistLabel = { raised: "偏高腰", natural: "自然腰", relaxed: "松弛腰" }[attributes.waistPosition] || "自然腰";
      const cutLabel = {
        straightLeg: "直筒长裤",
        wideLeg: "阔腿长裤",
        tapered: "锥形长裤",
        aLineSkirt: "A字中长裙",
        straightSkirt: "直筒中长裙"
      }[cut] || adapted.name;
      adapted.name = `${familyLabel}${waistLabel}${cutLabel}`;
    }

    if (category === "dress") {
      const cut = requirements.canonicalDressCut || attributes.dressCut;
      if (cut) attributes.dressCut = cut;
      if (requirements.goalWaist || requirements.waist) attributes.waistPosition = requirements.goalWaist || requirements.waist;
      if (requirements.goalLine) attributes.lineDirection = requirements.goalLine;
      attributes.neckline = requirements.neckline || attributes.neckline;
      const waistLabel = { raised: "偏高腰", natural: "自然腰", relaxed: "松弛腰" }[attributes.waistPosition] || "自然腰";
      const cutLabel = {
        aLineMidi: "A字中长连衣裙",
        shirtDress: "衬衫连衣裙",
        wrapDress: "裹身连衣裙",
        columnDress: "直筒连衣裙"
      }[cut] || "连衣裙";
      adapted.name = `${familyLabel}${sleeveLabelText}${waistLabel}${necklineLabelText}${cutLabel}`;
    }

    return adapted;
  }

  function assessCandidateGoal(candidate, decision) {
    const profile = decision.preferences?.goalProfile;
    if (!profile || (!profile.endpoint && profile.layeringPreference === "noPreference")) return { status: "未设置目标", score: 0, items: [] };
    const items = [];
    const expected = [];
    const add = (label, pass, detail, blocked = false) => {
      expected.push(pass);
      items.push({ label, status: blocked ? "受边界限制" : pass ? "已落实" : "未采用", detail });
    };
    const resolved = profile.resolved || {};
    const blocked = profile.blocked || [];
    const isBlocked = (field) => blocked.some((item) => item.outputField === field);
    if (profile.endpoint === "vertical") {
      const wanted = profile.direction === "strengthen" ? "continuous" : profile.direction === "weaken" ? "balanced" : null;
      if (wanted) add("纵向比例", candidate.line === wanted || candidate.line === (wanted === "continuous" ? "连续直线" : "稳定平衡"), "候选线条为：" + candidate.line + (isBlocked("garment.waistline") ? "，腰位偏好受边界限制" : ""), isBlocked("garment.waistline"));
    }
    if (profile.endpoint === "waist") {
      const wanted = resolved["garment.waistline"] || (profile.direction === "strengthen" ? "natural" : profile.direction === "weaken" ? "relaxed" : null);
      if (wanted) add("腰线表达", candidate.waist === wanted, "候选腰线为：" + candidate.waist, isBlocked("garment.waistline"));
    }
    if (profile.endpoint === "volume") {
      const wanted = resolved["garment.topFit"];
      if (wanted) add("服装量感", candidate.topFit === wanted || (wanted === "regular" && candidate.topFit === "合体"), "候选上装留量为：" + (candidate.topFit || "一件式裙型"), isBlocked("garment.topFit"));
    }
    if (profile.endpoint === "contrast") {
      const wanted = resolved["color.contrastMode"] || ({ strengthen: "高", weaken: "低", balance: "中等" }[profile.direction]);
      if (wanted) add("色彩对比", candidate.colorContrast === wanted, "候选对比为：" + candidate.colorContrast, isBlocked("color.contrastMode"));
    }
    if (profile.layeringPreference !== "noPreference") {
      const physicalLayer = Number(candidate.layerCount || 1);
      const thermalException = profile.layeringPreference === "singleLayer" && physicalLayer > 1;
      const pass = profile.layeringPreference === "singleLayer" ? !thermalException : profile.layeringPreference === "lightLayering" ? candidate.garments.outer === "无外层" || physicalLayer >= 2 : physicalLayer >= 2;
      add("叠穿倾向", pass, thermalException ? "低温骨架要求保留必要外层，未删除物理层数" : "当前为" + physicalLayer + "层，按倾向组织外层与留量");
    }
    const score = expected.filter(Boolean).length;
    const blockedCount = items.filter((item) => item.status === "受边界限制").length;
    const status = !expected.length ? "已记录" : score === expected.length ? "完全满足" : score ? "部分满足" : blockedCount ? "受边界限制" : "未采用";
    return { status, score, total: expected.length, items };
  }

  function assembleCandidates(input, derived, decision, ruleSet) {
    if (decision.conflicts.length) return { candidates: [], blocked: [], conflicts: decision.conflicts };

    const defaultFamilies = ["straight", "soft", "relaxed", "tailored"];
    const preferred = decision.preferences.family || [];
    const styleFamilies = decision.preferences.styleFamilies?.length ? decision.preferences.styleFamilies : defaultFamilies;
    const trendFamilies = decision.preferences.trendFamilies || [];
    const trendIntensity = decision.preferences.trendIntensity;
    const sharedFamilies = trendFamilies.filter((family) => styleFamilies.includes(family));
    const allowedFamilies = trendFamilies.length
      ? trendIntensity === "clear"
        ? [...trendFamilies, ...styleFamilies.filter((family) => !trendFamilies.includes(family))]
        : [...sharedFamilies, ...styleFamilies.filter((family) => !sharedFamilies.includes(family)), ...trendFamilies.filter((family) => !styleFamilies.includes(family))]
      : styleFamilies;
    const strictStyle = Boolean(decision.preferences.styleFamilies?.length || trendFamilies.length);
    const baseFamilyOrder = [...preferred.filter((family) => allowedFamilies.includes(family)), ...allowedFamilies.filter((family) => !preferred.includes(family))];
    const familyOrder = baseFamilyOrder
      .map((family, index) => ({ family, index, score: trendIntensity === "clear" ? 0 : canonicalFamilyScore(family, decision.requirements) }))
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .map((item) => item.family);
    const candidates = [];
    const blocked = [];
    const onePiece = decision.requirements.canonicalForm === "onePieceDress";

    familyOrder.forEach((family) => {
      const outer = chooseComponent(ruleSet.components, family, decision.requirements, decision.forbidden, "outer", strictStyle, decision.locks);
      const top = onePiece ? null : chooseComponent(ruleSet.components, family, decision.requirements, decision.forbidden, "top", strictStyle, decision.locks);
      const bottom = onePiece ? null : chooseComponent(ruleSet.components, family, decision.requirements, decision.forbidden, "bottom", strictStyle, decision.locks);
      const dress = onePiece ? chooseComponent(ruleSet.components, family, decision.requirements, decision.forbidden, "dress", strictStyle, decision.locks) : null;
      if (!outer || (onePiece ? !dress : !top || !bottom)) {
        blocked.push({ family, reason: onePiece ? "没有找到同时满足裙型、袖长、正式度和边界的一件式组合。" : "没有找到同时满足袖长、覆盖、正式度和边界的完整组合。" });
        return;
      }

      const canonicalTop = materializeCanonicalComponent(top, "top", decision.requirements);
      const canonicalBottom = materializeCanonicalComponent(bottom, "bottom", decision.requirements);
      const canonicalDress = materializeCanonicalComponent(dress, "dress", decision.requirements);
      const paletteIds = decision.requirements.palettePlanIds || [decision.requirements.palettePlanId];
      const palettePlanId = paletteIds[candidates.length % Math.max(paletteIds.length, 1)] || decision.requirements.palettePlanId;
      const candidate = createCandidate({ family, top: canonicalTop, outer, bottom: canonicalBottom, dress: canonicalDress, input, derived, decision, ruleSet, palettePlanId });
      const blocker = candidateBlocked(candidate, decision.forbidden);
      if (blocker) {
        blocked.push({ family, reason: blocker.reason, ruleId: blocker.ruleId });
        return;
      }

      if (!candidates.some((item) => candidateSignature(item) === candidateSignature(candidate))) {
        candidates.push(candidate);
      }
    });

    const selected = [];
    candidates.forEach((candidate) => {
      if (!selected.length || selected.every((existing) => meaningfulDifference(existing, candidate).length >= 2)) {
        selected.push(candidate);
      }
    });

    if (selected.length < 2) {
      candidates.forEach((candidate) => {
        if (!selected.includes(candidate) && selected.length < 3) selected.push(candidate);
      });
    }

    return { candidates: selected.slice(0, 3), blocked, conflicts: [] };
  }

  function resolveClassicPattern(ruleSet, style, family, onePiece) {
    const matches = (ruleSet.patternLibrary || []).filter((pattern) => (pattern.styles || []).includes(style));
    if (!matches.length) return null;
    const familyOrder = ["straight", "tailored", "soft", "relaxed", "street", "retro"];
    const pattern = matches[Math.max(0, familyOrder.indexOf(family)) % matches.length];
    return {
      id: pattern.id,
      name: pattern.name,
      placement: onePiece ? "连身裙" : pattern.placement,
      scale: pattern.scale,
      contrast: pattern.contrast
    };
  }

  function createCandidate({ family, top, outer, bottom, dress, input, derived, decision, ruleSet, palettePlanId }) {
    const familyMeta = {
      straight: { line: "连续直线", focus: "保持纵向连贯" },
      soft: { line: "柔和曲线", focus: "降低结构边界" },
      relaxed: { line: "自然放松", focus: "保留活动余量" },
      tailored: { line: "清晰结构", focus: "提高完成度" },
      street: { line: "宽松箱型", focus: "建立层次和款式重点" },
      retro: { line: "复古收放", focus: "保留领型与比例特征" }
    }[family] || { line: "自然线条", focus: "保持整体平衡" };
    const hardRules = decision.trace.filter((item) => item.stage === "hard" && ["matched", "rewritten", "partial"].includes(item.status));
    const softRules = decision.trace.filter((item) => item.stage === "soft" && ["matched", "rewritten", "partial"].includes(item.status));
    const outerName = outer.attributes.outerKind === "none" ? "无外层" : outer.name;
    const bodyComponent = dress || bottom;
    const waist = bodyComponent.attributes.waistPosition || decision.requirements.waist || "natural";
    const line = decision.requirements.goalLine || decision.requirements.line || bodyComponent.attributes.lineDirection || familyMeta.line;
    const unknownColor = decision.canonicalPrimary
      ? !decision.canonicalColor
      : [derived.color?.temperature, derived.color?.contrast, derived.color?.chroma].some((item) => !item || item.value === null);
    const palette = resolvePalette(ruleSet, palettePlanId || decision.requirements.palettePlanId);
    const boundPalette = bindPaletteToGarments(palette, outer.attributes.outerKind, Boolean(dress));
    const nameParts = [dress?.name || top?.name, outer.attributes.outerKind === "none" ? null : outer.name, dress ? null : bottom?.name].filter(Boolean);
    const components = [dress || top, outer.attributes.outerKind === "none" ? null : outer, dress ? null : bottom].filter(Boolean).map((component) => clone(component));
    const patternDetail = resolveClassicPattern(ruleSet, input.preference?.style, family, Boolean(dress));
    const relevantRule = (trace) => {
      const familyValues = [
        ...(trace.actions || []).filter((action) => action.field === "preferences.family" && ["ADD", "BOOST"].includes(action.type)).map((action) => action.value),
        ...(trace.outputResult?.families || []),
        ...(trace.outputResult?.family ? [trace.outputResult.family] : [])
      ];
      return !familyValues.length || familyValues.includes(family);
    };
    const hardRequirements = hardRules.map((item) => ({ ruleId: item.ruleId, name: item.name, text: item.reason, summary: item.reason, detail: item.reason }));
    const softReasons = softRules.filter(relevantRule).map((item) => ({ ruleId: item.ruleId, name: item.name, text: item.reason }));
    if (palette) softReasons.push({ ruleId: palette.id, name: palette.name, text: `配色采用“${palette.name}”：${palette.reason}` });
    const unverified = [
      { item: "具体商品的尺码与纸样", affectsPlan: true, validation: "核对成衣肩、胸、腰、臀和关键长度，并试穿确认活动量。", failure: "关键部位尺寸不足、衣长落点偏离或动作受限。" },
      { item: "面料厚度、织法与垂坠度", affectsPlan: false, validation: `确认商品能实现“${decision.requirements.material}”且不过度蓬胀。`, failure: "实际面料过厚、过硬或蓬胀，改变了当前轮廓。" },
      ...(palette ? [{ item: `配色方案“${palette.name}”的实物呈现`, affectsPlan: false, validation: palette.validation || "在自然光下核对近脸色、主色和辅助色。", failure: "实物色温、明度或彩度偏离当前配色方向。" }] : []),
      ...(unknownColor ? [{ item: "外观色彩事实不完整", affectsPlan: false, validation: "在自然光下确认肤色底调、肤色明度、发色色调和发色深浅。", failure: "近脸颜色让肤色明显发灰或整体对比与本人不协调。" }] : [])
    ].map((item) => ({ ...item, field: item.item, impact: item.affectsPlan, howToVerify: item.validation, failureCondition: item.failure }));

    const candidate = {
      id: `CANDIDATE-${family.toUpperCase()}`,
      title: nameParts.join(" + "),
      name: nameParts.join(" + "),
      family,
      form: dress ? "onePieceDress" : decision.requirements.canonicalForm,
      topId: top?.id || null,
      outerId: outer.id,
      bottomId: bottom?.id || null,
      dressId: dress?.id || null,
      bottomType: dress ? "dress" : bottom.attributes.bottomType,
      topFit: top?.attributes?.topFit || null,
      bottomCut: bottom?.attributes?.bottomCut || null,
      dressCut: dress?.attributes?.dressCut || null,
      garments: { top: top?.name || null, outer: outerName, bottom: bottom?.name || null, dress: dress?.name || null },
      components,
      layerCount: decision.requirements.layerCount,
      sleeve: decision.requirements.sleeve,
      coverage: decision.requirements.coverage,
      material: decision.requirements.material,
      texture: decision.requirements.texture,
      waist,
      line,
      colorTemperature: decision.requirements.colorTemperature,
      colorContrast: decision.requirements.colorContrast,
      colorChroma: decision.requirements.colorChroma,
      palettePlanId: palette?.id || null,
      palette: boundPalette,
      illustration: buildIllustration(top, outer, bottom, dress, decision, boundPalette, family, {
        patternDetail,
        accessories: decision.canonicalAccessories || {}
      }),
      styleName: decision.requirements.styleName || "未限定风格",
      silhouette: decision.requirements.silhouette || familyMeta.line,
      detail: decision.requirements.detail || "与风格匹配的细节",
      neckline: decision.requirements.neckline || "常规领口",
      faceEffect: decision.requirements.faceEffect || "脸型待确认",
      pattern: decision.requirements.pattern || "低存在感纹理",
      patternDetail,
      finish: decision.requirements.finish || "按场合保持整洁",
      trend: decision.requirements.trend || "none",
      trendName: decision.requirements.trendName || "未指定潮流",
      trendIntensity: decision.requirements.trendIntensity || null,
      trendReference: decision.requirements.trendReference || null,
      trendProportion: decision.requirements.proportion || "常规比例",
      detailIntensity: decision.requirements.detailIntensity || "低细节强度",
      trendNote: decision.requirements.note || "长期可穿",
      seasonVersion: decision.requirements.seasonVersion || "长期",
      focus: familyMeta.focus,
      expectedEffect: buildExpectedEffect(decision.requirements, palette),
      hardRequirementsMet: hardRequirements,
      hardRequirements,
      softReasons,
      implementations: softReasons.map((item) => ({ relationName: item.name, actionSummary: item.text })),
      unverified,
      traceRuleIds: [...hardRules, ...softRules.filter(relevantRule)].map((item) => item.ruleId)
    };
    candidate.goalAssessment = assessCandidateGoal(candidate, decision);
    candidate.decisionRecord = {
      goalStatus: candidate.goalAssessment.status,
      goalItems: candidate.goalAssessment.items,
      boundaryActions: clone(decision.decisionRecord?.boundaryActions || [])
    };
    return candidate;
  }

  function resolvePalette(ruleSet, palettePlanId) {
    const plan = ruleSet.palettePlans.find((item) => item.id === palettePlanId && item.enabled !== false);
    if (!plan) return null;
    const colors = new Map(ruleSet.colorLibrary.map((item) => [item.id, item]));
    return {
      id: plan.id,
      name: plan.name,
      temperature: plan.temperature,
      contrast: plan.contrast,
      chroma: plan.chroma,
      reason: plan.reason,
      validation: plan.validation,
      roles: (plan.roles || []).map((item) => {
        const color = colors.get(item.colorId) || null;
        return {
          ...item,
          color,
          colorName: color?.name || "待确认",
          hex: color?.hex || null
        };
      })
    };
  }

  function bindPaletteToGarments(palette, outerKind, onePiece = false) {
    if (!palette) return null;
    const roles = palette.roles || [];
    const byRole = (role) => roles.find((item) => item.role === role) || null;
    const nearFace = byRole("nearFace") || roles[0] || null;
    const main = byRole("main") || nearFace;
    const secondary = byRole("secondary") || byRole("accent") || main;
    const accent = byRole("accent") || secondary || main;
    const visibleOuter = outerKind !== "none";
    const assignments = onePiece
      ? [
        { id: "dress", layerKind: "dress", role: main ? main.role : null, color: main },
        ...(visibleOuter ? [{ id: "outer", layerKind: "outer", role: (byRole("secondary") || accent)?.role || null, color: byRole("secondary") || accent }] : []),
        { id: "accent", layerKind: "accessory", role: accent?.role || null, color: accent }
      ]
      : [
        { id: "top", layerKind: "top", role: nearFace?.role || null, color: nearFace },
        ...(visibleOuter ? [{ id: "outer", layerKind: "outer", role: secondary?.role || null, color: secondary }] : []),
        { id: "bottom", layerKind: "bottom", role: main?.role || null, color: main },
        { id: "accent", layerKind: "accessory", role: accent?.role || null, color: accent }
      ];
    const regions = assignments.map((assignment) => ({
      id: assignment.id,
      layerKind: assignment.layerKind,
      role: assignment.role,
      colorId: assignment.color?.color?.id || assignment.color?.colorId || null,
      colorName: assignment.color?.colorName || "基础色",
      hex: assignment.color?.hex || null,
      ratio: Number(assignment.color?.ratio || 0),
      source: assignment.color ? "palette-role" : "unresolved"
    }));
    const unresolved = regions.filter((region) => !region.hex).map((region) => region.id);
    const assignedRegionIds = new Map();
    regions.forEach((region) => {
      if (region.layerKind !== "accessory") assignedRegionIds.set(region.layerKind, region.id);
    });
    const boundRoles = roles.map((item) => ({
      ...item,
      garment: onePiece
        ? item.role === "main" ? "连身裙" : item.role === "secondary" && visibleOuter ? "外层" : item.role === "nearFace" ? "近脸区域" : "点缀"
        : item.role === "nearFace" ? "上装" : item.role === "main" ? "下装" : item.role === "secondary" && visibleOuter ? "外层" : "点缀"
    }));
    return {
      ...palette,
      roles: boundRoles,
      regions,
      mapping: {
        complete: unresolved.length === 0,
        unresolved,
        ratioTotal: regions.filter((region) => region.layerKind !== "accessory").reduce((sum, region) => sum + region.ratio, 0),
        assignedRegionIds: Object.fromEntries(assignedRegionIds)
      }
    };
  }

  function buildIllustration(top, outer, bottom, dress, decision, palette, family, options = {}) {
    const outerKind = outer?.attributes?.outerKind || "none";
    const bottomType = dress ? "dress" : bottom?.attributes?.bottomType || "trouser";
    const regions = palette?.regions || [];
    const regionFor = (id) => {
      const region = regions.find((item) => item.id === id);
      return {
        hex: region?.hex || null,
        colorName: region?.colorName || "待确认",
        ratio: region?.ratio || 0,
        source: region?.source || "unresolved"
      };
    };
    const topColor = dress ? regionFor("dress") : regionFor("top");
    const outerColor = regionFor("outer");
    const bottomColor = dress ? topColor : regionFor("bottom");
    const bodyComponent = dress || bottom;
    const requestedPatternTarget = options.patternDetail?.placement === "外层" ? "outer" : options.patternDetail?.placement === "下装" ? "bottom" : options.patternDetail?.placement === "连身裙" ? "dress" : "top";
    const patternTarget = requestedPatternTarget === "outer" && outerKind === "none"
      ? (dress ? "dress" : "bottom")
      : requestedPatternTarget;
    const pattern = options.patternDetail ? {
      ...options.patternDetail,
      requestedTarget: requestedPatternTarget,
      target: patternTarget,
      renderMode: "repeat"
    } : null;
    const canonicalAccessories = options.accessories || {};
    const accessories = [
      { kind: "footwear", key: canonicalAccessories.footwear || null, required: true, visible: Boolean(canonicalAccessories.footwear), region: "accent" },
      { kind: "bag", key: canonicalAccessories.leatherGoods || null, required: false, visible: Boolean(canonicalAccessories.leatherGoods && canonicalAccessories.leatherGoods !== "none"), region: "accent" },
      { kind: "jewelry", key: canonicalAccessories.jewelry || null, required: false, visible: Boolean(canonicalAccessories.jewelry), region: "accent" },
      { kind: "textile", key: canonicalAccessories.textile || null, required: false, visible: Boolean(canonicalAccessories.textile && canonicalAccessories.textile !== "none"), region: "accent" }
    ];
    const geometry = {
      top: top?.attributes || null,
      outer: outer?.attributes || null,
      bottom: bottom?.attributes || null,
      dress: dress?.attributes || null
    };
    const validation = {
      colorComplete: Boolean(palette?.mapping?.complete),
      paletteRatioTotal: palette?.mapping?.ratioTotal || 0,
      warnings: palette?.mapping?.unresolved?.length ? ["部分颜色未能从配色方案解析"] : []
    };
    return {
      type: "outfit-schematic",
      form: dress ? "onePieceDress" : decision.requirements.canonicalForm,
      layerCount: decision.requirements.layerCount || 1,
      silhouette: decision.requirements.silhouette || family || "straight",
      waist: decision.requirements.waist || bodyComponent?.attributes?.waistPosition || "natural",
      line: decision.requirements.line || bodyComponent?.attributes?.lineDirection || "balanced",
      neckline: decision.requirements.neckline || (dress || top)?.attributes?.neckline || "regular",
      colorMap: {
        regions,
        ratioTotal: validation.paletteRatioTotal,
        complete: validation.colorComplete
      },
      pattern,
      accessories,
      geometry,
      validation,
      layers: [
        dress
          ? {
            id: "dress", kind: "dress", type: "dress", dressCut: dress.attributes.dressCut, visible: true,
            sleeve: decision.requirements.sleeve || dress.attributes.sleeve || "regular",
            color: topColor.hex, colorName: topColor.colorName, ratio: topColor.ratio, attributes: dress.attributes
          }
          : {
            id: "top", kind: "top", type: "top", visible: true,
            sleeve: decision.requirements.sleeve || top?.attributes?.sleeve || "regular",
            color: topColor.hex, colorName: topColor.colorName, ratio: topColor.ratio, attributes: top?.attributes || {}
          },
        {
          id: "outer", kind: "outer", type: outerKind, visible: outerKind !== "none",
          length: outer?.attributes?.length || (outerKind === "warm" ? "long" : "short"),
          color: outerColor.hex, colorName: outerColor.colorName, ratio: outerColor.ratio, attributes: outer?.attributes || {}
        },
        dress ? null : {
          id: "bottom", kind: "bottom", type: bottomType, bottomType, visible: true,
          coverage: decision.requirements.coverage || bottom?.attributes?.coverage || "regular",
          color: bottomColor.hex, colorName: bottomColor.colorName, ratio: bottomColor.ratio, attributes: bottom?.attributes || {}
        }
      ].filter(Boolean)
    };
  }

  function buildExpectedEffect(requirements, palette) {
    const parts = [
      `${requirements.styleName || "当前"}方向以${requirements.silhouette || "当前轮廓"}为主`,
      requirements.trendName && requirements.trendName !== "未指定潮流"
        ? `${requirements.trendName}以“${requirements.proportion || "当前比例"}”和“${requirements.detailIntensity || "适中细节"}”参与款式表达`
        : `${requirements.proportion || "常规比例"}与${requirements.detailIntensity || "适中细节"}共同决定款式表达`,
      `${requirements.neckline || "常规领口"}${requirements.faceEffect ? `，${requirements.faceEffect}` : ""}`,
      palette ? `${palette.name}形成${palette.temperature}、${palette.contrast}明度对比和${palette.chroma}彩度的颜色关系` : "配色仍需确认"
    ];
    return parts.join("；") + "。";
  }

  function candidateSignature(candidate) {
    return [candidate.form, candidate.topId, candidate.outerId, candidate.bottomId, candidate.dressId, candidate.waist, candidate.line, candidate.colorContrast].join("|");
  }

  function meaningfulDifference(first, second) {
    const fields = [
      ["上装", "topId"],
      ["外层", "outerId"],
      ["下装", "bottomId"],
      ["连身裙", "dressId"],
      ["下装类型", "bottomType"],
      ["上装松紧", "topFit"],
      ["下装版型", "bottomCut"],
      ["连身裙型", "dressCut"],
      ["腰线", "waist"],
      ["线条", "line"],
      ["色彩对比", "colorContrast"],
      ["配色", "palettePlanId"],
      ["材质", "material"]
    ];
    return fields.filter(([, field]) => first[field] !== second[field]).map(([label]) => label);
  }

  function diffResults(previous, next) {
    if (!previous) return [];
    const fields = [
      ["层数", "requirements.layerCount", (value) => `${value} 层`],
      ["袖长", "requirements.sleeve", sleeveLabel],
      ["外层", "requirements.outer", outerLabel],
      ["覆盖", "requirements.coverage", coverageLabel],
      ["材质", "requirements.material", String],
      ["正式度", "requirements.formalityMin", formalityLabel],
      ["腰线", "requirements.waist", waistLabel],
      ["线条", "requirements.line", lineLabel],
      ["服装色温", "requirements.colorTemperature", String],
      ["配色对比", "requirements.colorContrast", String],
      ["服装彩度", "requirements.colorChroma", String],
      ["配色方案", "requirements.palettePlanName", (value) => value || "需验证"],
      ["服装风格", "requirements.styleName", (value) => value || "未限定"],
      ["服装轮廓", "requirements.silhouette", (value) => value || "需验证"],
      ["潮流比例", "requirements.proportion", (value) => value || "需验证"],
      ["细节强度", "requirements.detailIntensity", (value) => value || "需验证"],
      ["领口方向", "requirements.neckline", (value) => value || "需验证"]
    ];
    return fields.flatMap(([label, path, formatter]) => {
      const before = getByPath(previous, path);
      const after = getByPath(next, path);
      return before !== after ? [{ label, before: formatter(before), after: formatter(after) }] : [];
    });
  }

  function definitionValueLabel(definition, value) {
    const option = definition?.options?.find(([optionValue]) => String(optionValue) === String(value));
    return option?.[1] || String(value ?? "未设置");
  }

  function conditionText(condition, ruleSet) {
    const definition = ruleSet.conditionFields.find((item) => item.id === condition.field);
    const operator = {
      eq: "为",
      neq: "不为",
      gt: "高于",
      gte: "不低于",
      lt: "低于",
      lte: "不高于",
      in: "属于",
      contains: "包含",
      exists: "已提供"
    }[condition.operator] || "为";
    return `${definition?.name || "当前条件"}${operator}${definitionValueLabel(definition, condition.value)}`;
  }

  function outfitImpactLabels(result) {
    const map = {
      family: "服装路线",
      families: "候选路线",
      silhouette: "服装轮廓",
      detail: "款式细节",
      pattern: "图案纹理",
      formality: "正式程度",
      finish: "材质表面",
      trend: "潮流表达",
      trendName: "潮流方向",
      proportion: "版型比例",
      detailIntensity: "细节强度",
      note: "穿着表达",
      seasonVersion: "款式时效"
    };
    return Object.keys(result || {}).map((field) => map[field]).filter(Boolean);
  }

  function outfitResultCapsules(result) {
    const familyNames = { straight: "简洁直线", tailored: "利落结构", soft: "柔和收放", relaxed: "自然留量", street: "街头箱型", retro: "复古收放" };
    const trendNames = { none: "未指定潮流", utilityLayering: "轻机能层次", relaxedTailoring: "松弛剪裁", sheerLayering: "轻透叠穿" };
    const valueFor = (field, value) => {
      if (field === "family") return familyNames[value] || value;
      if (field === "formality") return ({ 1: "随性", 2: "整洁", 3: "偏正式", 4: "正式" })[value] || value;
      if (field === "trend") return trendNames[value] || value;
      return value;
    };
    return Object.entries(result || {})
      .filter(([field, value]) => field !== "families" && !["note", "seasonVersion"].includes(field) && !Array.isArray(value))
      .map(([field, value]) => `${outfitImpactLabels({ [field]: value })[0] || "穿搭结果"}：${valueFor(field, value)}`);
  }

  function buildAnalysisInsights(decision, assembly, ruleSet) {
    const ruleIndex = new Map([
      ...ruleSet.decisionRules.map((rule) => [rule.id, rule]),
      ...ruleSet.outfitOutputs.map((rule) => [rule.id, rule]),
      ...(ruleSet.trendDirections || []).map((rule) => [rule.id, rule])
    ]);
    return decision.trace
      .filter((trace) => ["matched", "rewritten", "partial", "skipped", "conflict"].includes(trace.status))
      .map((trace) => {
        const rule = ruleIndex.get(trace.ruleId);
        const conditions = trace.conditions || rule?.conditions || [];
        const actionLabels = (trace.actions || rule?.actions || [])
          .filter((action) => action.status !== "skipped")
          .map((action) => ruleSet.resultFields.find((field) => field.id === action.field)?.name)
          .filter(Boolean);
        const actionResults = (trace.actions || rule?.actions || [])
          .filter((action) => action.status !== "skipped")
          .map((action) => {
            const definition = ruleSet.resultFields.find((field) => field.id === action.field);
            if (!definition) return null;
            return `${definition.name}：${definitionValueLabel(definition, action.value)}`;
          })
          .filter(Boolean);
        const outputResults = [...new Set([
          ...actionResults,
          ...outfitResultCapsules(trace.outputResult || rule?.result)
        ])];
        const impactTargets = [...new Set([
          ...actionLabels,
          ...outfitImpactLabels(trace.outputResult || rule?.result)
        ])];
        const analysis = trace.analysis || rule?.analysis || {};
        const finding = analysis.finding || conditions.map((condition) => conditionText(condition, ruleSet)).join(rule?.conditionMode === "any" ? "，任一满足" : "，同时满足") || "基础组合条件";
        const conclusion = analysis.conclusion || trace.name || rule?.name || "形成当前处理方向";
        const direction = analysis.direction || trace.reason || rule?.reason || "按当前规则形成候选。";
        const candidateIds = assembly.candidates
          .filter((candidate) => candidate.traceRuleIds.includes(trace.ruleId))
          .map((candidate) => candidate.id);
        return {
          id: `INSIGHT-${trace.ruleId}`,
          ruleId: trace.ruleId,
          group: trace.group || rule?.group || "其他",
          kind: trace.kind || rule?.kind || "soft",
          status: trace.status,
          priority: Number(trace.priority || rule?.priority || 0),
          finding,
          conclusion,
          impactTargets: impactTargets.length ? impactTargets : ["候选顺序"],
          direction,
          inputs: conditions.map((condition) => conditionText(condition, ruleSet)),
          outputResults: outputResults.length ? outputResults : ["调整候选顺序"],
          sourcePaths: conditions.map((condition) => condition.field),
          candidateIds
        };
      });
  }

  function run(input, suppliedRuleSet) {
    const ruleSet = normalizeRuleSet(suppliedRuleSet);
    const safeInput = normalizeInput(input);
    let canonical = null;
    if (window.GarmentCanonicalInputAdapter && window.GarmentCanonicalRuleEngine) {
      const migration = window.GarmentCanonicalInputAdapter.normalizeLegacyInput(safeInput);
      canonical = {
        migration,
        result: window.GarmentCanonicalRuleEngine.run(migration.input)
      };
    }
    const derivation = canonical?.result
      ? { derived: {}, trace: [], missing: [] }
      : deriveFeatures(safeInput, ruleSet);
    const decision = canonical?.result
      ? createCanonicalDecision(safeInput, canonical, ruleSet)
      : applyDecisionRules(safeInput, derivation.derived, ruleSet);
    if (canonical && window.GarmentCanonicalOutputAdapter) {
      window.GarmentCanonicalOutputAdapter.applyToDecision(decision, canonical, ruleSet);
    }
    if (canonical?.result) resolveCanonicalGoalPreferences(decision, ruleSet);
    const assembly = assembleCandidates(safeInput, derivation.derived, decision, ruleSet);
    if (canonical?.result) {
      const canonicalOutput = clone(canonical.result);
      assembly.candidates.forEach((candidate) => {
        candidate.canonicalOutput = canonicalOutput;
      });
    }
    const insights = buildAnalysisInsights(decision, assembly, ruleSet);
    assembly.candidates.forEach((candidate) => {
      const applied = insights.filter((insight) => insight.candidateIds.includes(candidate.id));
      candidate.appliedInsightIds = applied.map((insight) => insight.id);
      candidate.implementationTags = [...new Set([
        `${candidate.layerCount} 层`,
        sleeveLabel(candidate.sleeve),
        outerLabel(candidate.garments.outer === "无外层" ? "none" : decision.requirements.outer),
        candidate.silhouette,
        candidate.palette?.name
      ].filter(Boolean))].slice(0, 5);
    });
    const baseline = assembly.candidates[0];
    assembly.candidates.forEach((candidate, index) => {
      candidate.differenceSummary = index === 0
        ? "基准方案"
        : meaningfulDifference(baseline, candidate).join("、") || "候选细节差异";
    });
    if (canonical?.result) {
      decision.decisionRecord.candidateRanking = assembly.candidates.map((candidate) => ({
        candidateId: candidate.id,
        title: candidate.title,
        goalStatus: candidate.goalAssessment?.status || "未设置",
        goalScore: candidate.goalAssessment?.score || 0,
        reasons: candidate.goalAssessment?.items || []
      }));
    }
    return {
      input: safeInput,
      version: ruleSet.meta.version || "draft",
      derived: derivation.derived,
      missing: derivation.missing,
      requirements: decision.requirements,
      insights,
      candidates: assembly.candidates,
      blocked: assembly.blocked,
      conflicts: [...decision.conflicts, ...assembly.conflicts],
      trace: [...derivation.trace, ...decision.trace],
      decisionRecord: decision.decisionRecord || null,
      canonical,
      canonicalOverlay: canonical
        ? {
          applied: decision.canonicalApplied || [],
          deferred: decision.canonicalDeferred || [],
          paletteMatch: decision.canonicalPaletteMatch || null
        }
        : null
    };
  }

  function validateRuleSet(suppliedRuleSet) {
    const ruleSet = normalizeRuleSet(suppliedRuleSet);
    const errors = [];
    const warnings = [];
    const allObjects = [
      ...ruleSet.parameters,
      ...ruleSet.derivedRules,
      ...ruleSet.decisionRules,
      ...ruleSet.outfitOutputs,
      ...ruleSet.components,
      ...ruleSet.colorLibrary,
      ...ruleSet.palettePlans,
      ...ruleSet.tests
    ];
    const ids = new Map();
    allObjects.forEach((item) => {
      if (!item.id) errors.push({ type: "missing_id", message: "存在缺少编号的对象。" });
      if (ids.has(item.id)) errors.push({ type: "duplicate_id", message: `编号 ${item.id} 重复。` });
      ids.set(item.id, true);
    });

    ruleSet.decisionRules.forEach((rule) => {
      if (!rule.conditions?.length) warnings.push({ type: "no_condition", ruleId: rule.id, message: `${rule.name} 没有条件，将始终命中。` });
      if (!rule.actions?.length) warnings.push({ type: "no_action", ruleId: rule.id, message: `${rule.name} 没有动作。` });
    });

    const conditionFieldIds = new Set(ruleSet.conditionFields.map((field) => field.id));
    const parameterIds = new Set(ruleSet.parameters.map((parameter) => parameter.id));
    const derivedOutputs = new Set(ruleSet.derivedRules.map((rule) => rule.output));
    const resultFieldMap = new Map(ruleSet.resultFields.map((field) => [field.id, field]));
    const allowedOperators = new Set(Object.keys(ruleSet.operatorDictionary?.operators || {}));
    const validateRuleReferences = (rule, relationType = "") => {
      const scopedMappings = relationType === "decision" && Array.isArray(ruleSet.fieldMappings)
        ? ruleSet.fieldMappings.filter((mapping) => (rule.conditions || []).some((condition) => mapping.conditionFields?.includes(condition.field)))
        : [];
      const scopedConditionFields = new Set(scopedMappings.flatMap((mapping) => mapping.conditionFields || []));
      const scopedResultFields = new Set(scopedMappings.flatMap((mapping) => mapping.resultFields || []));
      (rule.inputs || []).forEach((input) => {
        if (!parameterIds.has(input.field) && !derivedOutputs.has(input.field)) {
          errors.push({ type: "missing_input_field", ruleId: rule.id, field: input.field, message: `${rule.name} 引用了不存在的输入字段 ${input.field}。` });
        }
      });
      if (rule.output && rule.id.startsWith("DERIVED-") && !rule.output.includes(".")) {
        errors.push({ type: "invalid_derived_output", ruleId: rule.id, field: rule.output, message: `${rule.name} 的派生输出字段无效。` });
      }
      (rule.conditions || []).forEach((condition) => {
        if (!conditionFieldIds.has(condition.field)) {
          errors.push({ type: "missing_condition_field", ruleId: rule.id, field: condition.field, message: `${rule.name} 引用了不存在的条件字段 ${condition.field}。` });
        }
        if (relationType === "decision" && scopedMappings.length && !scopedConditionFields.has(condition.field)) {
          errors.push({ type: "out_of_scope_condition_field", ruleId: rule.id, field: condition.field, message: `${rule.name} 使用了不属于当前关系的条件字段 ${condition.field}。` });
        }
        if (!allowedOperators.has(condition.operator)) {
          errors.push({ type: "invalid_operator", ruleId: rule.id, operator: condition.operator, message: `${rule.name} 使用了未定义的运算符 ${condition.operator}。` });
        }
      });
      (rule.actions || []).forEach((action) => {
        if (["FORBID", "FILTER"].includes(action.type)) {
          if (!conditionFieldIds.has(action.field) && !action.field.startsWith("candidate.")) {
            errors.push({ type: "missing_filter_field", ruleId: rule.id, field: action.field, message: `${rule.name} 的筛选字段 ${action.field} 不存在。` });
          }
          return;
        }
        const definition = resultFieldMap.get(action.field);
        if (!definition) {
          errors.push({ type: "missing_result_field", ruleId: rule.id, field: action.field, message: `${rule.name} 写入了不存在的结果字段 ${action.field}。` });
        } else if (definition.actions && !definition.actions.includes(action.type)) {
          errors.push({ type: "invalid_action", ruleId: rule.id, field: action.field, action: action.type, message: `${rule.name} 不能对 ${action.field} 使用 ${action.type}。` });
        }
        if (relationType === "decision" && scopedMappings.length && !scopedResultFields.has(action.field) && !action.field.startsWith("candidate.")) {
          errors.push({ type: "out_of_scope_result_field", ruleId: rule.id, field: action.field, message: `${rule.name} 写入了不属于当前关系的结果字段 ${action.field}。` });
        }
      });
    };
    ruleSet.derivedRules.forEach((rule) => validateRuleReferences(rule, "derived"));
    ruleSet.decisionRules.forEach((rule) => validateRuleReferences(rule, "decision"));
    ruleSet.outfitOutputs.forEach((rule) => validateRuleReferences(rule, "outfit"));
    (ruleSet.trendDirections || []).forEach((rule) => validateRuleReferences(rule, "trend"));

    ruleSet.components.forEach((component) => {
      const attributes = component.attributes || {};
      if (!component.category || !["top", "outer", "bottom", "dress"].includes(component.category)) {
        errors.push({ type: "invalid_component_category", componentId: component.id, message: `${component.name || component.id} 的品类无效。` });
      }
      if (!component.enabled) return;
      if (!attributes.family) warnings.push({ type: "missing_component_family", componentId: component.id, message: `${component.name || component.id} 缺少风格路线。` });
      if (component.category === "top" && !attributes.sleeve) errors.push({ type: "missing_component_attribute", componentId: component.id, message: `${component.name || component.id} 缺少袖长属性。` });
      if (component.category === "outer" && !attributes.outerKind) errors.push({ type: "missing_component_attribute", componentId: component.id, message: `${component.name || component.id} 缺少外层类型属性。` });
      if (component.category === "bottom" && (!attributes.bottomType || !attributes.coverage)) errors.push({ type: "missing_component_attribute", componentId: component.id, message: `${component.name || component.id} 缺少下装类型或覆盖属性。` });
      if (component.category === "dress" && (!attributes.dressCut || !attributes.sleeve || !attributes.coverage)) errors.push({ type: "missing_component_attribute", componentId: component.id, message: `${component.name || component.id} 缺少连身裙型、袖长或覆盖属性。` });
    });

    const colorIds = new Set(ruleSet.colorLibrary.map((item) => item.id));
    ruleSet.colorLibrary.forEach((color) => {
      if (!/^#[0-9a-f]{6}$/i.test(color.hex || "")) errors.push({ type: "invalid_color", colorId: color.id, message: `${color.name} 的色值格式不正确。` });
    });
    ruleSet.palettePlans.forEach((plan) => {
      const total = (plan.roles || []).reduce((sum, item) => sum + Number(item.ratio || 0), 0);
      if (total !== 100) errors.push({ type: "palette_ratio", paletteId: plan.id, message: `${plan.name} 的颜色比例合计应为 100%，当前为 ${total}%。` });
      (plan.roles || []).forEach((role) => {
        if (!colorIds.has(role.colorId)) errors.push({ type: "missing_color", paletteId: plan.id, message: `${plan.name} 引用了不存在的颜色。` });
      });
    });

    const activeParameterIds = new Set();
    ruleSet.derivedRules.forEach((rule) => rule.inputs?.forEach((item) => activeParameterIds.add(item.field)));
    ruleSet.decisionRules.forEach((rule) => rule.conditions?.forEach((item) => {
      if (item.field.startsWith("input.")) activeParameterIds.add(item.field.slice(6));
    }));
    ruleSet.outfitOutputs.forEach((rule) => rule.conditions?.forEach((item) => {
      if (item.field.startsWith("input.")) activeParameterIds.add(item.field.slice(6));
    }));
    (ruleSet.trendDirections || []).forEach((rule) => rule.conditions?.forEach((item) => {
      if (item.field.startsWith("input.")) activeParameterIds.add(item.field.slice(6));
    }));
    if ((ruleSet.trendDirections || []).length) activeParameterIds.add("preference.trendIntensity");
    ruleSet.parameters.filter((item) => item.enabled && !activeParameterIds.has(item.id)).forEach((item) => {
      warnings.push({ type: "unused_parameter", parameterId: item.id, message: `${item.name} 暂未被任何规则使用。` });
    });

    ruleSet.decisionRules.forEach((first, index) => {
      if (!first.enabled || first.kind !== "hard") return;
      ruleSet.decisionRules.slice(index + 1).forEach((second) => {
        if (!second.enabled || second.kind !== "hard" || Number(first.priority) !== Number(second.priority)) return;
        const sameConditions = JSON.stringify(first.conditions || []) === JSON.stringify(second.conditions || []);
        if (!sameConditions) return;
        (first.actions || []).forEach((firstAction) => {
          (second.actions || []).forEach((secondAction) => {
            if (firstAction.field === secondAction.field && JSON.stringify(firstAction.value) !== JSON.stringify(secondAction.value)) {
              errors.push({
                type: "hard_conflict",
                rules: [first.id, second.id],
                message: `${first.name} 与 ${second.name} 在相同优先级写入了互斥值。`
              });
            }
          });
        });
      });
    });

    return { valid: errors.length === 0, errors, warnings };
  }

  function runTests(suppliedRuleSet) {
    const ruleSet = normalizeRuleSet(suppliedRuleSet);
    return ruleSet.tests.filter((test) => test.enabled).map((test) => {
      const result = run(test.input, ruleSet);
      const checks = [];
      const expected = test.expected || {};
      if (isKnown(expected.layerCount)) checks.push({ name: "层数", pass: result.requirements.layerCount === expected.layerCount, actual: result.requirements.layerCount, expected: expected.layerCount });
      if (isKnown(expected.sleeve)) checks.push({ name: "袖长", pass: result.requirements.sleeve === expected.sleeve, actual: result.requirements.sleeve, expected: expected.sleeve });
      if (isKnown(expected.outer)) checks.push({ name: "外层", pass: result.requirements.outer === expected.outer, actual: result.requirements.outer, expected: expected.outer });
      if (isKnown(expected.formalityMin)) checks.push({ name: "正式度", pass: result.requirements.formalityMin >= expected.formalityMin, actual: result.requirements.formalityMin, expected: expected.formalityMin });
      if (isKnown(expected.minCandidates)) checks.push({ name: "候选数量", pass: result.candidates.length >= expected.minCandidates, actual: result.candidates.length, expected: expected.minCandidates });
      if (isKnown(expected.forbiddenBottomType)) checks.push({
        name: "拒绝下装",
        pass: result.candidates.every((candidate) => candidate.bottomType !== expected.forbiddenBottomType),
        actual: result.candidates.map((candidate) => candidate.bottomType).join(", "),
        expected: `不含 ${expected.forbiddenBottomType}`
      });
      if (expected.noDefinedWaist) checks.push({
        name: "拒绝明确收腰",
        pass: result.candidates.every((candidate) => candidate.waist !== "defined"),
        actual: result.candidates.map((candidate) => candidate.waist).join(", "),
        expected: "不含 defined"
      });
      if (expected.coverage) checks.push({
        name: "覆盖程度",
        pass: result.requirements.coverage === expected.coverage && result.candidates.every((candidate) => candidate.coverage === expected.coverage),
        actual: `${result.requirements.coverage}; ${result.candidates.map((candidate) => candidate.coverage).join(", ")}`,
        expected: expected.coverage
      });
      if (expected.movement) checks.push({
        name: "行动便利",
        pass: result.requirements.movement === true && result.candidates.every((candidate) => candidate.components.every((component) => component.attributes.movement !== false)),
        actual: result.requirements.movement,
        expected: true
      });
      return { id: test.id, name: test.name, pass: checks.every((check) => check.pass), checks, result };
    });
  }

  function loadJSON(key, fallback) {
    try {
      const stored = window.localStorage.getItem(key);
      return stored ? JSON.parse(stored) : clone(fallback);
    } catch (error) {
      return clone(fallback);
    }
  }

  const Store = {
    keys: STORAGE_KEYS,
    loadPublished() {
      return normalizeRuleSet(loadJSON(STORAGE_KEYS.published, DATA.defaultRuleSet));
    },
    loadDraft() {
      const published = this.loadPublished();
      return normalizeRuleSet(loadJSON(STORAGE_KEYS.draft, published));
    },
    saveDraft(ruleSet) {
      const draft = normalizeRuleSet(ruleSet);
      draft.meta.status = "draft";
      draft.meta.updatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
      window.localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(draft));
      return draft;
    },
    publish(ruleSet) {
      const validation = validateRuleSet(ruleSet);
      if (!validation.valid) return { ok: false, validation };
      const published = normalizeRuleSet(ruleSet);
      const parts = String(published.meta.version || "0.8.0").split(".").map(Number);
      parts[2] = Number(parts[2] || 0) + 1;
      published.meta.version = parts.join(".");
      published.meta.status = "published";
      published.meta.updatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
      window.localStorage.setItem(STORAGE_KEYS.published, JSON.stringify(published));
      window.localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(published));
      return { ok: true, ruleSet: published, validation };
    },
    reset() {
      window.localStorage.removeItem(STORAGE_KEYS.published);
      window.localStorage.removeItem(STORAGE_KEYS.draft);
      return clone(DATA.defaultRuleSet);
    },
    loadInput() {
      return normalizeInput(loadJSON(STORAGE_KEYS.input, DATA.defaultInput));
    },
    saveInput(input) {
      window.localStorage.setItem(STORAGE_KEYS.input, JSON.stringify(normalizeInput(input)));
    },
    export(ruleSet) {
      return JSON.stringify(normalizeRuleSet(ruleSet), null, 2);
    },
    import(text) {
      const parsed = JSON.parse(text);
      const normalized = normalizeRuleSet(parsed);
      const validation = validateRuleSet(normalized);
      if (!validation.valid) {
        const error = new Error(validation.errors.map((item) => item.message).join("\n"));
        error.validation = validation;
        throw error;
      }
      return normalized;
    }
  };

  function sleeveLabel(value) {
    return ({ long: "长袖", threeQuarter: "七分袖", short: "短袖" })[value] || String(value ?? "需验证");
  }

  function outerLabel(value) {
    return ({ none: "无外层", light: "可脱轻外层", warm: "保暖外层" })[value] || String(value ?? "需验证");
  }

  function coverageLabel(value) {
    return ({ full: "完整覆盖", regular: "适中覆盖", light: "轻覆盖" })[value] || String(value ?? "需验证");
  }

  function formalityLabel(value) {
    return ({ 1: "自然", 2: "整洁", 3: "正式", 4: "高度正式" })[value] || String(value ?? "需验证");
  }

  function waistLabel(value) {
    return ({ natural: "自然腰位", raised: "偏高腰位", defined: "明确腰线" })[value] || String(value ?? "需验证");
  }

  function lineLabel(value) {
    return ({ balanced: "自然线条", continuous: "连续纵向", sectioned: "分段线条" })[value] || String(value ?? "需验证");
  }

  function trendLabel(value) {
    return ({ none: "未指定潮流", utilityLayering: "轻机能层次", relaxedTailoring: "松弛剪裁", sheerLayering: "轻透叠穿" })[value] || String(value ?? "需验证");
  }

  window.GarmentRuleEngine = {
    clone,
    getByPath,
    setByPath,
    normalizeInput,
    labelForOption,
    deriveFeatures,
    applyDecisionRules,
    assembleCandidates,
    meaningfulDifference,
    diffResults,
    validateRuleSet,
    runTests,
    run,
    Store,
    labels: { sleeveLabel, outerLabel, coverageLabel, formalityLabel, waistLabel, lineLabel, trendLabel }
  };
})();
