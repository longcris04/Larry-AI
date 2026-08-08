import React from "react";

/**
 * AuthSelect
 * Bản dropdown của AuthInput — dùng chung class "form-group" / "form-field-icon"
 * nên trông giống hệt các ô nhập khác trong form đăng ký (xem AuthForms.css).
 */
export default function AuthSelect({
  id,
  label,
  value,
  onChange,
  leftIcon,
  placeholder = "Chọn...",
  options = [],
  required = false,
  disabled = false,
}) {
  return (
    <div className="form-group">
      {label && <label htmlFor={id}>{label}</label>}
      <div
        className={`form-field-icon form-field-icon--select${
          value ? "" : " form-field-icon--empty"
        }`}
      >
        {leftIcon && (
          <span className="form-field-icon__left" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        <select
          id={id}
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => {
            const optionValue = typeof option === "string" ? option : option.value;
            const optionLabel = typeof option === "string" ? option : option.label;
            return (
              <option key={optionValue} value={optionValue}>
                {optionLabel}
              </option>
            );
          })}
        </select>
        <span className="form-field-icon__caret" aria-hidden="true">
          ▾
        </span>
      </div>
    </div>
  );
}
