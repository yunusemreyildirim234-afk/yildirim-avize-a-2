import test from "node:test";
import assert from "node:assert/strict";
import { requestNoticeTitle } from "../lib/request-notice.ts";

test("iptal/iade talebi başlığı türü yansıtır", () => {
  assert.equal(requestNoticeTitle("CANCEL", "abcdef12-3456"), "İptal talebi: sipariş #abcdef12");
  assert.equal(requestNoticeTitle("RETURN", "abcdef12-3456"), "İade talebi: sipariş #abcdef12");
});
