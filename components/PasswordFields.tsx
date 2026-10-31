"use client";

import { Check, X } from "lucide-react";
import { PASSWORD_RULES, isStrongPassword } from "@/lib/validation";

export const passwordsOk = (password: string, confirm: string) => isStrongPassword(password) && password === confirm;

const inputCls = "w-full p-3 rounded-xl border border-neutral-300 focus:outline-none focus:border-amber-600";

/** Şifre + şifre tekrarı; kurallar ve eşleşme canlı gösterilir. */
export default function PasswordFields({
  password,
  confirm,
  onPassword,
  onConfirm,
  label = "Şifre",
}: {
  password: string;
  confirm: string;
  onPassword: (v: string) => void;
  onConfirm: (v: string) => void;
  label?: string;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="font-semibold text-neutral-700 block mb-1">{label}</label>
        <input
          aria-label={label}
          required
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => onPassword(e.target.value)}
          className={inputCls}
        />
      </div>

      <ul aria-label="Şifre kuralları" className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
        {PASSWORD_RULES.map((r) => {
          const ok = r.test(password);
          return (
            <li key={r.key} className={`flex items-center gap-1.5 text-[11px] ${ok ? "text-emerald-600 font-semibold" : "text-neutral-400"}`}>
              {ok ? <Check aria-hidden="true" className="w-3 h-3" /> : <span aria-hidden="true" className="w-3 h-3 rounded-full border border-neutral-300" />}
              {r.label}
            </li>
          );
        })}
      </ul>

      <div>
        <label className="font-semibold text-neutral-700 block mb-1">{label} Tekrarı</label>
        <input
          aria-label={`${label} tekrarı`}
          required
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => onConfirm(e.target.value)}
          className={inputCls}
        />
        {confirm.length > 0 && (
          <p role="status" className={`mt-1.5 flex items-center gap-1 text-[11px] font-semibold ${password === confirm ? "text-emerald-600" : "text-red-600"}`}>
            {password === confirm ? <Check aria-hidden="true" className="w-3 h-3" /> : <X aria-hidden="true" className="w-3 h-3" />}
            {password === confirm ? "Şifreler uyuşuyor" : "Şifreler uyuşmuyor"}
          </p>
        )}
      </div>
    </div>
  );
}
