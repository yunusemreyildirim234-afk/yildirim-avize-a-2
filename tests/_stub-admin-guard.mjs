import { NextResponse } from "next/server.js";
export const adminGuard = async () => (globalThis.__adminAuthed ? null : NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 }));
