// Test dosyaları lib/*.ts içe aktarmadan ÖNCE bunu içe aktarır; sahte depo globalThis.__fakePrisma ile verilir.
import { register } from "node:module";
register("./_alias-hooks.mjs", import.meta.url);
