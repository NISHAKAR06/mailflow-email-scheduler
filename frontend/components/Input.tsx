import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
}

export function Input({
  label,
  error,
  helpText,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-primary-800">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`
          w-full px-3 py-2 text-sm bg-white border rounded
          placeholder:text-primary-400
          focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent
          disabled:bg-primary-50 disabled:text-primary-500
          ${error ? 'border-danger focus:ring-danger/30 focus:border-danger' : 'border-primary-300'}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      {helpText && !error && <p className="text-xs text-primary-500">{helpText}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({
  label,
  error,
  className = '',
  id,
  ...props
}: TextareaProps) {
  const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={textareaId} className="block text-sm font-medium text-primary-800">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={`
          w-full px-3 py-2 text-sm bg-white border rounded resize-y min-h-[80px]
          placeholder:text-primary-400
          focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent
          disabled:bg-primary-50 disabled:text-primary-500
          ${error ? 'border-danger focus:ring-danger/30 focus:border-danger' : 'border-primary-300'}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
