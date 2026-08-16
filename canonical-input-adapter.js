(function () {
  "use strict";

  const DATA = window.GarmentCanonicalData || {};
  const inputIds = new Set((DATA.fieldRegistry?.inputs || []).map((field) => field.id));
  const mappings = DATA.migrationMap?.inputMappings || [];

  function flatten(value, prefix = "", output = {}) {
    Object.entries(value || {}).forEach(([key, item]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (item && typeof item === "object" && !Array.isArray(item)) flatten(item, path, output);
      else output[path] = item;
    });
    return output;
  }

  function unflatten(value) {
    const output = {};
    Object.entries(value || {}).forEach(([path, item]) => {
      const parts = path.split(".");
      const last = parts.pop();
      const parent = parts.reduce((cursor, part) => {
        if (!cursor[part] || typeof cursor[part] !== "object") cursor[part] = {};
        return cursor[part];
      }, output);
      parent[last] = item;
    });
    return output;
  }

  function hasValue(input, field) {
    return Object.prototype.hasOwnProperty.call(input, field) && input[field] !== undefined && input[field] !== null && input[field] !== "";
  }

  function numeric(value) {
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  }

  function mapTone(value) {
    const number = numeric(value);
    if (number !== null && number >= 0 && number <= 4) return ["cool", "coolLean", "neutral", "warmLean", "warm"][number];
    return { cool: "cool", coolLean: "coolLean", neutral: "neutral", warmLean: "warmLean", warm: "warm" }[value] || null;
  }

  function mapTemperature(value) {
    const number = numeric(value);
    if (number !== null) return number <= 1 ? "cool" : number === 2 ? "neutral" : "warm";
    return { cool: "cool", neutral: "neutral", warm: "warm" }[value] || null;
  }

  function mapSkinValue(value) {
    const number = numeric(value);
    if (number !== null) return number <= 1 ? "fair" : number === 2 ? "medium" : "deep";
    return { fair: "fair", medium: "medium", deep: "deep" }[value] || null;
  }

  function mapHairDepth(value) {
    const number = numeric(value);
    if (number !== null) return number <= 1 ? "light" : number === 2 ? "medium" : "dark";
    return { light: "light", medium: "medium", dark: "dark" }[value] || null;
  }

  function mapThreeBand(value, values) {
    const number = numeric(value);
    if (number !== null) return number <= 1 ? values[0] : number === 2 ? values[1] : values[2];
    return values.includes(value) ? value : null;
  }

  function mapField(from, value) {
    if (from === "appearance.skinTemperature") return mapTone(value);
    if (from === "appearance.skinValue") return mapSkinValue(value);
    if (from === "appearance.hairTemperature") return mapTemperature(value);
    if (from === "appearance.hairValue") return mapHairDepth(value);
    if (from === "body.legRatio") return mapThreeBand(value, ["longTorso", "balanced", "longLegs"]);
    if (from === "body.waistDefinition") return mapThreeBand(value, ["undefined", "moderate", "defined"]);
    if (from === "body.shoulderHipBalance") return mapThreeBand(value, ["shoulderDominant", "balanced", "hipDominant"]);
    if (from === "preference.formality") return mapThreeBand(value, ["relaxed", "commute", "formal"]);
    if (["preference.style", "face.shape", "goal.endpoint"].includes(from) && value === "unknown") return null;
    return value;
  }

  function normalizeLegacyInput(legacyInput = {}) {
    const source = flatten(legacyInput);
    const input = {};
    const warnings = [];
    const defaultsApplied = [];

    mappings.forEach((mapping) => {
      if (!hasValue(source, mapping.from)) return;
      if (["remove", "retired"].includes(mapping.status)) {
        warnings.push(`${mapping.from}: removed from canonical contract`);
        return;
      }
      if (!mapping.to) return;
      const value = mapField(mapping.from, source[mapping.from]);
      if (value === null || value === undefined) {
        warnings.push(`${mapping.from}: value is not safely mappable`);
        return;
      }
      input[mapping.to] = value;
      if (["review", "new-field"].includes(mapping.status)) warnings.push(`${mapping.from} -> ${mapping.to}: ${mapping.status}`);
    });

    inputIds.forEach((field) => {
      if (hasValue(source, field) && !hasValue(input, field)) input[field] = source[field];
    });

    ["boundaries.rejectTight", "boundaries.rejectDeepNeck"].forEach((field) => {
      if (!hasValue(input, field)) {
        input[field] = false;
        defaultsApplied.push(field);
      }
    });

    Object.keys(input).forEach((field) => {
      if (!inputIds.has(field)) {
        delete input[field];
        warnings.push(`${field}: removed because it is not in the canonical registry`);
      }
    });

    return { input, warnings: [...new Set(warnings)], defaultsApplied };
  }

  window.GarmentCanonicalInputAdapter = { normalizeLegacyInput };
}());
