"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "className"> & {
  /** Girdi kutusu sınıfları; sağ iç boşluk düğme için otomatik eklenir. */
  className?: string;
};

/**
 * Şifre kutusu + kutunun içinde sağda göster/gizle düğmesi.
 * Tüm girdi öznitelikleri (autoComplete, id, aria-label...) aynen iletilir; tarayıcı şifre yöneticisi bozulmaz.
 * Şifre değeri bu bileşende saklanmaz ve loglanmaz; yalnızca görünürlük durumu tutulur.
 */
export default function PasswordInput({ className = "", ...rest }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...rest} type={visible ? "text" : "password"} className={`${className} pr-12`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Şifreyi gizle" : "Şifreyi göster"}
        aria-pressed={visible}
        className="absolute right-0 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-11 h-11 rounded-xl text-neutral-600 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-amber-600"
      >
        {visible ? <EyeOff aria-hidden="true" className="w-4 h-4" /> : <Eye aria-hidden="true" className="w-4 h-4" />}
      </button>
    </div>
  );
}
