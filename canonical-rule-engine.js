(function () {
  "use strict";

  const DATA = window.GarmentCanonicalData || {};
  const REGISTRY = DATA.fieldRegistry || {};
  const STORAGE_KEYS = {
    draft: "garment-canonical-rules-draft",
    published: "garment-canonical-rules-published"
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function defaultRuleData() {
    return clone({
      schemaVersion: DATA.matrices?.schemaVersion || DATA.fieldRegistry?.schemaVersion || "2026-08-16",
      matrices: DATA.matrices || { matrices: [] },
      modifiers: DATA.modifiers || { modifiers: [] },
      meta: { status: "default", updatedAt: null, publishedAt: null }
    });
  }

  function validRuleData(value) {
    return Boolean(value && Array.isArray(value.matrices?.matrices) && Array.isArray(value.modifiers?.modifiers));
  }

  function loadStored(key) {
    try {
      const value = JSON.parse(window.localStorage.getItem(key));
      return validRuleData(value) ? value : null;
    } catch (error) {
      return null;
    }
  }

  const Store = {
    keys: STORAGE_KEYS,
    defaults: defaultRuleData,
    loadPublished() {
      return clone(loadStored(STORAGE_KEYS.published) || defaultRuleData());
    },
    loadDraft() {
      return clone(loadStored(STORAGE_KEYS.draft) || loadStored(STORAGE_KEYS.published) || defaultRuleData());
    },
    saveDraft(ruleData) {
      const next = clone(ruleData);
      next.meta = { ...(next.meta || {}), status: "draft", updatedAt: new Date().toISOString() };
      window.localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(next));
      return clone(next);
    },
    publish(ruleData) {
      const next = clone(ruleData);
      const publishedAt = new Date().toISOString();
      next.meta = { ...(next.meta || {}), status: "published", updatedAt: publishedAt, publishedAt };
      window.localStorage.setItem(STORAGE_KEYS.published, JSON.stringify(next));
      window.localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(next));
      return clone(next);
    },
    reset() {
      window.localStorage.removeItem(STORAGE_KEYS.draft);
      window.localStorage.removeItem(STORAGE_KEYS.published);
      return defaultRuleData();
    }
  };

  function runtimeData(ruleData) {
    const resolved = validRuleData(ruleData) ? ruleData : Store.loadPublished();
    return {
      matrices: resolved.matrices.matrices,
      modifiers: resolved.modifiers.modifiers
    };
  }

  function getPath(value, path) {
    return String(path || "").split(".").reduce((current, key) => current == null ? undefined : current[key], value);
  }

  function setPath(target, path, value) {
    const parts = String(path).split(".");
    const last = parts.pop();
    const parent = parts.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== "object") current[key] = {};
      return current[key];
    }, target);
    parent[last] = clone(value);
  }

  function preferred(value, fallback = null) {
    if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "preferred")) return value.preferred ?? fallback;
    return value ?? fallback;
  }

  function inputValue(input, field) {
    return Object.prototype.hasOwnProperty.call(input, field) ? input[field] : undefined;
  }

  function conditionMatches(input, condition) {
    if (condition.all) return condition.all.every((item) => conditionMatches(input, item));
    const actual = inputValue(input, condition.field);
    if (actual === undefined || actual === null) return false;
    if (Object.prototype.hasOwnProperty.call(condition, "equals")) return Array.isArray(actual) ? actual.includes(condition.equals) : actual === condition.equals;
    if (Object.prototype.hasOwnProperty.call(condition, "in")) return Array.isArray(actual) ? actual.some((item) => condition.in.includes(item)) : condition.in.includes(actual);
    if (Object.prototype.hasOwnProperty.call(condition, "contains")) return Array.isArray(actual) ? actual.includes(condition.contains) : String(actual).includes(condition.contains);
    return false;
  }

  function orderedValues(fieldId) {
    return (REGISTRY.outputs || []).find((field) => field.id === fieldId)?.options?.map((option) => option[0]) || [];
  }

  function applyModifierAction(input, result, action) {
    if (action.operation === "annotate") {
      const value = action.valueFrom ? inputValue(input, action.valueFrom) : action.value;
      const target = action.outputField === "trace" ? result.trace : getPath(result, action.outputField);
      if (target && typeof target === "object") target[action.metadataKey] = clone(value);
      return;
    }
    const current = getPath(result, action.outputField);
    if (action.operation === "atLeast") {
      const values = orderedValues(action.outputField);
      const currentIndex = values.indexOf(current);
      const requestedIndex = values.indexOf(action.value);
      if (requestedIndex >= 0 && (currentIndex < 0 || requestedIndex > currentIndex)) setPath(result, action.outputField, action.value);
      return;
    }
    if (action.operation === "nudge") {
      const values = orderedValues(action.outputField);
      const currentIndex = values.indexOf(current);
      if (currentIndex >= 0) setPath(result, action.outputField, values[Math.max(0, Math.min(values.length - 1, currentIndex + action.value))]);
      return;
    }
    if (action.operation === "set" || action.operation === "prefer") setPath(result, action.outputField, action.value);
  }

  function applyModifierRules(input, result, runtime) {
    runtime.modifiers.forEach((modifier) => {
      if (inputValue(input, modifier.input) === undefined || inputValue(input, modifier.input) === null) return;
      (modifier.rules || []).forEach((rule) => {
        if (!conditionMatches(input, rule.when)) return;
        result.trace.rules.push(rule.id);
        result.trace.modifierRules.push(rule.id);
        (rule.then || []).forEach((action) => applyModifierAction(input, result, action));
      });
    });
  }

  function matrix(runtime, id) {
    return runtime.matrices.find((item) => item.id === id);
  }

  function findRow(runtime, id, predicate) {
    return matrix(runtime, id)?.rows.find(predicate) || null;
  }

  function findScenario(input, runtime) {
    return findRow(runtime, "scenario", (row) => row.canonicalInputs?.["context.temperatureRange"] === input["context.temperatureRange"] && row.canonicalInputs?.["context.occasion"] === input["context.occasion"]);
  }

  function findColor(input, runtime) {
    return findRow(runtime, "color", (row) => row.canonicalInputs?.["appearance.skinTone"] === input["appearance.skinTone"] && row.canonicalInputs?.["appearance.hairDepth"] === input["appearance.hairDepth"]);
  }

  function findBody(input, runtime) {
    return findRow(runtime, "body", (row) => row.canonicalInputs?.["body.shoulderHipBalance"] === input["body.shoulderHipBalance"] && row.canonicalInputs?.["body.legRatio"] === input["body.legRatio"] && row.canonicalInputs?.["body.boneFrame"] === input["body.boneFrame"]);
  }

  function findFace(input, runtime) {
    return findRow(runtime, "face", (row) => row.canonicalInputs?.["face.shape"] === input["face.shape"]);
  }

  function findStyle(input, runtime) {
    return findRow(runtime, "style", (row) => row.canonicalInputs?.["preference.style"] === input["preference.style"]);
  }

  function applyBoundaries(input, result, runtime) {
    const rows = matrix(runtime, "boundary")?.rows || [];
    rows.forEach((row) => {
      const conditions = Object.entries(row.canonicalInputs || {});
      if (!conditions.length || !conditions.every(([field, value]) => input[field] === value)) return;
      result.trace.rules.push(row.id);
      conditions.forEach(([field]) => result.trace.conflicts.push(field));
      const overrides = row.canonicalOutputs?.overrides || {};
      Object.entries(overrides).forEach(([field, allowed]) => {
        if (!Array.isArray(allowed) || !allowed.length) return;
        const current = getPath(result, field);
        if (!allowed.includes(current)) setPath(result, field, allowed[0]);
      });
    });
    if (result.framework.form !== "onePieceDress") result.garment.dressCut = null;
  }

  function run(input = {}, ruleData) {
    const runtime = runtimeData(ruleData);
    const result = {
      framework: { form: input["context.occasion"] === "social" ? "onePieceDress" : "separatesTrouser" },
      garment: { neckline: "crewNeck", bottomCut: "straightLeg", dressCut: null },
      accessories: {},
      color: { distribution: { main: [], nearFace: [], accent: [] }, nearFacePalette: { preferred: [], compatible: [], forbidden: [] } },
      explanation: { summary: "统一规则结果", why: [], validation: [] },
      trace: { inputs: clone(input), rules: [], modifierRules: [], conflicts: [], missingInputs: [], pendingModifiers: [], fallback: false }
    };

    const scenario = findScenario(input, runtime);
    if (scenario) {
      result.trace.rules.push(scenario.id);
      Object.entries(scenario.canonicalOutputs || {}).forEach(([field, value]) => {
        const [group, key] = field.split(".");
        if (result[group] && ["layerCount", "sleeve", "outer", "materialWeight", "footwear", "leatherGoods"].includes(key)) result[group][key] = clone(preferred(value));
      });
    } else {
      result.trace.fallback = true;
      result.trace.missingInputs.push("context.temperatureRange/context.occasion");
    }

    const color = findColor(input, runtime);
    if (color) {
      result.trace.rules.push(color.id);
      result.color.contrastMode = color.canonicalOutputs?.["color.contrastMode"];
      result.color.nearFacePalette = clone(color.canonicalOutputs?.["color.nearFacePalette"] || result.color.nearFacePalette);
      result.color.distribution = clone(color.canonicalOutputs?.["color.distribution"] || result.color.distribution);
      result.accessories.jewelry = preferred(color.canonicalOutputs?.["accessories.jewelry"]);
    } else if (input["appearance.skinTone"] || input["appearance.hairDepth"]) {
      result.trace.fallback = true;
      result.trace.missingInputs.push("appearance.skinTone/appearance.hairDepth");
    }

    const body = findBody(input, runtime);
    if (body) {
      result.trace.rules.push(body.id);
      Object.entries(body.canonicalOutputs || {}).forEach(([field, value]) => setPath(result, field, preferred(value)));
    } else if (input["body.shoulderHipBalance"] || input["body.legRatio"] || input["body.boneFrame"]) {
      result.trace.fallback = true;
    }

    const face = findFace(input, runtime);
    if (face) {
      result.trace.rules.push(face.id);
      result.garment.neckline = preferred(face.canonicalOutputs?.["garment.neckline"], "crewNeck");
    }

    const style = findStyle(input, runtime);
    if (style) {
      result.trace.rules.push(style.id);
      result.garment.silhouette = result.garment.silhouette || preferred(style.canonicalOutputs?.["garment.silhouette"]);
      result.accessories.footwear = result.accessories.footwear || preferred(style.canonicalOutputs?.["accessories.footwear"]);
    }

    applyModifierRules(input, result, runtime);
    applyBoundaries(input, result, runtime);
    result.explanation.why = result.trace.rules.slice(0, 3);
    return result;
  }

  window.GarmentCanonicalRuleEngine = { run, clone, Store };
}());
