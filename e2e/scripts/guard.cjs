// webServer komutunun İLK adımı: Playwright webServer'ı globalSetup'tan önce başlatır; derleme/sunucu veritabanına dokunmadan önce kilit burada doğrulanır.
const { loadE2eEnv } = require("../env.cjs");
const { assertE2eDatabase } = require("../safety.cjs");

loadE2eEnv();
assertE2eDatabase().then(
  () => process.exit(0),
  (err) => {
    console.error(`\n[e2e güvenlik kilidi] ${err.message}\n`);
    process.exit(1);
  }
);
