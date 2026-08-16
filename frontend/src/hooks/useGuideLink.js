// Địa chỉ tài liệu hướng dẫn sử dụng Larry, khai bằng USER_GUIDE_URL trong
// backend/.env. Trả về chuỗi rỗng khi chưa khai hoặc khi không hỏi được backend —
// lúc đó trang giới thiệu không vẽ nút, thay vì vẽ một cái nút bấm vào không ra gì.

import { useEffect, useState } from "react";
import { GUIDE_LINK_URL } from "../config/api";

export function useGuideLink() {
  const [url, setUrl] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(GUIDE_LINK_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (!cancelled) setUrl(String(data?.url || "").trim());
      } catch {
        // Backend chưa chạy hoặc chưa khai biến: im lặng bỏ qua. Trang giới thiệu
        // là trang đọc, không đáng để bày một dòng lỗi vì thiếu một đường link phụ.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return url;
}
