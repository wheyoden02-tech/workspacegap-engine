import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { sampleConfig } from "../src/lib/client-config.ts";
import { generatePackage, lintPackage } from "../src/lib/package-generator.ts";

const files = {
  ...generatePackage(sampleConfig),
  ".claspignore": "**/**\n!Code.gs\n!appsscript.json\n",
};
const destination = new URL("../sample-clasp-delivery/", import.meta.url);
const check = process.argv.includes("--check");
if (lintPackage(files).some((result) => !result.pass))
  throw new Error("Sample package failed security checks.");
if (!check) await fs.mkdir(destination, { recursive: true });
for (const [name, content] of Object.entries(files)) {
  const path = new URL(name, destination);
  if (check) {
    const actual = await fs.readFile(path, "utf8");
    if (actual !== content)
      throw new Error(`${name} is out of date. Run npm run generate:sample.`);
  } else await fs.writeFile(path, content, "utf8");
}
console.log(
  `${check ? "Verified" : "Materialized"} ${Object.keys(files).length} sample clasp files in ${fileURLToPath(destination)}`,
);
