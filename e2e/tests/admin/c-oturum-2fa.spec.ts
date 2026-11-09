import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { test, expect } from "../../fixtures";
import { exec, rows } from "../../db";

// Müşteri girişi: normal giriş, 2FA'lı giriş ve bekleyen jetonun oturum yerine geçememesi.
// Yalnızca e2e-oturum* sahte hesapları üretir ve sonda siler. E-posta kapalı olduğundan 2FA kodu önceden veritabanına yazılır
// (son 60 sn'de kod varsa giriş yeni kod göndermez, mevcut kodla devam eder). Kendi x-forwarded-for sayacını kullanır.
const PASSWORD = "E2e-Oturum-1!";
const NORMAL = "e2e-oturum-normal@example.invalid";
const TWO_FA = "e2e-oturum-2fa@example.invalid";
const CODE = "482913";

const hash = (p: string) => {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(p, salt, 64).toString("hex")}`;
};
const insertUser = (email: string, twoFactor: boolean) =>
  exec(`insert into "User" (id, name, email, password, role, "twoFactorEnabled", "updatedAt") values ($1, 'E2E Oturum', $2, $3, 'USER', $4, now())`, [randomUUID(), email, hash(PASSWORD), twoFactor]);
const cleanup = async () => {
  await exec(`delete from "VerificationCode" where email in ($1, $2)`, [NORMAL, TWO_FA]);
  await exec(`delete from "User" where email in ($1, $2)`, [NORMAL, TWO_FA]);
};
const cookieFrom = (setCookie: string | undefined) => (setCookie ?? "").match(/ya_user=([^;]+)/)?.[1] ?? null;

test.describe("Müşteri oturumu ve 2FA", () => {
  test.beforeAll(async () => {
    await cleanup();
    await insertUser(NORMAL, false);
    await insertUser(TWO_FA, true);
  });
  test.afterAll(cleanup);

  test("normal giriş oturum açar; 2FA bekleyen jeton oturum olmaz; kodla giriş açılır", async ({ playwright, baseURL }) => {
    const api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": "10.77.0.21" } });
    const meWith = async (cookie: string) => {
      const res = await api.get("/api/auth/me", { headers: { cookie: `ya_user=${cookie}` } });
      return ((await res.json()) as { user: unknown }).user;
    };

    await test.step("2FA kapalı hesap: giriş oturum açar", async () => {
      const res = await api.post("/api/auth", { data: { action: "login", email: NORMAL, password: PASSWORD } });
      expect(res.status()).toBe(200);
      const cookie = cookieFrom(res.headers()["set-cookie"]);
      expect(cookie).not.toBeNull();
      expect(await meWith(cookie!)).not.toBeNull();
    });

    await exec(`insert into "VerificationCode" (id, email, code, type, "expiresAt", used, attempts) values ($1, $2, $3, 'TWO_FACTOR_LOGIN', now() + interval '10 minutes', false, 0)`, [randomUUID(), TWO_FA, CODE]);

    const login = await api.post("/api/auth", { data: { action: "login", email: TWO_FA, password: PASSWORD } });
    expect(login.status()).toBe(200);
    expect(cookieFrom(login.headers()["set-cookie"]), "kod girilmeden çerez verilmez").toBeNull();
    const { twoFactor, pendingToken } = (await login.json()) as { twoFactor: boolean; pendingToken: string };
    expect(twoFactor).toBe(true);

    await test.step("bekleyen jeton ya_user olarak kabul edilmez", async () => {
      expect(await meWith(pendingToken)).toBeNull();
    });

    await test.step("doğru kodla giriş tamamlanır", async () => {
      const res = await api.post("/api/auth/verify-code", { data: { type: "TWO_FACTOR_LOGIN", email: TWO_FA, code: CODE, pendingToken } });
      expect(res.status()).toBe(200);
      const cookie = cookieFrom(res.headers()["set-cookie"]);
      expect(cookie).not.toBeNull();
      expect(await meWith(cookie!)).not.toBeNull();
    });

    expect((await rows(`select 1 from "User" where email = $1`, [TWO_FA])).length).toBe(1);
    await api.dispose();
  });
});
