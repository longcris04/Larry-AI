import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../config/api";
import "../../styles/LegalModal.css";

/**
 * Hiện Điều khoản sử dụng / Chính sách bảo mật ngay trên form đăng ký.
 * Dùng hộp thoại thay vì mở trang mới để học sinh không mất những gì đã điền.
 * Nội dung lấy từ backend/documents/*.txt qua GET /api/documents/:slug.
 */
export default function LegalModal({ slug, onClose }) {
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    setDoc(null);
    setError("");

    axios
      .get(`${API_BASE_URL}/api/documents/${slug}`)
      .then((res) => {
        if (!cancelled) setDoc(res.data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.data?.error || "Không tải được nội dung. Thử lại sau nhé.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Bấm Esc để đóng, giống mọi hộp thoại khác
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="legal-modal__backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="legal-modal">
        <header className="legal-modal__head">
          <h3 className="legal-modal__title">{doc?.title || "Đang tải..."}</h3>
          <button
            type="button"
            className="legal-modal__close"
            onClick={onClose}
            aria-label="Đóng"
          >
            ✕
          </button>
        </header>

        <div className="legal-modal__body">
          {error ? (
            <p className="legal-modal__error">{error}</p>
          ) : doc ? (
            <pre className="legal-modal__text">{doc.content}</pre>
          ) : (
            <p className="legal-modal__loading">Đang tải nội dung...</p>
          )}
        </div>

        <footer className="legal-modal__foot">
          <button type="button" className="legal-modal__ok" onClick={onClose}>
            Đã hiểu
          </button>
        </footer>
      </div>
    </div>
  );
}
