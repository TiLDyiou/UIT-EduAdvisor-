import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
};

const Button = ({ children, className = '', ...rest }: ButtonProps) => {
  return (
    <button
      className={`flex items-center justify-center px-5 py-2 space-x-3 rounded disabled:opacity-75 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
};

export default Button;
