"use client";

import { createContext, useContext } from "react";

/** AdminSection açıkken true: bölüm içindeki bileşenler verisini yalnızca bölüm açılınca çekebilir (açılmamış bölüm sorgu üretmez). */
export const SectionOpenContext = createContext(false);
export const useSectionOpen = () => useContext(SectionOpenContext);
