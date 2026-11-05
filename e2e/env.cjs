// e2e/.env.e2e yükleyici. İçerik ASLA yazdırılmaz/loglanmaz; yalnızca process.env'e (zaten tanımlı değilse) aktarılır.
const fs = require("node:fs");
const path = require("node:path");

function loadE2eEnv() {
  const file = path.join(__dirname, ".env.e2e");
  if (!fs.existsSync(file)) return false;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim().replace(/^export\s+/, "");
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return true;
}

module.exports = { loadE2eEnv };
