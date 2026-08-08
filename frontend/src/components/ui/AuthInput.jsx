import React from "react";

/**
 * AuthInput
 * Drop-in replacement for the raw <div className="form-group"><input/></div>
 * blocks in Login.jsx / Register.jsx. Keeps the same "form-group" class so it
 * inherits spacing/label rules already defined in AuthForms.css, and adds a
 * rounded icon field on top (see the .form-field-icon rules appended to
 * AuthForms.css).
 */
export default function AuthInput({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  leftIcon,
  rightIcon,
  onRightIconClick,
  required = false,
  disabled = false,
  minLength,
}) {
  return (
    <div className="form-group">
      {label && <label htmlFor={id}>{label}</label>}
      <div className="form-field-icon">
        {leftIcon && (
          <span className="form-field-icon__left" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          minLength={minLength}
        />
        {rightIcon && (
          <button
            type="button"
            className="form-field-icon__right"
            onClick={onRightIconClick}
            tabIndex={-1}
            aria-label="Hiện/ẩn mật khẩu"
          >
            {rightIcon}
          </button>
        )}
      </div>
    </div>
  );
}
