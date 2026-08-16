const fs = require("fs");
const path = require("path");

const root = __dirname;
const sourcePath = path.join(root, "index.html");
const outputPath = path.join(root, "garment-recommendation-standalone.html");

const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const inlineScript = (name) => `<script>\n${read(name).replace(/<\/script>/gi, "<\\/script>")}\n</script>`;

let html = fs.readFileSync(sourcePath, "utf8");
html = html
  .replace('<link rel="stylesheet" href="styles.css">', `<style>\n${read("styles.css")}\n</style>`)
  .replace(/\s*<script defer src="(?:rules-data|canonical-data|canonical-input-adapter|canonical-rule-engine|canonical-output-adapter|rule-engine|app)\.js"><\/script>/g, "")
  .replace("<title>穿搭推荐案例运行</title>", "<title>穿搭推荐单文件版</title>")
  .replace('      <a href="rules.html">规则管理</a>\n', "")
  .replace("</body>", () => `${inlineScript("rules-data.js")}\n${inlineScript("canonical-data.js")}\n${inlineScript("canonical-input-adapter.js")}\n${inlineScript("canonical-rule-engine.js")}\n${inlineScript("canonical-output-adapter.js")}\n${inlineScript("rule-engine.js")}\n${inlineScript("app.js")}\n</body>`);

fs.writeFileSync(outputPath, html, "utf8");
console.log(outputPath);
