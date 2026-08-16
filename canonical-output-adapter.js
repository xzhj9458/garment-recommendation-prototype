(function () {
  "use strict";

  function setIfKnown(target, field, value) {
    if (value !== undefined && value !== null && value !== "") target[field] = value;
  }

  function colorSimilarity(left, right) {
    const aliases = {
      "纯白": ["冷白", "柔白"],
      "暖象牙白": ["象牙白"],
      "冷象牙白": ["象牙白"],
      "深冷灰": ["深灰", "炭灰", "炭黑"],
      "炭黑": ["深灰", "炭灰"],
      "炭灰": ["深灰", "炭黑"],
      "海军蓝": ["藏蓝", "深蓝"],
      "深蓝灰": ["藏蓝", "深灰"],
      "冰川蓝": ["雾蓝", "冷白"],
      "浅冰蓝": ["雾蓝", "柔白"],
      "浅水洗蓝": ["雾蓝"],
      "丁香紫": ["雾紫"],
      "浅丁香紫": ["雾紫"],
      "冷灰": ["浅灰", "深灰"],
      "浅冷灰": ["浅灰"],
      "暖焦糖": ["浅驼"],
      "焦糖色": ["浅驼", "砖红"],
      "深驼": ["浅驼"],
      "深卡其": ["浅驼"]
    };
    if (!left || !right) return 0;
    if (left === right) return 4;
    if (String(left).includes(String(right)) || String(right).includes(String(left))) return 3;
    if ((aliases[left] || []).includes(right) || (aliases[right] || []).includes(left)) return 2;
    return 0;
  }

  function matchCanonicalPalette(decision, canonical, ruleSet) {
    const distribution = canonical?.result?.color?.distribution;
    const nearFace = canonical?.result?.color?.nearFacePalette;
    const plans = (ruleSet?.palettePlans || []).filter((plan) => plan.enabled !== false);
    const colors = new Map((ruleSet?.colorLibrary || []).map((item) => [item.id, item.name]));
    if (!distribution || !plans.length) return null;
    const targets = {
      nearFace: [...(nearFace?.preferred || []), ...(distribution.nearFace || [])],
      main: distribution.main || [],
      accent: distribution.accent || []
    };
    const contrast = { low: "低", medium: "中等", high: "高" }[canonical.result.color?.contrastMode];
    const scored = plans.map((plan) => {
      let score = 0;
      (plan.roles || []).forEach((role) => {
        const actual = colors.get(role.colorId);
        const candidates = targets[role.role] || targets.main;
        score += Math.max(0, ...candidates.map((target) => colorSimilarity(target, actual)));
      });
      if (contrast && plan.contrast === contrast) score += 3;
      return { plan, score };
    }).sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (!best || best.score < 6) return { matched: false, reason: "no reliable palette overlap", scores: scored.slice(0, 3) };
    decision.requirements.palettePlanId = best.plan.id;
    decision.requirements.palettePlanIds = scored.slice(0, 3).map((item) => item.plan.id);
    decision.canonicalPaletteMatch = {
      matched: true,
      planId: best.plan.id,
      score: best.score,
      alternatives: scored.slice(1, 3).map((item) => ({ planId: item.plan.id, score: item.score }))
    };
    return decision.canonicalPaletteMatch;
  }

  function applyToDecision(decision, canonical, ruleSet) {
    if (!decision?.requirements || !canonical?.result) return { applied: [], deferred: [] };
    const output = canonical.result;
    const requirements = decision.requirements;
    const applied = [];
    const deferred = [];
    const direct = [
      ["framework.layerCount", "layerCount"],
      ["framework.sleeve", "sleeve"],
      ["framework.outer", "outer"],
      ["garment.silhouette", "silhouette"]
    ];

    direct.forEach(([source, target]) => {
      const value = source.split(".").reduce((current, key) => current == null ? undefined : current[key], output);
      if (value !== undefined && value !== null && value !== "") {
        requirements[target] = value;
        applied.push(`${source}->requirements.${target}`);
      }
    });

    const silhouetteLine = {
      H: "balanced",
      A: "sectioned",
      X: "sectioned",
      Y: "continuous",
      O: "balanced",
      shortWideLongSlim: "continuous"
    }[output.garment?.silhouette];
    if (silhouetteLine) {
      requirements.line = silhouetteLine;
      applied.push("garment.silhouette->requirements.line");
    }

    const necklineLabels = {
      vNeck: "开阔领口",
      uNeck: "开阔领口",
      boatNeck: "柔和开阔领口",
      squareNeck: "开阔领口",
      crewNeck: "常规领口"
    };
    const neckline = necklineLabels[output.garment?.neckline];
    if (neckline) {
      requirements.neckline = neckline;
      applied.push("garment.neckline->requirements.neckline");
    }

    const material = { lightweight: "轻薄", medium: "适中", heavy: "厚重" }[output.framework?.materialWeight];
    if (material) {
      requirements.material = material;
      applied.push("framework.materialWeight->requirements.material");
    }

    const waist = { relaxed: "relaxed", natural: "natural", raised: "raised" }[output.garment?.waistline];
    if (waist) {
      requirements.waist = waist;
      applied.push("garment.waistline->requirements.waist");
    }

    const contrast = { low: "低", medium: "中等", high: "高" }[output.color?.contrastMode];
    if (contrast) {
      requirements.colorContrast = contrast;
      applied.push("color.contrastMode->requirements.colorContrast");
    }

    if (output.color?.distribution || output.color?.nearFacePalette) {
      decision.canonicalColor = {
        distribution: output.color.distribution || null,
        nearFacePalette: output.color.nearFacePalette || null
      };
      deferred.push("color.distribution/nearFacePalette");
      const paletteMatch = matchCanonicalPalette(decision, canonical, ruleSet);
      if (paletteMatch?.matched) {
        applied.push("color.distribution/nearFacePalette->requirements.palettePlanId");
        const deferredIndex = deferred.indexOf("color.distribution/nearFacePalette");
        if (deferredIndex >= 0) deferred.splice(deferredIndex, 1);
      }
    }
    if (output.accessories && Object.keys(output.accessories).length) {
      decision.canonicalAccessories = output.accessories;
      applied.push("accessories.*->candidate.canonicalOutput.accessories");
    }
    if (output.framework?.form) {
      decision.canonicalForm = output.framework.form;
      requirements.canonicalForm = output.framework.form;
      applied.push("framework.form->requirements.canonicalForm");
    }
    if (output.garment?.topFit || output.garment?.bottomCut || output.garment?.dressCut) {
      decision.canonicalGarment = {
        topFit: output.garment.topFit || null,
        bottomCut: output.garment.bottomCut || null,
        dressCut: output.garment.dressCut || null
      };
      requirements.canonicalTopFit = output.garment.topFit || null;
      requirements.canonicalBottomCut = output.garment.bottomCut || null;
      requirements.canonicalDressCut = output.garment.dressCut || null;
      if (output.framework?.form === "onePieceDress") {
        if (output.garment.dressCut) applied.push("garment.dressCut->requirements.canonicalDressCut");
        if (output.garment.topFit) deferred.push("garment.topFit (not applicable to one-piece form)");
      } else {
        if (output.garment.topFit) applied.push("garment.topFit->requirements.canonicalTopFit");
        if (output.garment.bottomCut) applied.push("garment.bottomCut->requirements.canonicalBottomCut");
      }
    }

    decision.canonicalApplied = applied;
    decision.canonicalDeferred = deferred;
    return { applied, deferred };
  }

  window.GarmentCanonicalOutputAdapter = { applyToDecision };
}());
