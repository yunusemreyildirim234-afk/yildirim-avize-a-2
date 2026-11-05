// Hiçbir test çalışmadan önce: e2e veritabanı kilidi (ikinci savunma hattı; hazır sunucu modunda tek kilittir).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { assertE2eDatabase } = require("./safety.cjs") as { assertE2eDatabase: () => Promise<void> };

export default async function globalSetup() {
  await assertE2eDatabase();
}
