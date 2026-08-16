(function () {
  "use strict";

  const temperatureOptions = [
    { value: "05_12", label: "5-12°C" },
    { value: "10_18", label: "10-18°C" },
    { value: "15_25", label: "15-25°C" },
    { value: "18_24", label: "18-24°C" },
    { value: "24_30", label: "24-30°C" },
    { value: "28_35", label: "28-35°C" }
  ];

  const fiveBands = [
    { value: 0, label: "低" },
    { value: 1, label: "偏低" },
    { value: 2, label: "中等" },
    { value: 3, label: "偏高" },
    { value: 4, label: "高" }
  ];

  const colorTemperatureBands = [
    { value: 0, label: "冷" },
    { value: 1, label: "中间偏冷" },
    { value: 2, label: "中间" },
    { value: 3, label: "中间偏暖" },
    { value: 4, label: "暖" }
  ];

  const trendDirections = [
    {
      id: "TREND-UTILITY-LAYERING",
      value: "utilityLayering",
      name: "轻机能层次",
      enabled: true,
      reference: "城市机能与户外功能设计",
      season: "持续更新",
      coreIdea: "以轻量外层、功能细节和便于活动的层次建立当下感。",
      influences: ["服装路线", "廓形比例", "材质表面", "款式细节"],
      conditions: [{ field: "input.preference.trendDirection", operator: "eq", value: "utilityLayering" }],
      result: {
        families: ["street", "relaxed", "straight"],
        silhouette: "松量层次与短外层结构",
        detail: "功能口袋、可调节结构或轻量叠穿",
        pattern: "低对比拼接或局部功能标识",
        finish: "轻量、耐用或带细微技术感的表面",
        proportion: "外短内长或上松下直",
        detailIntensity: "功能细节作为视觉重点",
        note: "借鉴机能理念，不直接复制单一品牌造型",
        seasonVersion: "持续更新"
      },
      reason: "轻机能层次通过服装路线、松量比例、材质表面和功能细节共同生效。"
    },
    {
      id: "TREND-RELAXED-TAILORING",
      value: "relaxedTailoring",
      name: "松弛剪裁",
      enabled: true,
      reference: "宽松精裁与轻商务设计理念",
      season: "长期方向",
      coreIdea: "保留剪裁完成度，同时放松肩线、腰部和裤腿余量。",
      influences: ["服装路线", "廓形比例", "材质表面", "款式细节"],
      conditions: [{ field: "input.preference.trendDirection", operator: "eq", value: "relaxedTailoring" }],
      result: {
        families: ["tailored", "straight", "relaxed"],
        silhouette: "放松肩线与克制松量",
        detail: "简洁剪裁、低存在感结构线",
        pattern: "纯色或细密纹理",
        finish: "有垂度但不过度挺硬的整洁表面",
        proportion: "略宽上装与顺直下装",
        detailIntensity: "结构细节适中",
        note: "用松量更新传统剪裁，不降低场合完成度",
        seasonVersion: "长期方向"
      },
      reason: "松弛剪裁通过更放松的服装路线、肩线和长度比例改变实际组合。"
    },
    {
      id: "TREND-SHEER-LAYERING",
      value: "sheerLayering",
      name: "轻透叠穿",
      enabled: true,
      reference: "轻薄层次与半透明材质理念",
      season: "春夏方向",
      coreIdea: "利用轻薄、透感和长短层次形成柔和但清楚的视觉结构。",
      influences: ["服装路线", "廓形比例", "材质表面", "款式细节"],
      conditions: [{ field: "input.preference.trendDirection", operator: "eq", value: "sheerLayering" }],
      result: {
        families: ["soft", "relaxed", "straight"],
        silhouette: "轻薄垂落与错层长度",
        detail: "半透明覆盖、柔和开口或轻量叠穿",
        pattern: "同色层次或低对比纹理",
        finish: "轻薄、柔软并带细微透感",
        proportion: "长短错层与柔和纵向线条",
        detailIntensity: "材质层次作为主要细节",
        note: "透感面积需要结合覆盖边界确认",
        seasonVersion: "春夏方向"
      },
      reason: "轻透叠穿主要通过材质、错层长度和柔和服装路线形成效果。"
    }
  ];

  const patternLibrary = [
    { id: "maritimeStripe", name: "海魂条纹", styles: ["casual", "cityboy", "minimal"], placement: "上装", scale: "中等", contrast: "中等" },
    { id: "princeOfWales", name: "威尔士亲王格", styles: ["urban", "retro"], placement: "外层", scale: "细密", contrast: "低" },
    { id: "houndstooth", name: "千鸟格", styles: ["retro", "urban"], placement: "下装", scale: "细密", contrast: "中等" },
    { id: "frenchPolkaDot", name: "法式波点", styles: ["elegant", "retro"], placement: "连身裙", scale: "小", contrast: "中等" },
    { id: "smallFloral", name: "小碎花", styles: ["elegant", "retro"], placement: "连身裙", scale: "小", contrast: "低" }
  ];

  const parameters = [
    {
      id: "context.temperatureRange",
      name: "近期温度",
      group: "温度与场合",
      type: "select",
      required: true,
      enabled: true,
      options: temperatureOptions,
      description: "使用近期最低至最高温度的范围，决定层数、袖长、外层和材质厚度。"
    },
    {
      id: "context.occasion",
      name: "使用场合",
      group: "温度与场合",
      type: "select",
      required: true,
      enabled: true,
      options: [
        { value: "daily", label: "日常" },
        { value: "commute", label: "通勤" },
        { value: "formal", label: "正式" },
        { value: "social", label: "聚会" },
        { value: "travel", label: "出游" }
      ],
      description: "只保留场合中能稳定改变服装正式程度的部分。"
    },
    {
      id: "preference.style",
      name: "风格方向",
      group: "穿着偏好",
      type: "select",
      required: false,
      enabled: true,
      options: [
        { value: "unknown", label: "暂不确定" },
        { value: "minimal", label: "极简" },
        { value: "urban", label: "都市" },
        { value: "elegant", label: "优雅" },
        { value: "casual", label: "休闲" },
        { value: "street", label: "街头" },
        { value: "retro", label: "复古" }
      ],
      description: "决定服装的款式语言；与场合、正式程度分别设置。"
    },
    {
      id: "preference.formality",
      name: "正式程度",
      group: "穿着偏好",
      type: "select",
      required: true,
      enabled: true,
      options: [
        { value: 1, label: "随性" },
        { value: 2, label: "整洁" },
        { value: 3, label: "偏正式" },
        { value: 4, label: "正式" }
      ],
      description: "表达本次希望达到的正式程度；不能低于场合的强制要求。"
    },
    {
      id: "preference.trendDirection",
      name: "潮流方向",
      group: "穿着偏好",
      type: "select",
      required: false,
      enabled: true,
      options: [
        { value: "none", label: "不限定" },
        ...trendDirections.map((item) => ({ value: item.value, label: item.name }))
      ],
      description: "选择可维护的潮流理念；不限定时不强制加入潮流元素。"
    },
    {
      id: "preference.trendIntensity",
      name: "表达强度",
      group: "穿着偏好",
      type: "select",
      required: false,
      enabled: true,
      options: [
        { value: "light", label: "少量借鉴" },
        { value: "clear", label: "明确体现" }
      ],
      description: "只在选定潮流方向后生效。"
    },
    ...["skin", "hair", "eye"].flatMap((part) => {
      const labels = { skin: "肤色", hair: "发色", eye: "瞳色" };
      return [
        {
          id: `appearance.${part}Temperature`,
          name: `${labels[part]}色调`,
          group: "外观色彩",
          type: "scale",
          required: false,
          enabled: true,
          options: colorTemperatureBands,
          description: "色调用于表达个人色彩的冷暖属性，来源可为用户确认或图片推断。"
        },
        {
          id: `appearance.${part}Value`,
          name: `${labels[part]}明度`,
          group: "外观色彩",
          type: "scale",
          required: false,
          enabled: true,
          options: fiveBands,
          description: "0 为深，4 为浅。"
        },
        {
          id: `appearance.${part}Chroma`,
          name: `${labels[part]}彩度`,
          group: "外观色彩",
          type: "scale",
          required: false,
          enabled: true,
          options: fiveBands,
          description: "0 为柔和，4 为鲜明。"
        }
      ];
    }),
    {
      id: "body.heightPresence",
      name: "纵向高度",
      group: "身材比例",
      type: "scale",
      required: false,
      enabled: true,
      options: [
        { value: 0, label: "明显小巧" },
        { value: 1, label: "偏小巧" },
        { value: 2, label: "中等" },
        { value: 3, label: "偏高挑" },
        { value: 4, label: "明显高挑" }
      ],
      description: "原型使用确认后的区间；正式系统可由身高和比例数据计算。"
    },
    {
      id: "body.legRatio",
      name: "腿身分布",
      group: "身材比例",
      type: "scale",
      required: false,
      enabled: true,
      options: [
        { value: 0, label: "上长下短" },
        { value: 1, label: "略上长" },
        { value: 2, label: "均衡" },
        { value: 3, label: "略下长" },
        { value: 4, label: "上短下长" }
      ],
      description: "用于计算身材比例和整体修长感。"
    },
    {
      id: "body.waistDefinition",
      name: "腰线特征",
      group: "身材轮廓",
      type: "scale",
      required: false,
      enabled: true,
      options: [
        { value: 0, label: "不明显" },
        { value: 1, label: "偏弱" },
        { value: 2, label: "中等" },
        { value: 3, label: "较明显" },
        { value: 4, label: "很明显" }
      ],
      description: "描述自然站立时腰部曲线的明显程度，不是腰围粗细，也不代表需要修正。"
    },
    {
      id: "body.shoulderHipBalance",
      name: "横向轮廓",
      group: "身材轮廓",
      type: "scale",
      required: false,
      enabled: true,
      options: [
        { value: 0, label: "肩部明显" },
        { value: 1, label: "肩部略明显" },
        { value: 2, label: "肩胯接近" },
        { value: 3, label: "胯部略明显" },
        { value: 4, label: "胯部明显" }
      ],
      description: "只描述肩部与胯部的轮廓关系，不与腰线或脸型混合。"
    },
    {
      id: "face.shape",
      name: "脸型",
      group: "脸型",
      type: "select",
      required: false,
      enabled: true,
      options: [
        { value: "unknown", label: "暂不确定" },
        { value: "long", label: "长脸" },
        { value: "round", label: "圆脸" },
        { value: "square", label: "方脸" },
        { value: "standard", label: "标准脸" },
        { value: "heart", label: "心形脸" },
        { value: "diamond", label: "菱形脸" }
      ],
      description: "只用于领口和脸部周边细节的参考，不影响身材判断和硬性筛选。"
    },
    {
      id: "goal.endpoint",
      name: "本次调整目标",
      group: "本次偏好",
      type: "select",
      required: false,
      enabled: true,
      options: [
        { value: "unknown", label: "暂不确定" },
        { value: "vertical", label: "整体修长感" },
        { value: "waist", label: "腰线表现" },
        { value: "volume", label: "肩胯轮廓关系" },
        { value: "contrast", label: "配色对比" }
      ],
      description: "目标可以为空，不会阻止系统给出候选。"
    },
    {
      id: "goal.direction",
      name: "目标调整方向",
      group: "本次偏好",
      type: "select",
      required: false,
      enabled: true,
      options: [
        { value: "keep", label: "保留" },
        { value: "strengthen", label: "强化" },
        { value: "weaken", label: "弱化" },
        { value: "balance", label: "平衡" }
      ],
      description: "已经具备的特征仍然可以继续强化。"
    },
    ...[
      ["boundaries.rejectSkirt", "拒绝裙装"],
      ["boundaries.rejectDefinedWaist", "拒绝明显收腰"],
      ["boundaries.rejectHighContrast", "拒绝高对比配色"],
      ["boundaries.strictCoverage", "需要完整覆盖"],
      ["boundaries.movementFriendly", "行动不能受限"],
      ["boundaries.sensitiveTexture", "避免粗糙触感"]
    ].map(([id, name]) => ({
      id,
      name,
      group: "明确拒绝与身体边界",
      type: "boolean",
      required: false,
      enabled: true,
      description: "明确拒绝和身体边界属于硬性条件。"
    }))
  ];

  const derivedRules = [
    {
      id: "DERIVED-COLOR-TEMPERATURE",
      name: "计算整体色彩冷暖",
      enabled: true,
      priority: 500,
      operation: "weightedAverage",
      output: "color.temperature",
      inputs: [
        { field: "appearance.skinTemperature", weight: 0.5 },
        { field: "appearance.hairTemperature", weight: 0.3 },
        { field: "appearance.eyeTemperature", weight: 0.2 }
      ],
      bands: [
        { max: 0.79, label: "冷" },
        { max: 1.59, label: "中间偏冷" },
        { max: 2.39, label: "中间" },
        { max: 3.19, label: "中间偏暖" },
        { max: 4, label: "暖" }
      ],
      reason: "综合肤色、发色和眼睛颜色的冷暖关系。"
    },
    {
      id: "DERIVED-COLOR-CONTRAST",
      name: "计算外观深浅对比",
      enabled: true,
      priority: 500,
      operation: "range",
      output: "color.contrast",
      inputs: [
        { field: "appearance.skinValue", weight: 1 },
        { field: "appearance.hairValue", weight: 1 },
        { field: "appearance.eyeValue", weight: 1 }
      ],
      bands: [
        { max: 0.99, label: "低" },
        { max: 2.49, label: "中等" },
        { max: 4, label: "高" }
      ],
      reason: "取肤色、发色和眼睛颜色明度之间的最大差值。"
    },
    {
      id: "DERIVED-COLOR-CHROMA",
      name: "计算整体彩度",
      enabled: true,
      priority: 500,
      operation: "weightedAverage",
      output: "color.chroma",
      inputs: [
        { field: "appearance.skinChroma", weight: 0.5 },
        { field: "appearance.hairChroma", weight: 0.25 },
        { field: "appearance.eyeChroma", weight: 0.25 }
      ],
      bands: [
        { max: 0.99, label: "低" },
        { max: 2.49, label: "中等" },
        { max: 4, label: "高" }
      ],
      reason: "综合肤色、发色和眼睛颜色的鲜明程度。"
    },
    {
      id: "DERIVED-BODY-SLENDERNESS",
      name: "计算整体修长感",
      enabled: true,
      priority: 480,
      operation: "weightedAverage",
      output: "body.slenderness",
      inputs: [
        { field: "body.heightPresence", weight: 0.55 },
        { field: "body.legRatio", weight: 0.45 }
      ],
      bands: [
        { max: 0.99, label: "小巧" },
        { max: 2.49, label: "中等" },
        { max: 4, label: "修长" }
      ],
      reason: "综合身高表现与腿身比例，只描述当前整体修长感。"
    },
    {
      id: "DERIVED-BODY-RATIO",
      name: "确认身材比例",
      enabled: true,
      priority: 470,
      operation: "passthrough",
      output: "body.proportion",
      inputs: [{ field: "body.legRatio", weight: 1 }],
      bands: [
        { max: 0.49, label: "上长下短" },
        { max: 1.49, label: "略上长" },
        { max: 2.49, label: "均衡" },
        { max: 3.49, label: "略下长" },
        { max: 4, label: "上短下长" }
      ],
      reason: "由确认后的腿身比例得到。"
    },
    {
      id: "DERIVED-BODY-WAIST",
      name: "确认腰线明显程度",
      enabled: true,
      priority: 470,
      operation: "passthrough",
      output: "body.waistDefinition",
      inputs: [{ field: "body.waistDefinition", weight: 1 }],
      bands: [
        { max: 0.49, label: "不明显" },
        { max: 1.49, label: "偏弱" },
        { max: 2.49, label: "中等" },
        { max: 3.49, label: "较明显" },
        { max: 4, label: "很明显" }
      ],
      reason: "保留已确认的腰部关系。"
    },
    {
      id: "DERIVED-BODY-SHOULDER-HIP",
      name: "确认肩胯轮廓关系",
      enabled: true,
      priority: 470,
      operation: "passthrough",
      output: "body.shoulderHipBalance",
      inputs: [{ field: "body.shoulderHipBalance", weight: 1 }],
      bands: [
        { max: 0.49, label: "肩部明显" },
        { max: 1.49, label: "肩部略明显" },
        { max: 2.49, label: "肩胯接近" },
        { max: 3.49, label: "胯部略明显" },
        { max: 4, label: "胯部明显" }
      ],
      reason: "保留已确认的肩胯轮廓关系，不与腰线重复计算。"
    },
    {
      id: "DERIVED-BODY-SHAPE",
      name: "归纳身材轮廓",
      enabled: true,
      priority: 460,
      operation: "bodyShape",
      output: "body.shape",
      inputs: [
        { field: "body.waistDefinition", weight: 1 },
        { field: "body.shoulderHipBalance", weight: 1 }
      ],
      bands: [
        { max: 0, label: "H 型" },
        { max: 1, label: "O 型" },
        { max: 2, label: "X 型" },
        { max: 3, label: "A 型" },
        { max: 4, label: "Y 型" }
      ],
      reason: "根据腰线明显程度和肩胯关系归纳为沟通用身材轮廓标签。"
    }
  ];

  const colorLibrary = [
    ["COLOR-SOFT-WHITE", "柔白", "#F2F0EA", "中间", "高", "低", ["nearFace", "main", "secondary"]],
    ["COLOR-COOL-WHITE", "冷白", "#F4F6F5", "中间偏冷", "高", "低", ["nearFace", "main"]],
    ["COLOR-IVORY", "象牙白", "#F0E5CE", "中间偏暖", "高", "低", ["nearFace", "main"]],
    ["COLOR-MIST-BLUE", "雾蓝", "#91AEB8", "中间偏冷", "中等", "中等", ["main", "secondary"]],
    ["COLOR-MIST-PURPLE", "雾紫", "#9A8EAA", "中间偏冷", "中等", "中等", ["nearFace", "main", "secondary"]],
    ["COLOR-CHARCOAL", "深灰", "#3F4548", "中间", "低", "低", ["main", "secondary"]],
    ["COLOR-PEARL-GRAY", "浅灰", "#C9CDCB", "中间", "高", "低", ["main", "secondary"]],
    ["COLOR-NAVY", "藏蓝", "#263746", "中间偏冷", "低", "中等", ["main", "secondary"]],
    ["COLOR-SAGE", "鼠尾草绿", "#9EA995", "中间偏暖", "中等", "低", ["main", "secondary"]],
    ["COLOR-CAMEL", "浅驼", "#B68F68", "暖", "中等", "中等", ["main", "secondary"]],
    ["COLOR-BRICK", "砖红", "#A75845", "暖", "中等", "高", ["main", "accent"]],
    ["COLOR-BURGUNDY", "酒红", "#743A45", "中间偏暖", "低", "高", ["main", "accent"]]
  ].map(([id, name, hex, temperature, lightness, chroma, roles]) => ({
    id, name, hex, temperature, lightness, chroma, roles, enabled: true,
    note: "实际商品颜色受光线、面料和屏幕显示影响，仍需实物确认。"
  }));

  const palettePlans = [
    {
      id: "PALETTE-COOL-SOFT",
      name: "柔白 + 雾蓝 + 深灰",
      enabled: true,
      temperature: "中间偏冷",
      contrast: "中等",
      chroma: "中等",
      roles: [
        { role: "nearFace", colorId: "COLOR-SOFT-WHITE", ratio: 40 },
        { role: "main", colorId: "COLOR-MIST-BLUE", ratio: 35 },
        { role: "secondary", colorId: "COLOR-CHARCOAL", ratio: 25 }
      ],
      reason: "柔白放在近脸位置保留明亮感，雾蓝承接偏冷方向，深灰提供适中的深浅层次。",
      validation: "确认近脸柔白不显灰，雾蓝在实际面料上不过暗。"
    },
    {
      id: "PALETTE-COOL-CLEAR",
      name: "冷白 + 藏蓝 + 雾紫",
      enabled: true,
      temperature: "冷",
      contrast: "高",
      chroma: "中等",
      roles: [
        { role: "nearFace", colorId: "COLOR-COOL-WHITE", ratio: 35 },
        { role: "main", colorId: "COLOR-NAVY", ratio: 45 },
        { role: "accent", colorId: "COLOR-MIST-PURPLE", ratio: 20 }
      ],
      reason: "冷白与藏蓝形成清楚的明度差，雾紫作为小面积点缀，不扩大整体彩度。",
      validation: "确认冷白不会显得生硬，并检查藏蓝与雾紫的实物色差。"
    },
    {
      id: "PALETTE-NEUTRAL-SOFT",
      name: "柔白 + 浅灰 + 深灰",
      enabled: true,
      temperature: "中间",
      contrast: "低",
      chroma: "低",
      roles: [
        { role: "nearFace", colorId: "COLOR-SOFT-WHITE", ratio: 40 },
        { role: "main", colorId: "COLOR-PEARL-GRAY", ratio: 40 },
        { role: "secondary", colorId: "COLOR-CHARCOAL", ratio: 20 }
      ],
      reason: "柔白与浅灰保持低彩度，少量深灰用于区分层次，整体不会产生过强色差。",
      validation: "确认灰色在自然光下不偏绿或偏紫。"
    },
    {
      id: "PALETTE-WARM-SOFT",
      name: "象牙白 + 鼠尾草绿 + 浅驼",
      enabled: true,
      temperature: "中间偏暖",
      contrast: "中等",
      chroma: "低",
      roles: [
        { role: "nearFace", colorId: "COLOR-IVORY", ratio: 40 },
        { role: "main", colorId: "COLOR-SAGE", ratio: 35 },
        { role: "secondary", colorId: "COLOR-CAMEL", ratio: 25 }
      ],
      reason: "象牙白保留温和亮度，鼠尾草绿和彩度较低的浅驼共同维持偏暖但不过艳的关系。",
      validation: "确认象牙白不偏黄，浅驼与肤色之间仍有足够区分。"
    },
    {
      id: "PALETTE-WARM-CLEAR",
      name: "象牙白 + 砖红 + 酒红",
      enabled: true,
      temperature: "暖",
      contrast: "高",
      chroma: "高",
      roles: [
        { role: "nearFace", colorId: "COLOR-IVORY", ratio: 35 },
        { role: "main", colorId: "COLOR-BRICK", ratio: 45 },
        { role: "accent", colorId: "COLOR-BURGUNDY", ratio: 20 }
      ],
      reason: "象牙白提供明度，砖红与酒红形成暖色层次，适用于希望保留较鲜明视觉重点的情况。",
      validation: "确认砖红面积不会让整体显得过重，并核对酒红实际彩度。"
    },
    {
      id: "PALETTE-COOL-SOFT-PURPLE",
      name: "冷白 + 雾紫 + 深灰",
      enabled: true,
      temperature: "中间偏冷",
      contrast: "中等",
      chroma: "中等",
      roles: [
        { role: "nearFace", colorId: "COLOR-COOL-WHITE", ratio: 40 },
        { role: "main", colorId: "COLOR-MIST-PURPLE", ratio: 35 },
        { role: "secondary", colorId: "COLOR-CHARCOAL", ratio: 25 }
      ],
      reason: "冷白保持近脸位置清爽，雾紫替代雾蓝形成另一条偏冷路线，深灰控制整体色彩强度。",
      validation: "确认雾紫在实际面料上不偏红，深灰与主体颜色仍有清楚层次。"
    },
    {
      id: "PALETTE-COOL-CLEAR-CHARCOAL",
      name: "冷白 + 深灰 + 雾蓝",
      enabled: true,
      temperature: "冷",
      contrast: "高",
      chroma: "中等",
      roles: [
        { role: "nearFace", colorId: "COLOR-COOL-WHITE", ratio: 35 },
        { role: "main", colorId: "COLOR-CHARCOAL", ratio: 45 },
        { role: "accent", colorId: "COLOR-MIST-BLUE", ratio: 20 }
      ],
      reason: "冷白与深灰建立明显深浅差，雾蓝作为小面积冷色补充，保持高对比但不过分鲜艳。",
      validation: "确认深灰不会接近纯黑，并核对雾蓝在当前光线下的实际色相。"
    },
    {
      id: "PALETTE-NEUTRAL-SOFT-SAGE",
      name: "柔白 + 浅灰 + 鼠尾草绿",
      enabled: true,
      temperature: "中间",
      contrast: "低",
      chroma: "低",
      roles: [
        { role: "nearFace", colorId: "COLOR-SOFT-WHITE", ratio: 40 },
        { role: "main", colorId: "COLOR-PEARL-GRAY", ratio: 35 },
        { role: "secondary", colorId: "COLOR-SAGE", ratio: 25 }
      ],
      reason: "柔白和浅灰维持低对比，低彩度鼠尾草绿提供轻微变化，不改变整体柔和程度。",
      validation: "确认鼠尾草绿与浅灰不会在实际面料上混成同一层次。"
    },
    {
      id: "PALETTE-WARM-BALANCED-CAMEL",
      name: "象牙白 + 浅驼 + 酒红",
      enabled: true,
      temperature: "中间偏暖",
      contrast: "中等",
      chroma: "中等",
      roles: [
        { role: "nearFace", colorId: "COLOR-IVORY", ratio: 45 },
        { role: "main", colorId: "COLOR-CAMEL", ratio: 35 },
        { role: "accent", colorId: "COLOR-BURGUNDY", ratio: 20 }
      ],
      reason: "象牙白与浅驼保持偏暖基调，少量酒红增加层次，整体控制在中等对比和彩度。",
      validation: "确认酒红只作为小面积重点，并核对浅驼与肤色之间的区分。"
    },
    {
      id: "PALETTE-WARM-BALANCED-SAGE",
      name: "象牙白 + 鼠尾草绿 + 砖红",
      enabled: true,
      temperature: "中间偏暖",
      contrast: "中等",
      chroma: "中等",
      roles: [
        { role: "nearFace", colorId: "COLOR-IVORY", ratio: 45 },
        { role: "main", colorId: "COLOR-SAGE", ratio: 35 },
        { role: "accent", colorId: "COLOR-BRICK", ratio: 20 }
      ],
      reason: "象牙白承接近脸亮度，鼠尾草绿降低刺激感，少量砖红让偏暖配色更有重点。",
      validation: "确认砖红面积受控，并检查鼠尾草绿在实物上不会明显偏冷。"
    },
    {
      id: "PALETTE-WARM-BALANCED-GRAY",
      name: "柔白 + 浅驼 + 深灰",
      enabled: true,
      temperature: "中间偏暖",
      contrast: "中等",
      chroma: "中等",
      roles: [
        { role: "nearFace", colorId: "COLOR-SOFT-WHITE", ratio: 40 },
        { role: "main", colorId: "COLOR-CAMEL", ratio: 35 },
        { role: "secondary", colorId: "COLOR-CHARCOAL", ratio: 25 }
      ],
      reason: "柔白与浅驼建立温和底色，深灰负责压住整体并形成适中的明暗层次。",
      validation: "确认深灰不是偏蓝灰，并检查柔白与浅驼组合不会显黄。"
    },
    {
      id: "PALETTE-WARM-CLEAR-CAMEL",
      name: "象牙白 + 浅驼 + 砖红",
      enabled: true,
      temperature: "暖",
      contrast: "高",
      chroma: "高",
      roles: [
        { role: "nearFace", colorId: "COLOR-IVORY", ratio: 35 },
        { role: "main", colorId: "COLOR-BRICK", ratio: 45 },
        { role: "accent", colorId: "COLOR-CAMEL", ratio: 20 }
      ],
      reason: "象牙白与砖红形成清楚的暖色对比，浅驼衔接两者，适合需要鲜明暖色重点的方向。",
      validation: "确认砖红适合大面积使用，并在自然光下核对整体暖度。"
    }
  ];

  const resultFields = [
    { id: "requirements.layerCount", name: "推荐层数", group: "温度与覆盖", valueType: "number", options: [[1, "1 层"], [2, "2 层"], [3, "3 层"]], actions: ["SET"] },
    { id: "requirements.sleeve", name: "推荐袖长", group: "温度与覆盖", options: [["short", "短袖"], ["threeQuarter", "七分袖"], ["long", "长袖"]], actions: ["SET", "REQUIRE"] },
    { id: "requirements.outer", name: "推荐外层", group: "温度与覆盖", options: [["none", "无外层"], ["light", "可脱轻外层"], ["warm", "保暖外层"]], actions: ["SET", "REQUIRE"] },
    { id: "requirements.coverage", name: "身体覆盖程度", group: "温度与覆盖", options: [["light", "轻覆盖"], ["regular", "适中覆盖"], ["full", "完整覆盖"]], actions: ["SET", "REQUIRE"] },
    { id: "requirements.material", name: "材质厚薄表现", group: "温度与覆盖", valueType: "text", actions: ["SET", "ADD"] },
    { id: "requirements.formalityMin", name: "最低正式程度", group: "场合", valueType: "number", options: [[1, "自然"], [2, "整洁"], [3, "正式"], [4, "高度正式"]], actions: ["SET", "REQUIRE"] },
    { id: "requirements.movement", name: "行动便利", group: "身体边界", valueType: "boolean", options: [[true, "必须便利"], [false, "无额外要求"]], actions: ["SET", "REQUIRE"] },
    { id: "requirements.texture", name: "贴肤触感", group: "身体边界", options: [["regular", "常规"], ["smooth", "避免粗糙"]], actions: ["SET", "REQUIRE"] },
    { id: "requirements.waist", name: "推荐服装腰位", group: "服装版型", options: [["natural", "自然腰位"], ["raised", "偏高腰位"], ["defined", "明确腰线"]], actions: ["SET", "REQUIRE"] },
    { id: "requirements.line", name: "服装线条走向", group: "服装版型", options: [["balanced", "自然线条"], ["continuous", "纵向连贯"], ["sectioned", "分段层次"]], actions: ["SET"] },
    { id: "requirements.colorTemperature", name: "服装冷暖属性", group: "配色", options: colorTemperatureBands.map((item) => [item.label, item.label]), actions: ["SET"] },
    { id: "requirements.colorContrast", name: "配色明度对比", group: "配色", options: [["低", "低"], ["中等", "中等"], ["高", "高"]], actions: ["SET"] },
    { id: "requirements.colorContrastMax", name: "配色对比上限", group: "配色", options: [["低", "不高于低"], ["中等", "不高于中等"], ["高", "不限制"]], actions: ["SET"] },
    { id: "requirements.colorChroma", name: "配色彩度", group: "配色", options: [["低", "低"], ["中等", "中等"], ["高", "高"]], actions: ["SET"] },
    { id: "requirements.palettePlanId", name: "优先配色方案", group: "配色", options: palettePlans.map((item) => [item.id, item.name]), actions: ["SET", "REPLACE"] },
    { id: "requirements.neckline", name: "推荐领口方向", group: "身材与脸型适配", valueType: "text", actions: ["SET", "ADD"] },
    { id: "requirements.faceEffect", name: "脸型配合说明", group: "身材与脸型适配", valueType: "text", actions: ["SET", "ADD"] },
    { id: "preferences.family", name: "优先服装路线", group: "候选排序", options: [["straight", "连续直线"], ["soft", "柔和过渡"], ["relaxed", "自然留量"], ["tailored", "利落结构"]], actions: ["BOOST", "ADD"] },
    { id: "candidate.bottomType", name: "下装类型", group: "排除条件", options: [["trouser", "裤装"], ["skirt", "裙装"], ["short", "短裤"]], actions: ["FORBID", "FILTER"] },
    { id: "notes", name: "结果备注", group: "结果说明", valueType: "text", actions: ["ADD"] }
  ];

  const derivedFieldDefinitions = [
    ["derived.color.temperature.label", "整体冷暖倾向", ["冷", "中间偏冷", "中间", "中间偏暖", "暖"]],
    ["derived.color.contrast.label", "外观明度对比", ["低", "中等", "高"]],
    ["derived.color.chroma.label", "整体彩度", ["低", "中等", "高"]],
    ["derived.body.slenderness.label", "整体修长表现", ["小巧", "中等", "修长"]],
    ["derived.body.proportion.label", "上下身比例", ["上长下短", "略上长", "均衡", "略下长", "上短下长"]],
    ["derived.body.waistDefinition.label", "腰部曲线明显度", ["不明显", "偏弱", "中等", "较明显", "很明显"]],
    ["derived.body.shoulderHipBalance.label", "肩胯轮廓关系", ["肩部明显", "肩部略明显", "肩胯接近", "胯部略明显", "胯部明显"]],
    ["derived.body.shape.label", "身材轮廓", ["H 型", "O 型", "X 型", "A 型", "Y 型"]]
  ].map(([id, name, values]) => ({ id, name, group: "分析结果", options: values.map((value) => [value, value]) }));

  const conditionFields = [
    ...parameters.map((parameter) => ({
      id: `input.${parameter.id}`,
      name: parameter.name,
      group: parameter.group,
      valueType: parameter.type === "boolean" ? "boolean" : "select",
      options: parameter.type === "boolean"
        ? [[true, "是"], [false, "否"]]
        : (parameter.options || []).map((item) => [item.value, item.label])
    })),
    ...derivedFieldDefinitions
  ];

  // The case runner and the rules workbench share these stable group ids.
  // Labels can change without changing the input/result field contract.
  const inputGroups = [
    {
      id: "context",
      name: "场景条件",
      order: 1,
      description: "先确定温度与使用场合，决定穿着层数和正式程度。",
      fields: ["context.temperatureRange", "context.occasion"]
    },
    {
      id: "personal",
      name: "个人特征",
      order: 2,
      description: "外观色彩、身材情况和脸型是并列事实，不把身材归入脸型。",
      fields: [
        "appearance.skinTemperature", "appearance.skinValue", "appearance.skinChroma",
        "appearance.hairTemperature", "appearance.hairValue", "appearance.hairChroma",
        "appearance.eyeTemperature", "appearance.eyeValue", "appearance.eyeChroma",
        "body.heightPresence", "body.legRatio", "body.waistDefinition", "body.shoulderHipBalance",
        "face.shape"
      ]
    },
    {
      id: "preference",
      name: "风格偏好",
      order: 3,
      description: "表达用户想要的风格、正式程度和潮流参与方式。",
      fields: ["preference.style", "preference.formality", "preference.trendDirection", "preference.trendIntensity"]
    },
    {
      id: "goal-boundaries",
      name: "本次目标与边界",
      order: 4,
      description: "本次想调整的方向与不可接受条件，边界优先级高于偏好。",
      fields: [
        "goal.endpoint", "goal.direction",
        "boundaries.rejectSkirt", "boundaries.rejectDefinedWaist", "boundaries.rejectHighContrast",
        "boundaries.strictCoverage", "boundaries.movementFriendly", "boundaries.sensitiveTexture"
      ]
    }
  ];

  const inputGroupByField = Object.fromEntries(inputGroups.flatMap((group) => group.fields.map((field) => [field, group.id])));
  parameters.forEach((parameter) => {
    parameter.groupId = inputGroupByField[parameter.id] || "context";
  });
  conditionFields.forEach((field) => {
    const inputId = field.id.replace(/^input\./, "");
    field.groupId = inputGroupByField[inputId] || "derived";
  });

  const resultGroupMap = {
    "温度与覆盖": "context",
    "场合": "context",
    "身体边界": "goal-boundaries",
    "服装版型": "personal",
    "配色": "personal",
    "身材与脸型适配": "personal",
    "候选排序": "preference",
    "排除条件": "goal-boundaries",
    "结果说明": "goal-boundaries"
  };
  resultFields.forEach((field) => {
    field.groupId = resultGroupMap[field.group] || "personal";
  });

  const fieldMappings = [
    {
      inputId: "context.temperatureRange",
      conditionFields: ["input.context.temperatureRange"],
      resultFields: ["requirements.layerCount", "requirements.sleeve", "requirements.outer", "requirements.coverage", "requirements.material"],
      illustrationFields: ["illustration.layerCount", "illustration.layers"]
    },
    {
      inputId: "context.occasion",
      conditionFields: ["input.context.occasion"],
      resultFields: ["requirements.formalityMin", "requirements.movement", "requirements.material"],
      illustrationFields: ["illustration.layers"]
    },
    {
      inputId: "personal.body",
      conditionFields: ["input.body.heightPresence", "input.body.legRatio", "input.body.waistDefinition", "input.body.shoulderHipBalance"],
      resultFields: ["requirements.line", "requirements.waist", "preferences.family"],
      illustrationFields: ["illustration.silhouette", "illustration.waist", "illustration.line"]
    },
    {
      inputId: "personal.face",
      conditionFields: ["input.face.shape"],
      resultFields: ["requirements.neckline", "requirements.faceEffect"],
      illustrationFields: ["illustration.neckline", "illustration.layers"]
    },
    {
      inputId: "personal.appearance",
      conditionFields: ["input.appearance.skinTemperature", "input.appearance.skinValue", "input.appearance.skinChroma", "input.appearance.hairTemperature", "input.appearance.hairValue", "input.appearance.hairChroma", "input.appearance.eyeTemperature", "input.appearance.eyeValue", "input.appearance.eyeChroma"],
      resultFields: ["requirements.colorTemperature", "requirements.colorContrast", "requirements.colorChroma", "requirements.palettePlanId"],
      illustrationFields: ["illustration.layers"]
    },
    {
      inputId: "preference.style",
      conditionFields: ["input.preference.style", "input.preference.formality", "input.preference.trendDirection", "input.preference.trendIntensity"],
      resultFields: ["preferences.family", "requirements.silhouette", "requirements.detail", "requirements.trend"],
      illustrationFields: ["illustration.silhouette", "illustration.layers"]
    },
    {
      inputId: "goal-boundaries",
      conditionFields: ["input.goal.endpoint", "input.goal.direction", "derived.body.slenderness.label", "derived.body.proportion.label", "derived.color.contrast.label", "input.boundaries.rejectSkirt", "input.boundaries.rejectDefinedWaist", "input.boundaries.rejectHighContrast", "input.boundaries.strictCoverage", "input.boundaries.movementFriendly", "input.boundaries.sensitiveTexture"],
      resultFields: ["requirements.waist", "requirements.line", "requirements.colorContrast", "requirements.colorContrastMax", "requirements.coverage", "requirements.movement", "requirements.texture", "preferences.family", "candidate.bottomType", "notes"],
      illustrationFields: ["illustration.waist", "illustration.line", "illustration.layers"]
    }
  ];

  const operatorDictionary = {
    actions: {
      SET: "设置为",
      ADD: "增加",
      REQUIRE: "必须包含",
      FORBID: "排除",
      FILTER: "不推荐",
      REPLACE: "替换为",
      BOOST: "优先推荐"
    },
    operators: { eq: "等于", neq: "不等于", gt: "大于", gte: "大于等于", lt: "小于", lte: "小于等于" },
    roles: { nearFace: "近脸色", main: "主色", secondary: "辅助色", accent: "点缀色" }
  };

  const outfitOutputs = [
    {
      id: "OUTFIT-STYLE-MINIMAL",
      name: "极简服装搭配",
      enabled: true,
      group: "风格方向",
      conditions: [{ field: "input.preference.style", operator: "eq", value: "minimal" }],
      result: { family: "straight", families: ["straight", "tailored", "soft"], silhouette: "简洁直线", detail: "少装饰、结构清楚", pattern: "纯色或低存在感纹理" },
      reason: "极简方向优先简洁直线、少装饰和清楚结构。"
    },
    {
      id: "OUTFIT-STYLE-URBAN",
      name: "都市服装搭配",
      enabled: true,
      group: "风格方向",
      conditions: [{ field: "input.preference.style", operator: "eq", value: "urban" }],
      result: { family: "tailored", families: ["tailored", "straight", "soft"], silhouette: "利落结构", detail: "简洁但有完成度", pattern: "纯色或细密纹理" },
      reason: "都市方向优先利落结构、整洁表面和清晰完成度。"
    },
    {
      id: "OUTFIT-STYLE-ELEGANT",
      name: "优雅服装搭配",
      enabled: true,
      group: "风格方向",
      conditions: [{ field: "input.preference.style", operator: "eq", value: "elegant" }],
      result: { family: "soft", families: ["soft", "tailored", "straight"], silhouette: "柔和收放", detail: "柔和领型与克制装饰", pattern: "细腻纹理" },
      reason: "优雅方向优先柔和收放、细腻表面和克制细节。"
    },
    {
      id: "OUTFIT-STYLE-CASUAL",
      name: "休闲服装搭配",
      enabled: true,
      group: "风格方向",
      conditions: [{ field: "input.preference.style", operator: "eq", value: "casual" }],
      result: { family: "relaxed", families: ["relaxed", "soft", "straight"], silhouette: "自然留量", detail: "实用细节", pattern: "低对比纹理" },
      reason: "休闲方向优先自然留量、活动便利和低负担细节。"
    },
    {
      id: "OUTFIT-STYLE-STREET",
      name: "街头服装搭配",
      enabled: true,
      group: "风格方向",
      conditions: [{ field: "input.preference.style", operator: "eq", value: "street" }],
      result: { family: "street", families: ["street", "relaxed", "straight"], silhouette: "宽松箱型", detail: "口袋、拼接或层次细节", pattern: "可使用图案重点" },
      reason: "街头方向优先宽松箱型、层次感和更明确的款式细节。"
    },
    {
      id: "OUTFIT-STYLE-RETRO",
      name: "复古服装搭配",
      enabled: true,
      group: "风格方向",
      conditions: [{ field: "input.preference.style", operator: "eq", value: "retro" }],
      result: { family: "retro", families: ["retro", "soft", "tailored"], silhouette: "有年代感的收放", detail: "领型、纽扣或褶裥重点", pattern: "允许格纹或复古纹理" },
      reason: "复古方向通过领型、收放关系和纹理建立年代感。"
    },
    ...[
      [1, "随性完成度", 1, "柔软或自然表面"],
      [2, "整洁完成度", 2, "表面整洁、结构适中"],
      [3, "偏正式完成度", 3, "结构清楚、细节克制"],
      [4, "正式完成度", 4, "结构完整、表面精细"]
    ].map(([value, name, formality, finish]) => ({
      id: `OUTFIT-FORMALITY-${value}`,
      name,
      enabled: true,
      group: "正式程度",
      conditions: [{ field: "input.preference.formality", operator: "eq", value }],
      result: { formality, finish },
      reason: `用户本次选择${name.replace("完成度", "")}，服装结构和表面完成度相应调整。`
    })),
  ];

  const decisionRules = [
    ...[
      ["05_12", 3, "long", "warm", "full", "保暖中等厚度", "5-12°C 需要三层、长袖和保暖外层。"],
      ["10_18", 2, "long", "light", "full", "轻至中等厚度", "10-18°C 需要两层和可脱轻外层。"],
      ["15_25", 2, "long", "light", "full", "轻薄可叠穿", "15-25°C 温差较大，保留可脱轻外层。"],
      ["18_24", 1, "threeQuarter", "none", "regular", "轻薄", "18-24°C 优先轻薄单层和适中覆盖。"],
      ["24_30", 1, "short", "none", "regular", "轻薄透气", "24-30°C 使用短袖单层和轻薄材质。"],
      ["28_35", 1, "short", "none", "light", "极轻薄透气", "28-35°C 使用极轻薄单层并减少覆盖。"]
    ].map(([range, layers, sleeve, outer, coverage, material, reason], index) => ({
      id: `TEMP-${range}`,
      name: `${temperatureOptions.find((item) => item.value === range).label} 穿着要求`,
      group: "温度",
      enabled: true,
      kind: "hard",
      priority: 800 - index,
      conditions: [{ field: "input.context.temperatureRange", operator: "eq", value: range }],
      actions: [
        { type: "SET", field: "requirements.layerCount", value: layers },
        { type: "SET", field: "requirements.sleeve", value: sleeve },
        { type: "SET", field: "requirements.outer", value: outer },
        { type: "SET", field: "requirements.coverage", value: coverage },
        { type: "SET", field: "requirements.material", value: material }
      ],
      reason
    })),
    ...[
      ["daily", 1, false, "日常场合允许自然、放松的完成度。"],
      ["commute", 2, false, "通勤场合需要整洁并保留一定正式度。"],
      ["formal", 3, false, "正式场合要求较高的结构和完成度。"],
      ["social", 2, false, "聚会场合允许适度增加视觉重点。"],
      ["travel", 1, true, "出游场合优先保证行动便利。"]
    ].map(([occasion, formality, movement, reason], index) => ({
      id: `OCCASION-${occasion.toUpperCase()}`,
      name: `${parameters[1].options.find((item) => item.value === occasion).label}场合要求`,
      group: "场合",
      enabled: true,
      kind: occasion === "formal" ? "hard" : "soft",
      priority: 700 - index,
      conditions: [{ field: "input.context.occasion", operator: "eq", value: occasion }],
      actions: [
        { type: "SET", field: "requirements.formalityMin", value: formality },
        ...(movement ? [{ type: "REQUIRE", field: "requirements.movement", value: true }] : [])
      ],
      reason
    })),
    ...colorTemperatureBands.map((band, index) => ({
      id: `COLOR-TEMP-${index}`,
      name: `${band.label}服装冷暖属性`,
      group: "色彩",
      enabled: true,
      kind: "soft",
      priority: 350,
      conditions: [{ field: "derived.color.temperature.label", operator: "eq", value: band.label }],
      actions: [
        { type: "SET", field: "requirements.colorTemperature", value: band.label },
        {
          type: "SET",
          field: "requirements.palettePlanId",
          value: ["PALETTE-COOL-CLEAR", "PALETTE-COOL-SOFT", "PALETTE-NEUTRAL-SOFT", "PALETTE-WARM-SOFT", "PALETTE-WARM-CLEAR"][index]
        }
      ],
      reason: `整体色彩冷暖为${band.label}，先从同方向的配色方案中选择，再结合明度对比和彩度调整。`
    })),
    ...["低", "中等", "高"].map((label) => ({
      id: `COLOR-CONTRAST-${label === "低" ? "LOW" : label === "高" ? "HIGH" : "MEDIUM"}`,
      name: `${label}深浅对比倾向`,
      group: "色彩",
      enabled: true,
      kind: "soft",
      priority: 340,
      conditions: [{ field: "derived.color.contrast.label", operator: "eq", value: label }],
      actions: [{ type: "SET", field: "requirements.colorContrast", value: label }],
      reason: `外观深浅对比为${label}，服装对比先按相近强度生成。`
    })),
    ...["低", "中等", "高"].map((label) => ({
      id: `COLOR-CHROMA-${label === "低" ? "LOW" : label === "高" ? "HIGH" : "MEDIUM"}`,
      name: `${label}彩度倾向`,
      group: "色彩",
      enabled: true,
      kind: "soft",
      priority: 330,
      conditions: [{ field: "derived.color.chroma.label", operator: "eq", value: label }],
      actions: [{ type: "SET", field: "requirements.colorChroma", value: label }],
      reason: `整体彩度为${label}，服装颜色鲜明程度先按相近强度生成。`
    })),
    ...[
      ["long", "长脸", "横向开阔领口", "长脸优先使用横向或开阔领口，避免继续拉长脸部视觉。"],
      ["round", "圆脸", "纵向开口领口", "圆脸优先使用有纵向开口的领口，减少脸部视觉的圆润感。"],
      ["square", "方脸", "柔和曲线领口", "方脸优先使用圆润或柔和曲线领口，降低面部硬朗边界。"],
      ["standard", "标准脸型", "常规领口", "标准脸型可使用常规领口，优先服装风格和场合要求。"],
      ["heart", "心形脸", "平衡下颌的领口", "心形脸优先使用能够平衡下颌视觉重量的领口。"],
      ["diamond", "菱形脸", "柔和开阔领口", "菱形脸优先使用柔和、开阔的领口，减少颧骨区域的集中感。"]
    ].map(([shape, shapeName, neckline, reason]) => ({
      id: `FACE-SHAPE-${shape.toUpperCase()}`,
      name: `${shapeName}领口方向`,
      group: "身材与脸型适配",
      enabled: true,
      kind: "soft",
      priority: 315,
      conditions: [{ field: "input.face.shape", operator: "eq", value: shape }],
      actions: [
        { type: "SET", field: "requirements.neckline", value: neckline },
        { type: "SET", field: "requirements.faceEffect", value: reason }
      ],
      reason
    })),
    ...[
      ["上长下短", "straight", "当前身材比例为上长下短，候选中增加连续纵向路线供比较。"],
      ["略上长", "straight", "当前身材比例略上长，候选中优先保留纵向连续路线。"],
      ["均衡", "soft", "当前身材比例较均衡，候选中优先保留自然过渡路线。"],
      ["略下长", "tailored", "当前身材比例略下长，候选中优先保留结构清晰路线。"],
      ["上短下长", "tailored", "当前身材比例为上短下长，候选中增加结构清晰路线供比较。"]
    ].map(([label, family, reason], index) => ({
      id: `BODY-PROPORTION-${index}`,
      name: `${label}候选顺序`,
      group: "身材比例",
      enabled: true,
      kind: "soft",
      priority: 305,
      conditions: [{ field: "derived.body.proportion.label", operator: "eq", value: label }],
      actions: [{ type: "BOOST", field: "preferences.family", value: family }],
      reason
    })),
    {
      id: "GOAL-VERTICAL-STRENGTHEN",
      name: "强化整体修长感",
      group: "本次偏好",
      enabled: true,
      kind: "soft",
      priority: 500,
      conditions: [
        { field: "input.goal.endpoint", operator: "eq", value: "vertical" },
        { field: "input.goal.direction", operator: "eq", value: "strengthen" }
      ],
      actions: [
        { type: "SET", field: "requirements.waist", value: "raised" },
        { type: "SET", field: "requirements.line", value: "continuous" },
        { type: "BOOST", field: "preferences.family", value: "straight" }
      ],
      reason: "本次希望进一步强化整体修长感，优先连续纵向线条和偏高腰位。"
    },
    {
      id: "GOAL-VERTICAL-WEAKEN",
      name: "弱化整体修长感",
      group: "本次偏好",
      enabled: true,
      kind: "soft",
      priority: 500,
      conditions: [
        { field: "input.goal.endpoint", operator: "eq", value: "vertical" },
        { field: "input.goal.direction", operator: "eq", value: "weaken" }
      ],
      actions: [
        { type: "SET", field: "requirements.waist", value: "natural" },
        { type: "SET", field: "requirements.line", value: "sectioned" },
        { type: "BOOST", field: "preferences.family", value: "soft" }
      ],
      reason: "本次希望弱化修长感，允许更清楚的横向分段和自然腰位。"
    },
    {
      id: "GOAL-VERTICAL-BALANCE-HIGH",
      name: "平衡较高修长感",
      group: "本次偏好",
      enabled: true,
      kind: "soft",
      priority: 500,
      conditions: [
        { field: "input.goal.endpoint", operator: "eq", value: "vertical" },
        { field: "input.goal.direction", operator: "eq", value: "balance" },
        { field: "derived.body.slenderness.label", operator: "eq", value: "修长" }
      ],
      actions: [
        { type: "SET", field: "requirements.line", value: "sectioned" },
        { type: "BOOST", field: "preferences.family", value: "soft" }
      ],
      reason: "当前整体修长感较明显且本次希望平衡，允许更清楚的横向分段。"
    },
    {
      id: "GOAL-VERTICAL-BALANCE-LOW",
      name: "平衡较低修长感",
      group: "本次偏好",
      enabled: true,
      kind: "soft",
      priority: 500,
      conditions: [
        { field: "input.goal.endpoint", operator: "eq", value: "vertical" },
        { field: "input.goal.direction", operator: "eq", value: "balance" },
        { field: "derived.body.slenderness.label", operator: "eq", value: "小巧" }
      ],
      actions: [
        { type: "SET", field: "requirements.line", value: "continuous" },
        { type: "BOOST", field: "preferences.family", value: "straight" }
      ],
      reason: "当前整体修长感较弱且本次希望平衡，优先保留连续纵向线条。"
    },
    {
      id: "GOAL-WAIST-STRENGTHEN",
      name: "强化腰线表现",
      group: "本次偏好",
      enabled: true,
      kind: "soft",
      priority: 500,
      conditions: [
        { field: "input.goal.endpoint", operator: "eq", value: "waist" },
        { field: "input.goal.direction", operator: "eq", value: "strengthen" }
      ],
      actions: [{ type: "SET", field: "requirements.waist", value: "defined" }],
      reason: "本次希望腰线更明确，优先有清楚腰部定位的组合。"
    },
    {
      id: "GOAL-WAIST-WEAKEN",
      name: "弱化腰线表现",
      group: "本次偏好",
      enabled: true,
      kind: "soft",
      priority: 500,
      conditions: [
        { field: "input.goal.endpoint", operator: "eq", value: "waist" },
        { field: "input.goal.direction", operator: "eq", value: "weaken" }
      ],
      actions: [{ type: "SET", field: "requirements.waist", value: "natural" }],
      reason: "本次希望腰线更自然，减少强收腰和高对比腰部切分。"
    },
    {
      id: "GOAL-VOLUME-BALANCE",
      name: "平衡肩胯轮廓关系",
      group: "本次偏好",
      enabled: true,
      kind: "soft",
      priority: 490,
      conditions: [
        { field: "input.goal.endpoint", operator: "eq", value: "volume" },
        { field: "input.goal.direction", operator: "eq", value: "balance" }
      ],
      actions: [{ type: "BOOST", field: "preferences.family", value: "tailored" }],
      reason: "本次希望平衡肩胯轮廓关系，优先上下结构分配更均衡的组合。"
    },
    {
      id: "GOAL-CONTRAST-STRENGTHEN",
      name: "强化配色对比",
      group: "本次偏好",
      enabled: true,
      kind: "soft",
      priority: 500,
      conditions: [
        { field: "input.goal.endpoint", operator: "eq", value: "contrast" },
        { field: "input.goal.direction", operator: "eq", value: "strengthen" }
      ],
      actions: [{ type: "SET", field: "requirements.colorContrast", value: "高" }],
      reason: "本次希望强化配色对比，在硬性边界允许范围内提高服装深浅差。"
    },
    {
      id: "GOAL-CONTRAST-WEAKEN",
      name: "弱化配色对比",
      group: "本次偏好",
      enabled: true,
      kind: "soft",
      priority: 500,
      conditions: [
        { field: "input.goal.endpoint", operator: "eq", value: "contrast" },
        { field: "input.goal.direction", operator: "eq", value: "weaken" }
      ],
      actions: [{ type: "SET", field: "requirements.colorContrast", value: "低" }],
      reason: "本次希望弱化配色对比，优先更接近的深浅关系。"
    },
    {
      id: "GOAL-KEEP",
      name: "保留当前表现",
      group: "本次偏好",
      enabled: true,
      kind: "soft",
      priority: 250,
      conditions: [
        { field: "input.goal.endpoint", operator: "neq", value: "unknown" },
        { field: "input.goal.direction", operator: "eq", value: "keep" }
      ],
      actions: [{ type: "ADD", field: "notes", value: "保留当前关系" }],
      reason: "本次选择保留当前表现，不额外增加强化或弱化动作。"
    },
    {
      id: "GOAL-UNKNOWN",
      name: "目标暂不确定",
      group: "本次偏好",
      enabled: true,
      kind: "soft",
      priority: 200,
      conditions: [{ field: "input.goal.endpoint", operator: "eq", value: "unknown" }],
      actions: [{ type: "ADD", field: "notes", value: "保留不同方向供比较" }],
      reason: "本次目标暂不确定，因此保留不同效果方向，不自动设定矫正目标。"
    },
    ...[
      ["boundaries.rejectSkirt", "BOUNDARY-REJECT-SKIRT", "拒绝裙装", "FORBID", "candidate.bottomType", "skirt", "已明确拒绝裙装，裙装候选被排除。"],
      ["boundaries.rejectDefinedWaist", "BOUNDARY-REJECT-WAIST", "拒绝明显收腰", "SET", "requirements.waist", "natural", "已明确拒绝明显收腰，候选只能使用自然腰线。"],
      ["boundaries.rejectHighContrast", "BOUNDARY-REJECT-CONTRAST", "拒绝高对比", "SET", "requirements.colorContrastMax", "中等", "已明确拒绝高对比，配色对比不高于中等。"],
      ["boundaries.strictCoverage", "BOUNDARY-COVERAGE", "完整覆盖", "SET", "requirements.coverage", "full", "身体边界要求完整覆盖，候选不得减少覆盖。"],
      ["boundaries.movementFriendly", "BOUNDARY-MOVEMENT", "行动便利", "REQUIRE", "requirements.movement", true, "行动边界要求抬手、行走和坐下不受限。"],
      ["boundaries.sensitiveTexture", "BOUNDARY-TEXTURE", "避免粗糙触感", "SET", "requirements.texture", "smooth", "皮肤接触边界要求表面平滑并避免粗糙强纹理。"]
    ].map(([field, id, name, type, actionField, value, reason], index) => ({
      id,
      name,
      group: "明确拒绝与身体边界",
      enabled: true,
      kind: "hard",
      priority: 1000 - index,
      conditions: [{ field: `input.${field}`, operator: "eq", value: true }],
      actions: [{ type, field: actionField, value }],
      reason
    }))
  ];

  const formalComponentFamilies = [
    ["straight", "精纺直线"],
    ["tailored", "合体剪裁"],
    ["soft", "柔和垂坠"],
    ["relaxed", "松量结构"],
    ["street", "都市工装"],
    ["retro", "复古精裁"]
  ];

  const formalComponents = formalComponentFamilies.flatMap(([family, label]) => [
    ...[["long", "长袖"], ["threeQuarter", "七分袖"], ["short", "短袖"]].map(([sleeve, sleeveName]) => ({
      id: `TOP-FORMAL-${family.toUpperCase()}-${sleeve.toUpperCase()}`,
      name: `${label}${sleeveName}上衣`,
      category: "top",
      enabled: true,
      attributes: { family, sleeve, formality: 4, movement: true }
    })),
    ...[["light", "轻外套"], ["warm", "保暖外套"]].map(([outerKind, outerName]) => ({
      id: `OUTER-FORMAL-${family.toUpperCase()}-${outerKind.toUpperCase()}`,
      name: `${label}${outerName}`,
      category: "outer",
      enabled: true,
      attributes: { family, outerKind, formality: 4, movement: true }
    })),
    ...[["full", "长裤"], ["regular", "九分裤"], ["light", "百慕大短裤"]].map(([coverage, bottomName]) => ({
      id: `BOTTOM-FORMAL-${family.toUpperCase()}-${coverage.toUpperCase()}`,
      name: `${label}${bottomName}`,
      category: "bottom",
      enabled: true,
      attributes: { family, bottomType: coverage === "light" ? "short" : "trouser", coverage, formality: 4, movement: true }
    }))
  ]);

  const dressFamilies = [
    ["straight", "简洁直线", 3],
    ["soft", "柔和收放", 2],
    ["relaxed", "自然留量", 1],
    ["tailored", "利落剪裁", 4],
    ["street", "都市箱型", 2],
    ["retro", "复古收放", 3]
  ];
  const dressCuts = [
    ["aLineMidi", "A字中长连衣裙"],
    ["shirtDress", "衬衫连衣裙"],
    ["wrapDress", "裹身连衣裙"],
    ["columnDress", "直筒连衣裙"]
  ];
  const dressSleeves = [["long", "长袖"], ["threeQuarter", "七分袖"], ["short", "短袖"]];
  const dressWaists = [["raised", "偏高腰"], ["natural", "自然腰"], ["relaxed", "松弛直身"]];
  const dressComponents = dressFamilies.flatMap(([family, familyName, formality]) =>
    dressCuts.flatMap(([dressCut, cutName]) =>
      dressSleeves.flatMap(([sleeve, sleeveName]) =>
        dressWaists.map(([waistPosition, waistName]) => ({
          id: `DRESS-${family.toUpperCase()}-${dressCut.toUpperCase()}-${sleeve.toUpperCase()}-${waistPosition.toUpperCase()}`,
          name: `${familyName}${sleeveName}${waistName}${cutName}`,
          category: "dress",
          enabled: true,
          attributes: { family, dressCut, sleeve, waistPosition, formality, movement: true }
        }))
      )
    )
  );

  const components = [
    ...[
      ["TOP-LONG-STRAIGHT", "轻薄长袖衬衫", "top", "straight", "long", 3, true],
      ["TOP-LONG-SOFT", "细针长袖针织衫", "top", "soft", "long", 2, true],
      ["TOP-LONG-SOFT-FORMAL", "柔和领长袖衬衫", "top", "soft", "long", 3, true],
      ["TOP-LONG-RELAXED", "轻薄长袖上衣", "top", "relaxed", "long", 1, true],
      ["TOP-LONG-TAILORED", "合体长袖衬衫", "top", "tailored", "long", 4, true],
      ["TOP-THREE-STRAIGHT", "七分袖衬衫", "top", "straight", "threeQuarter", 3, true],
      ["TOP-THREE-SOFT", "七分袖针织上衣", "top", "soft", "threeQuarter", 2, true],
      ["TOP-THREE-RELAXED", "宽松七分袖上衣", "top", "relaxed", "threeQuarter", 1, true],
      ["TOP-THREE-TAILORED", "简洁七分袖上衣", "top", "tailored", "threeQuarter", 3, true],
      ["TOP-SHORT-STRAIGHT", "短袖衬衫", "top", "straight", "short", 3, true],
      ["TOP-SHORT-SOFT", "短袖针织上衣", "top", "soft", "short", 2, true],
      ["TOP-SHORT-SOFT-FORMAL", "柔和领短袖衬衫", "top", "soft", "short", 3, true],
      ["TOP-SHORT-RELAXED", "轻薄短袖上衣", "top", "relaxed", "short", 1, true],
      ["TOP-SHORT-TAILORED", "合体短袖衬衫", "top", "tailored", "short", 3, true],
      ["TOP-LONG-STREET", "宽松长袖叠穿上衣", "top", "street", "long", 2, true],
      ["TOP-THREE-STREET", "箱型七分袖上衣", "top", "street", "threeQuarter", 2, true],
      ["TOP-SHORT-STREET", "箱型短袖上衣", "top", "street", "short", 2, true],
      ["TOP-LONG-RETRO", "复古领长袖衬衫", "top", "retro", "long", 3, true],
      ["TOP-THREE-RETRO", "复古领七分袖上衣", "top", "retro", "threeQuarter", 3, true],
      ["TOP-SHORT-RETRO", "复古领短袖针织衫", "top", "retro", "short", 2, true]
    ].map(([id, name, category, family, sleeve, formality, movement]) => ({
      id, name, category, enabled: true, attributes: { family, sleeve, formality, movement }
    })),
    ...[
      ["OUTER-NONE", "无外层", "none", "straight", 1],
      ["OUTER-LIGHT-STRAIGHT", "可脱轻薄短风衣", "light", "straight", 3],
      ["OUTER-LIGHT-SOFT", "细针开衫", "light", "soft", 2],
      ["OUTER-LIGHT-SOFT-FORMAL", "轻薄无领外套", "light", "soft", 3],
      ["OUTER-LIGHT-RELAXED", "轻量夹克", "light", "relaxed", 1],
      ["OUTER-LIGHT-TAILORED", "轻薄西装外套", "light", "tailored", 4],
      ["OUTER-WARM-STRAIGHT", "中长直线外套", "warm", "straight", 3],
      ["OUTER-WARM-SOFT", "柔软针织外套", "warm", "soft", 2],
      ["OUTER-WARM-RELAXED", "轻保暖短外套", "warm", "relaxed", 1],
      ["OUTER-WARM-TAILORED", "合体中长外套", "warm", "tailored", 4],
      ["OUTER-LIGHT-STREET", "短款多口袋夹克", "light", "street", 2],
      ["OUTER-WARM-STREET", "宽松工装外套", "warm", "street", 2],
      ["OUTER-LIGHT-RETRO", "复古短款开衫", "light", "retro", 3],
      ["OUTER-WARM-RETRO", "复古翻领中长外套", "warm", "retro", 3]
    ].map(([id, name, outerKind, family, formality]) => ({
      id, name, category: "outer", enabled: true, attributes: { outerKind, family, formality, movement: true }
    })),
    ...[
      ["BOTTOM-STRAIGHT-FULL", "高腰直筒长裤", "straight", "trouser", "full", 3, true],
      ["BOTTOM-SOFT-SKIRT", "A 字中长裙", "soft", "skirt", "full", 3, true],
      ["BOTTOM-SOFT-TROUSER", "垂坠微阔长裤", "soft", "trouser", "full", 2, true],
      ["BOTTOM-RELAXED-FULL", "宽松直筒长裤", "relaxed", "trouser", "full", 1, true],
      ["BOTTOM-TAILORED-FULL", "合体西装长裤", "tailored", "trouser", "full", 4, true],
      ["BOTTOM-STRAIGHT-REGULAR", "直筒九分裤", "straight", "trouser", "regular", 3, true],
      ["BOTTOM-SOFT-REGULAR", "柔和中长裙", "soft", "skirt", "regular", 3, true],
      ["BOTTOM-SOFT-REGULAR-TROUSER", "垂坠九分裤", "soft", "trouser", "regular", 2, true],
      ["BOTTOM-RELAXED-REGULAR", "轻薄宽腿裤", "relaxed", "trouser", "regular", 1, true],
      ["BOTTOM-TAILORED-REGULAR", "利落锥形裤", "tailored", "trouser", "regular", 4, true],
      ["BOTTOM-STRAIGHT-LIGHT", "轻薄直筒短裤", "straight", "short", "light", 2, true],
      ["BOTTOM-SOFT-LIGHT", "轻薄过膝裙", "soft", "skirt", "light", 2, true],
      ["BOTTOM-RELAXED-LIGHT", "宽松轻薄短裤", "relaxed", "short", "light", 1, true],
      ["BOTTOM-TAILORED-LIGHT", "利落百慕大短裤", "tailored", "short", "light", 3, true],
      ["BOTTOM-STREET-FULL", "宽松工装长裤", "street", "trouser", "full", 2, true],
      ["BOTTOM-STREET-REGULAR", "宽松工装九分裤", "street", "trouser", "regular", 2, true],
      ["BOTTOM-STREET-LIGHT", "宽松工装短裤", "street", "short", "light", 2, true],
      ["BOTTOM-RETRO-FULL", "高腰复古褶裥长裤", "retro", "trouser", "full", 3, true],
      ["BOTTOM-RETRO-REGULAR", "复古 A 字中长裙", "retro", "skirt", "regular", 3, true],
      ["BOTTOM-RETRO-LIGHT", "复古高腰短裤", "retro", "short", "light", 2, true]
    ].map(([id, name, family, bottomType, coverage, formality, movement]) => ({
      id, name, category: "bottom", enabled: true, attributes: { family, bottomType, coverage, formality, movement }
    })),
    ...formalComponents,
    ...dressComponents
  ];

  const familyLine = {
    straight: "continuous",
    tailored: "structured",
    soft: "soft",
    relaxed: "balanced",
    street: "sectioned",
    retro: "sectioned"
  };

  components.forEach((component) => {
    const attributes = component.attributes ||= {};
    const name = component.name || "";
    const family = attributes.family || "straight";
    const coverageRank = { light: 0, regular: 1, full: 2 };
    if (component.category === "top" && !attributes.coverage) {
      attributes.coverage = attributes.sleeve === "long" ? "full" : attributes.sleeve === "threeQuarter" ? "regular" : "light";
    }
    if (component.category === "dress" && !attributes.coverage) {
      attributes.coverage = attributes.sleeve === "long" ? "full" : attributes.sleeve === "threeQuarter" ? "regular" : "light";
    }
    if (component.category === "outer" && !attributes.coverage) {
      attributes.coverage = attributes.outerKind === "warm" ? "full" : attributes.outerKind === "light" ? "regular" : "light";
    }
    attributes.coverageRank = coverageRank[attributes.coverage] ?? 1;
    attributes.waistPosition ||= /高腰/.test(name) ? "raised" : family === "tailored" ? "defined" : "natural";
    attributes.lineDirection ||= familyLine[family] || "balanced";
    attributes.neckline ||= /柔和领|针织/.test(name) ? "softCurve" : /复古领|翻领/.test(name) ? "open" : "regular";
    attributes.texture ||= /针织|柔软|垂坠/.test(name) ? "soft" : "smooth";
    attributes.materialClass ||= attributes.outerKind === "warm" ? "warm" : attributes.sleeve === "short" ? "light" : "regular";
    attributes.silhouette ||= family;
    if (component.category === "top") {
      attributes.topFit ||= family === "tailored" ? "fitted" : ["relaxed", "street"].includes(family) ? "oversized" : "regular";
    }
    if (component.category === "bottom" && attributes.bottomType !== "short") {
      attributes.bottomCut ||= attributes.bottomType === "skirt"
        ? component.id.includes("SOFT-REGULAR") ? "straightSkirt" : "aLineSkirt"
        : ["relaxed", "street"].includes(family) ? "wideLeg" : family === "tailored" ? "tapered" : "straightLeg";
    }
  });

  const bottomWaistLabels = { raised: "偏高腰", natural: "自然腰", relaxed: "松弛腰" };
  const bottomWaistVariants = components
    .filter((component) => component.category === "bottom")
    .flatMap((component) => Object.entries(bottomWaistLabels)
      .filter(([waistPosition]) => waistPosition !== component.attributes.waistPosition)
      .map(([waistPosition, waistLabel]) => ({
        ...component,
        id: `${component.id}-WAIST-${waistPosition.toUpperCase()}`,
        name: `${waistLabel}${component.name}`,
        attributes: { ...component.attributes, waistPosition }
      })));
  components.push(...bottomWaistVariants);

  const defaultInput = {
    context: { temperatureRange: "10_18", occasion: "commute", environment: ["none"] },
    preference: { style: "urban", formality: "commute", palette: "any", trendDirection: "relaxedTailoring", trendIntensity: "light" },
    face: { shape: "standard" },
    appearance: {
      skinTone: "warmLean",
      skinValue: "deep",
      hairTone: "warm",
      hairDepth: "light"
    },
    body: {
      legRatio: "longLegs",
      waistDefinition: "moderate",
      shoulderHipBalance: "hipDominant",
      boneFrame: "medium"
    },
    goal: { endpoint: "", direction: "keep" },
    boundaries: {
      rejectSkirt: false,
      rejectTight: false,
      rejectDefinedWaist: false,
      rejectDeepNeck: false,
      rejectHighContrast: false,
      strictCoverage: false,
      movementFriendly: false,
      sensitiveTexture: false
    },
    sources: {
      body: "user_stated",
      appearance: "user_stated",
      context: "user_stated",
      goal: "user_stated",
      boundaries: "user_stated"
    }
  };

  const tests = [
    {
      id: "TEST-COOL-COMMUTE",
      name: "10-18°C 通勤",
      enabled: true,
      input: defaultInput,
      expected: { layerCount: 2, sleeve: "long", outer: "light", minCandidates: 2 }
    },
    {
      id: "TEST-WARM-DAILY",
      name: "24-30°C 日常",
      enabled: true,
      input: { ...defaultInput, context: { temperatureRange: "24_30", occasion: "daily" } },
      expected: { layerCount: 1, sleeve: "short", outer: "none", minCandidates: 2 }
    },
    {
      id: "TEST-FORMAL",
      name: "正式场合",
      enabled: true,
      input: { ...defaultInput, context: { temperatureRange: "18_24", occasion: "formal" } },
      expected: { formalityMin: 3, minCandidates: 2 }
    },
    {
      id: "TEST-REJECT-SKIRT",
      name: "明确拒绝裙装",
      enabled: true,
      input: {
        ...defaultInput,
        boundaries: { ...defaultInput.boundaries, rejectSkirt: true }
      },
      expected: { forbiddenBottomType: "skirt", minCandidates: 2 }
    },
    {
      id: "TEST-REJECT-WAIST",
      name: "拒绝明显收腰",
      enabled: true,
      input: {
        ...defaultInput,
        boundaries: { ...defaultInput.boundaries, rejectDefinedWaist: true }
      },
      expected: { noDefinedWaist: true, minCandidates: 2 }
    },
    {
      id: "TEST-STRICT-COVERAGE",
      name: "要求完整覆盖",
      enabled: true,
      input: {
        ...defaultInput,
        boundaries: { ...defaultInput.boundaries, strictCoverage: true }
      },
      expected: { coverage: "full", minCandidates: 2 }
    },
    {
      id: "TEST-TRAVEL-MOVEMENT",
      name: "出游行动便利",
      enabled: true,
      input: {
        ...defaultInput,
        context: { temperatureRange: "18_24", occasion: "travel" },
        boundaries: { ...defaultInput.boundaries, movementFriendly: true }
      },
      expected: { movement: true, minCandidates: 2 }
    }
  ];

  window.GarmentPrototypeData = {
    temperatureOptions,
    fiveBands,
    colorTemperatureBands,
    defaultInput,
    defaultRuleSet: {
      schemaVersion: "2.0.0",
      meta: {
        version: "1.2.0",
        status: "published",
        updatedAt: "2026-08-14 12:00",
        note: "V1.2 动态潮流方向、规则总览与统一工作台"
      },
      operatorDictionary,
      inputGroups,
      fieldMappings,
      conditionFields,
      resultFields,
      parameters,
      derivedRules,
      decisionRules,
      outfitOutputs,
      components,
      colorLibrary,
      palettePlans,
      patternLibrary,
      trendDirections,
      tests
    }
  };
})();
