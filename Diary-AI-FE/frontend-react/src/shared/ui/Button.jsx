import React from 'react';

const VARIANTS = {
  primary: 'btn btn-primary',
  secondary: 'btn btn-secondary',
  success: 'btn btn-success',
  warning: 'btn btn-warning',
  danger: 'btn btn-danger',
  outline: 'btn btn-outline',
  ghost: 'btn',
};

const SIZES = {
  xxs: { padding: '4px 8px', fontSize: '0.72rem', borderRadius: 10 },
  xs: { padding: '6px 10px', fontSize: '0.78rem', borderRadius: 11 },
  sm: { padding: '8px 12px', fontSize: '0.82rem', borderRadius: 12 },
  md: { padding: '10px 14px', fontSize: '0.90rem', borderRadius: 12 },
  lg: { padding: '12px 16px', fontSize: '0.98rem', borderRadius: 14 },
};

const Button = ({
  variant = 'primary',
  size = 'md',
  as = 'button',
  className = '',
  style,
  children,
  ...props
}) => {
  const Comp = as;
  const styles = SIZES[size] || SIZES.md;
  const classes = `${VARIANTS[variant] || VARIANTS.primary} ${className}`.trim();
  return (
    <Comp className={classes} style={{ ...styles, ...style }} {...props}>
      {children}
    </Comp>
  );
};

export default Button;
