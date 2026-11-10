// Önizleme = kopyala --dry-run: hiçbir şey yüklemez, veritabanına yazmaz; cikti/onizleme.html üretir.
//   npm run onizleme -- --ornek 10      ya da      npm run onizleme -- --urun 5,17,42
import { ana } from "./kopyala.mjs";
import { calistir } from "./lib/ortam.mjs";

calistir(() => ana([...process.argv.slice(2).filter((f) => f !== "--dry-run"), "--dry-run"]));
