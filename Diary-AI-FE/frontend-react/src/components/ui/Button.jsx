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
  xxs: { padding: '2px 6px', fontSize: '0.7rem', borderRadius: 6 },
  xs: { padding: '4px 8px', fontSize: '0.78rem', borderRadius: 6 },
  sm: { padding: '6px 10px', fontSize: '0.8rem', borderRadius: 6 },
  md: { padding: '8px 14px', fontSize: '0.875rem', borderRadius: 8 },
  lg: { padding: '10px 16px', fontSize: '0.95rem', borderRadius: 10 },
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
