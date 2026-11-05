import crypto from "node:crypto";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// e2e/.env.e2e yüklenir; içeriği ASLA okunup yazdırılmaz (bkz. env.cjs).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { loadE2eEnv } = require("./env.cjs") as { loadE2eEnv: () => boolean };
loadE2eEnv();

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_URL = "http://localhost:3100";
const BASE_URL = (process.env.E2E_BASE_URL || DEFAULT_URL).replace(/\/$/, "");
const useExistingServer = Boolean(process.env.E2E_BASE_URL);

// Tarayıcı bu repoda yalnızca yerel adrese gider.
const host = new URL(BASE_URL).hostname;
if (host !== "localhost" && host !== "127.0.0.1") {
  throw new Error("E2E_BASE_URL yalnızca localhost / 127.0.0.1 olabilir.");
}
if (!process.env.E2E_DATABASE_URL) {
  throw new Error("E2E_DATABASE_URL tanımlı değil (e2e/.env.e2e). Test başlatılmadı. Örnek için e2e/.env.e2e.example dosyasına bakın.");
}

// Yönetici oturumu: bu çalıştırmaya özel rastgele kimlik; yalnızca e2e sunucusunun ortamında ve test işçilerinde bulunur.
// Gerçek ADMIN_USER / ADMIN_PASSWORD (.env, Vercel) hiçbir yerde okunmaz. Ana süreç ortamı işçilere devredilir.
if (!process.env.E2E_ADMIN_PASSWORD) process.env.E2E_ADMIN_PASSWORD = crypto.randomBytes(18).toString("base64url");
const E2E_ADMIN_USER = "e2e-admin";
process.env.E2E_ADMIN_USER = E2E_ADMIN_USER;

/**
 * e2e sunucusunun ortamı: yalnızca e2e veritabanı; harici servis anahtarları BOŞ (e-posta/ödeme/kargo/cron kapalı).
 * Boş string tanımlı sayılır; Next.js kök .env dosyasındaki gerçek değerlerle bunların üzerine yazmaz.
 */
const serverEnv: Record<string, string> = {
  ...(process.env as Record<string, string>),
  DATABASE_URL: process.env.E2E_DATABASE_URL,
  NEXT_PUBLIC_GTM_ID: "GTM-TEST000", // NEXT_PUBLIC değer derleme sırasında gömülür
  NEXT_PUBLIC_SITE_URL: "https://www.yildirimavize.com.tr",
  NEXTAUTH_SECRET: "e2e-only-secret-not-for-production",
  NEXT_TELEMETRY_DISABLED: "1",
  // Harici servisler kapalı
  RESEND_API_KEY: "",
  RESEND_FROM: "",
  PAYTR_MERCHANT_ID: "",
  PAYTR_MERCHANT_KEY: "",
  PAYTR_MERCHANT_SALT: "",
  MERCHANT_ID: "",
  MERCHANT_KEY: "",
  MERCHANT_SALT: "",
  KARGONOMI_API_KEY: "",
  KARGONOMI_API_TOKEN: "",
  KARGONOMI_WEBHOOK_SECRET: "",
  CRON_SECRET: "",
  TRENDYOL_API_KEY: "",
  TRENDYOL_API_SECRET: "",
  TRENDYOL_SUPPLIER_ID: "",
  TRENDYOL_TOKEN: "",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  ADMIN_USER: E2E_ADMIN_USER,
  ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD,
};
// Dış ortamdan sızabilecek e2e'ye ait olmayan veritabanı adı kalmasın
delete serverEnv.DIRECT_URL;

const ADMIN_STATE = path.join(__dirname, ".auth", "admin.json");

const next = "node node_modules/next/dist/bin/next";

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  globalSetup: "./global-setup.ts",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  // Yazan admin testleri ile herkese açık testler aynı veritabanını paylaşır: tek işçi, sırayla (admin projeleri en sonda).
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [["list"], ["html", { open: "never", outputFolder: "./playwright-report" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    serviceWorkers: "block",
  },
  projects: [
    { name: "desktop", testIgnore: /tests[\/]admin[\/]/, use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "mobile", testIgnore: /tests[\/]admin[\/]/, use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    // Admin: gerçek giriş akışı bir kez çalışır (storageState), testler yalnızca masaüstünde ve sırayla. Kalıntı denetimi teardown olarak en sonda.
    { name: "admin-setup", testMatch: /admin[\/]setup\.ts$/, teardown: "admin-audit", timeout: 180_000, use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "admin-audit", testMatch: /admin[\/]audit\.ts$/, timeout: 180_000 },
    {
      name: "admin",
      testMatch: /admin[\/][a-z]-.*\.spec\.ts$/,
      dependencies: ["admin-setup"],
      timeout: 180_000, // yönetim sayfası ~240 ürünü yükler; uzak (Neon) veritabanı + çok adımlı akışlar
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, storageState: ADMIN_STATE },
    },
  ],
  // Hazır sunucu verilmediyse: güvenlik kilidi → üretim derlemesi → sunucu (3100). Kilit, derlemeden ÖNCE çalışır.
  webServer: useExistingServer
    ? undefined
    : {
        command: `node e2e/scripts/guard.cjs && ${next} build && ${next} start -p 3100`,
        cwd: ROOT,
        url: DEFAULT_URL,
        reuseExistingServer: false,
        timeout: 15 * 60_000,
        stdout: "ignore",
        stderr: "pipe",
        env: serverEnv,
      },
});
