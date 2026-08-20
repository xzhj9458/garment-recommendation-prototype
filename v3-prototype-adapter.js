(function (global) {
  "use strict";

  const runtime = global.GarmentV3Runtime;
  const fields = global.GarmentV3FieldRegistry;
  const capabilityData = global.GarmentV3CapabilityData;
  const PUBLISHED_RULES_KEY = "garment-v3-rule-published";
  const itemsById = new Map((capabilityData?.items || []).map((item) => [item.id, item]));
  const familyRoutes = { minimal: "straight", urban: "tailored", elegant: "soft", casual: "relaxed", street: "street", retro: "retro", cityboy: "relaxed" };

  function getByPath(value, path) {
    return path.split(".").reduce((current, part) => current?.[part], value);
  }

  function flattenInput(input) {
    return Object.fromEntries((fields?.inputs || []).map((field) => [field.id, getByPath(input, field.id)]));
  }

  function colorHex(name, ruleSet) {
    const exact = (ruleSet?.colorLibrary || []).find((color) => color.name === name)?.hex;
    if (exact) return exact;
    const tones = [
      [/黑|炭/, "#34383a"], [/白|象牙|奶油/, "#eeeae0"], [/灰/, "#9ba0a0"], [/蓝|藏青/, "#738d9d"],
      [/紫|丁香/, "#a99cb7"], [/绿|薄荷|橄榄|鼠尾草/, "#8d9b86"], [/红|酒红|砖红|豆沙/, "#a66d67"],
      [/粉|桃/, "#d6a6a6"], [/驼|卡其|焦糖|杏|燕麦|米|金/, "#b99b75"], [/黄|橙/, "#c69a52"]
    ];
    return tones.find(([pattern]) => pattern.test(name || ""))?.[1] || null;
  }

  function palette(output, ruleSet) {
    const distribution = output.color?.actual?.distribution || output.color?.distribution || {};
    const nearFace = output.color?.nearFacePalette || {};
    const colors = {
      nearFace: nearFace.preferred?.[0] || distribution.nearFace?.[0] || null,
      main: distribution.main?.[0] || null,
      secondary: distribution.main?.[1] || distribution.nearFace?.[1] || null,
      accent: distribution.accent?.[0] || null
    };
    const roles = [
      { role: "nearFace", colorName: colors.nearFace, ratio: 30 },
      { role: "main", colorName: colors.main, ratio: 60 },
      { role: "secondary", colorName: colors.secondary, ratio: 30 },
      { role: "accent", colorName: colors.accent, ratio: 10 }
    ].map((role) => ({ ...role, hex: colorHex(role.colorName, ruleSet) }));
    const role = (id) => roles.find((item) => item.role === id) || {};
    const onePiece = output.framework.form === "onePieceDress";
    const regions = [
      { id: onePiece ? "dress" : "bottom", ...role("main") },
      { id: "top", ...role("nearFace") },
      { id: "outer", ...role("secondary") },
      { id: "accent", ...role("accent") }
    ].map((region) => ({ ...region, source: "V3候选配色" }));
    return { name: "候选独立配色", roles, regions };
  }

  function component(id) {
    const item = itemsById.get(id);
    if (!item) return null;
    const values = item.values;
    return {
      id,
      name: item.name,
      category: values["identity.category"],
      enabled: values["identity.enabled"],
      attributes: {
        sleeve: values["geometry.sleeve"],
        length: values["geometry.length"],
        fitProfile: values["geometry.fitVolume"] >= 4.25 ? "oversized" : values["geometry.fitVolume"] <= 1.75 ? "fitted" : "regular",
        topFit: values["geometry.fitVolume"] >= 4.25 ? "oversized" : values["geometry.fitVolume"] <= 1.75 ? "fitted" : "regular",
        silhouette: values["geometry.silhouette"],
        waistPosition: values["geometry.waistPosition"],
        neckline: values["geometry.neckline"],
        bottomCut: values["geometry.legShape"],
        dressCut: values["geometry.dressCut"],
        materialClass: values["material.fabricWeight"] >= 3.5 ? "heavy" : values["material.fabricWeight"] < 2 ? "light" : "regular",
        styleVector: values["style.vector"] || {}
      }
    };
  }

  function displayCandidate(record, index, ruleSet, objectiveProfile, presentationTier) {
    const output = record.output;
    const raw = record.candidate;
    const roleIds = raw.roles || {};
    const base = roleIds.base?.[0] ? component(roleIds.base[0]) : null;
    const mids = (roleIds.mid || []).map(component).filter(Boolean);
    const outer = roleIds.outer?.[0] ? component(roleIds.outer[0]) : null;
    const bottom = roleIds.bottom?.[0] ? component(roleIds.bottom[0]) : null;
    const dress = roleIds.onePiece?.[0] ? component(roleIds.onePiece[0]) : null;
    const actualOuter = outer?.id === "OUTER-NONE" ? null : outer;
    const requiredComponents = [dress || base, ...mids, actualOuter, bottom, roleIds.footwear?.[0] ? component(roleIds.footwear[0]) : null].filter(Boolean);
    const allComponents = [...requiredComponents, ...(roleIds.accessory || []).map(component).filter(Boolean)];
    const colors = palette(output, ruleSet);
    const dominantStyle = Object.entries((base || dress)?.attributes?.styleVector || {}).sort((left, right) => right[1] - left[1])[0]?.[0];
    const layer = (kind, item, visible = true) => ({
      kind,
      visible: Boolean(item) && visible,
      type: kind === "outer" ? output.framework.outer : kind === "bottom" ? (output.framework.form === "separatesSkirt" ? "skirt" : "trouser") : kind,
      sleeve: item?.attributes?.sleeve,
      dressCut: item?.attributes?.dressCut,
      attributes: item?.attributes || {}
    });
    const illustration = {
      layerCount: output.framework.layerCount,
      silhouette: output.garment.silhouette,
      neckline: output.garment.neckline,
      waist: output.garment.waistline,
      layers: [
        layer("top", base || mids[0], !dress),
        layer("dress", dress, Boolean(dress)),
        layer("outer", actualOuter, Boolean(actualOuter)),
        layer("bottom", bottom, Boolean(bottom))
      ],
      colorMap: { regions: colors.regions },
      accessories: [
        { kind: "footwear", key: output.accessories.footwear, visible: true, required: true },
        { kind: "bag", key: output.accessories.leatherGoods, visible: true, required: false },
        { kind: "jewelry", key: output.accessories.jewelry, visible: true, required: false },
        { kind: "textile", key: output.accessories.textile, visible: output.accessories.textile !== "none", required: false }
      ],
      geometry: {
        top: (base || mids[0])?.attributes || {},
        outer: actualOuter?.attributes || {},
        bottom: bottom?.attributes || {},
        dress: dress?.attributes || {}
      },
      validation: output.illustration.validation
    };
    const names = [dress?.name || [base?.name, ...mids.map((item) => item.name)].filter(Boolean).join(" + "), actualOuter?.name, bottom?.name].filter(Boolean);
    const effectLabels = {
      "effect.thermal.warmth": "组合保暖效果",
      "effect.thermal.breathability": "组合透气效果",
      "effect.thermal.windProtection": "防风效果",
      "effect.occasion.weatherReadiness": "防雨雪效果"
    };
    const estimatedEffects = Object.entries(output.assessment.assessments || {})
      .filter(([effect, assessment]) => effectLabels[effect] && assessment.estimateRange)
      .map(([effect, assessment]) => ({ effect, name: effectLabels[effect], actual: assessment.actual, range: assessment.estimateRange }));
    return {
      id: record.id,
      title: names.join(" + "),
      name: names.join(" + "),
      family: familyRoutes[dominantStyle] || "straight",
      form: output.framework.form,
      topId: base?.id || null,
      outerId: outer?.id || null,
      bottomId: bottom?.id || null,
      dressId: dress?.id || null,
      bottomType: output.framework.form === "onePieceDress" ? "dress" : output.framework.form === "separatesSkirt" ? "skirt" : "trouser",
      topFit: output.garment.topFit,
      bottomCut: output.garment.bottomCut,
      dressCut: output.garment.dressCut,
      garments: {
        top: dress ? null : [base?.name, ...mids.map((item) => item.name)].filter(Boolean).join(" + ") || null,
        outer: actualOuter?.name || "无外层",
        bottom: bottom?.name || null,
        dress: dress?.name || null
      },
      components: allComponents,
      layerCount: output.framework.layerCount,
      sleeve: output.framework.sleeve,
      coverage: output.constraints.coverage,
      material: output.framework.materialWeight,
      texture: output.constraints.contactTexture,
      waist: output.garment.waistline,
      line: output.garment.silhouette,
      colorContrast: output.color.contrastMode,
      palette: colors,
      illustration,
      styleName: "效果等价方案",
      silhouette: output.garment.silhouette,
      neckline: output.garment.neckline,
      focus: output.explanation.summary,
      expectedEffect: output.explanation.summary,
      estimatedEffects,
      objectiveProfile: objectiveProfile || null,
      inputSnapshot: objectiveProfile?.snapshot || null,
      hardRequirements: Object.entries(output.assessment.assessments || {}).filter(([, assessment]) => assessment.target && assessment.status === "pass").map(([effect]) => ({ name: effect, text: "达到共同效果范围" })),
      softReasons: output.trace.matchedRules.slice(0, 4).map((ruleId) => ({ name: "规则依据", text: ruleId })),
      implementations: output.trace.matchedRules.slice(0, 4).map((ruleId) => ({ relationName: "规则依据", actionSummary: ruleId })),
      unverified: output.explanation.validation.map((text) => ({ item: "待确认", validation: text, failure: "实物属性与资料不一致" })),
      traceRuleIds: output.trace.matchedRules,
      goalAssessment: { status: "按候选评估", items: [] },
      decisionRecord: output.decisionRecord,
      presentationTier,
      output
    };
  }

  function run(input, ruleSet) {
    if (!runtime?.recommendV3) return { candidates: [], conflicts: [{ reason: "效果等价运行包未加载" }], blocked: [] };
    try {
      const published = JSON.parse(localStorage.getItem(PUBLISHED_RULES_KEY) || "null");
      if (published?.rules) runtime.replaceV3RuleRegistry(published);
    } catch (error) {
      return { candidates: [], conflicts: [{ reason: "效果等价规则资料无法读取" }], blocked: [{ reason: error.message }] };
    }
    const inputFacts = flattenInput(input);
    const productionResult = runtime.recommendV3({ inputFacts, options: { qualityMode: "production" } });
    const referenceResult = runtime.recommendV3({ inputFacts, options: { qualityMode: "reference" } });
    // 前台需要完整的主方案与结构备选，但参考候选不能被冒充为生产主方案。
    // 因此生产结果少于三套时，用参考运行时补足展示位，并在结果元数据中保留降级状态。
    const productionCandidates = productionResult.candidates || [];
    const referenceCandidates = referenceResult.candidates || [];
    const visibleCandidates = productionCandidates.length >= 3
      ? productionCandidates.slice(0, 3)
      : [...productionCandidates, ...referenceCandidates.filter((reference) => {
          const productionIds = new Set(productionCandidates.flatMap((candidate) => candidate.candidate?.evaluation?.componentIds || []));
          const referenceIds = reference.candidate?.evaluation?.componentIds || [];
          return !referenceIds.every((id) => productionIds.has(id));
        })].slice(0, 3);
    const needsFallback = productionCandidates.length < 3;
    const result = {
      ...(productionCandidates.length ? productionResult : referenceResult),
      candidates: visibleCandidates,
      productionStatus: productionResult.status,
      productionCandidateCount: productionCandidates.length,
      classicFallback: needsFallback,
      classicFallbackReason: needsFallback
        ? productionResult.trace?.generated?.insufficientReason || "当前生产主方案不足三套，已补充经典保底备选"
        : null
    };
    return {
      ...result,
      candidates: result.candidates.map((candidate, index) => displayCandidate(
        candidate,
        index,
        ruleSet,
        result.effectProfile?.objective,
        productionCandidates.some((production) => production.id === candidate.id) ? "production" : "classicFallback"
      )),
      conflicts: result.trace?.conflicts || [],
      blocked: result.trace?.blocked || [],
      engineMode: "v3",
      effectProfile: result.effectProfile,
      inputSnapshot: result.inputSnapshot
    };
  }

  global.GarmentV3PrototypeAdapter = { run, flattenInput };
}(window));
