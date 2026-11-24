import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const { input } = JSON.parse(await readFile(process.argv[2], "utf8"));
const evidence = [];
let result = true;
for (const { path, digest } of input.files) {
  try {
    const bytes = await readFile(path);
    const actual = createHash("sha256").update(bytes).digest("hex");
    evidence.push(`${path}: ${actual}`);
    if (actual !== digest) result = false;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    evidence.push(`${path}: missing`);
    result = false;
  }
}
console.log(JSON.stringify({ result, evidence: evidence.join("\n") }));
