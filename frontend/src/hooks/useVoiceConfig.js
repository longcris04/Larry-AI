// Backend có bật được micro và loa không?
//
// Hỏi một lần lúc mở khung chat. Câu trả lời quyết định có VẼ nút micro và nút
// loa hay không — chưa khai STT_MODEL/TTS_MODEL trong backend/.env thì nút không
// hiện ra. Với học sinh tiểu học, một cái nút bấm vào không chạy khó hiểu hơn
// nhiều so với một cái nút không có ở đó.

import { useEffect, useState } from "react";
import { VOICE_CONFIG_URL } from "../config/api";

export function useVoiceConfig() {
  const [config, setConfig] = useState({ stt: false, tts: false, loading: true });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(VOICE_CONFIG_URL, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (!cancelled) setConfig({ ...data, loading: false });
      } catch {
        // Hỏi không được thì coi như không có giọng nói. Khung chat gõ chữ là
        // đường chính và nó không phụ thuộc gì vào chỗ này.
        if (!cancelled) setConfig({ stt: false, tts: false, loading: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return config;
}
