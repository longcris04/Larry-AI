import React from 'react';
import '../../styles/GradientButton.css';

const GradientButton = ({
  children,
  variant = 'primary',
  size = 'lg',
  fullWidth = false,
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  onClick,
  className = '',
  type = 'button',
  ...props
}) => {
  const baseClasses = 'gradient-btn';
  const variantClass = `gradient-btn--${variant}`;
  const sizeClass = `gradient-btn--${size}`;
  const widthClass = fullWidth ? 'gradient-btn--full' : '';
  const disabledClass = disabled || loading ? 'gradient-btn--disabled' : '';
  const loadingClass = loading ? 'gradient-btn--loading' : '';

  const classNames = [
    baseClasses,
    variantClass,
    sizeClass,
    widthClass,
    disabledClass,
    loadingClass,
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={classNames}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && <span className="gradient-btn__spinner" aria-hidden="true" />}
      <span className="gradient-btn__content">
        {leftIcon && <span className="gradient-btn__icon gradient-btn__icon--left" aria-hidden="true">{leftIcon}</span>}
        <span className="gradient-btn__text">{children}</span>
        {rightIcon && <span className="gradient-btn__icon gradient-btn__icon--right" aria-hidden="true">{rightIcon}</span>}
      </span>
      <span className="gradient-btn__shine" aria-hidden="true" />
    </button>
  );
};

export default GradientButton;