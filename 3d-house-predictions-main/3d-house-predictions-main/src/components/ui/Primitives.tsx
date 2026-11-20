import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react';

export function BuildVisionLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap select-none">
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect
          x="2"
          y="2"
          width="24"
          height="24"
          rx="4"
          stroke="#172D9B"
          strokeWidth="1.5"
          fill="#EEF1FF"
        />
        <path
          d="M7 19.5V11.5L14 6.5L21 11.5V19.5H7Z"
          stroke="#3049F5"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M14 6.5V19.5M7 14.5H21"
          stroke="#172D9B"
          strokeWidth="1.1"
          strokeDasharray="2 1.5"
        />
      </svg>
      {!compact && (
        <span className="font-display text-[15px] font-bold tracking-tight text-[#171923]">
          BUILDVISION <span className="text-[#3049F5] font-semibold">AI</span>
        </span>
      )}
    </div>
  );
}

export function getInitialLetter(name?: string | null, email?: string | null): string {
  const cleanName = (name || '').trim();
  const matchName = cleanName.match(/[A-Za-z0-9]/);
  if (matchName) return matchName[0].toUpperCase();
  const cleanEmail = (email || '').trim();
  const matchEmail = cleanEmail.match(/[A-Za-z0-9]/);
  if (matchEmail) return matchEmail[0].toUpperCase();
  return 'A';
}

export function UserAvatar({
  name,
  email,
  size = 'sm',
  className = '',
}: {
  name?: string | null;
  email?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const initial = getInitialLetter(name, email);
  const sizes = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-md bg-[#3049F5] text-white border border-[#172D9B]/20 font-display font-semibold select-none shrink-0 ${sizes[size]} ${className}`}
    >
      {initial}
    </span>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3049F5] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';
  const sizes = {
    sm: 'h-9 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-11 px-5 text-sm',
  };
  const variants = {
    primary: 'bg-[#3049F5] text-white hover:bg-[#172D9B] border border-[#3049F5]',
    secondary:
      'bg-white text-[#171923] border border-[#E5E6EB] hover:bg-[#F1F0EC] hover:border-[#D4D6DE]',
    ghost: 'bg-transparent text-[#777B87] hover:text-[#171923] hover:bg-[#F1F0EC]',
    danger: 'bg-white text-[#D94A50] border border-[#E5E6EB] hover:bg-[#FEF2F2]',
  };
  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  rightSlot?: React.ReactNode;
}

export function InputField({
  label,
  error,
  rightSlot,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-[13px] font-medium text-[#171923]"
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <input
          id={inputId}
          className={`w-full h-10 px-3.5 text-sm text-[#171923] bg-white border ${
            error ? 'border-[#D94A50]' : 'border-[#E5E6EB]'
          } rounded-lg placeholder:text-[#777B87]/70 focus:outline-none focus:border-[#3049F5] focus:ring-2 focus:ring-[#EEF1FF] transition-colors ${
            rightSlot ? 'pr-10' : ''
          } ${className}`}
          {...props}
        />
        {rightSlot && (
          <div className="absolute right-2.5 flex items-center">{rightSlot}</div>
        )}
      </div>
      {error && <p className="text-xs text-[#D94A50]">{error}</p>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function SelectField({ label, className = '', children, ...props }: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-[13px] font-medium text-[#171923]">{label}</label>
      )}
      <div className="relative">
        <select
          className={`w-full h-10 pl-3.5 pr-9 text-sm text-[#171923] bg-white border border-[#E5E6EB] rounded-lg appearance-none focus:outline-none focus:border-[#3049F5] focus:ring-2 focus:ring-[#EEF1FF] transition-colors ${className}`}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          size={15}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#3049F5]"
        />
      </div>
    </div>
  );
}

export function Card({
  children,
  className = '',
  padding = 'p-5',
}: {
  children: React.ReactNode;
  className?: string;
  padding?: string;
}) {
  return (
    <div
      className={`bg-white border border-[#E5E6EB] rounded-lg ${padding} ${className}`}
    >
      {children}
    </div>
  );
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative flex items-center ${className}`}>
      <Search size={15} className="absolute left-3 text-[#3049F5] pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 pl-9 pr-8 text-sm bg-white border border-[#E5E6EB] rounded-lg text-[#171923] placeholder:text-[#777B87] focus:outline-none focus:border-[#3049F5]"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2.5 text-[#777B87] hover:text-[#171923]"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function Breadcrumbs({
  items,
}: {
  items: Array<{ label: string; onClick?: () => void }>;
}) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#777B87]">
      {items.map((item, idx) => (
        <React.Fragment key={item.label}>
          {idx > 0 && <ChevronRight size={13} className="text-[#777B87]/70" />}
          {item.onClick ? (
            <button
              type="button"
              onClick={item.onClick}
              className="hover:text-[#3049F5] transition-colors cursor-pointer"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-[#171923] font-medium">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

export function Tabs<T extends string>({
  items,
  active,
  onChange,
}: {
  items: Array<{ key: T; label: string; icon?: React.ReactNode }>;
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 p-1 bg-[#F1F0EC] border border-[#E5E6EB] rounded-lg overflow-x-auto max-w-full">
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isActive
                ? 'bg-white text-[#3049F5] border border-[#E5E6EB]'
                : 'text-[#777B87] hover:text-[#171923] border border-transparent'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#171923]/30"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} bg-white border border-[#E5E6EB] rounded-lg p-6 max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E5E6EB]">
          <div>
            <h3 className="text-base font-semibold text-[#171923]">{title}</h3>
            {subtitle && <p className="text-xs text-[#777B87] mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-md text-[#777B87] hover:text-[#171923] hover:bg-[#F1F0EC] cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
        <div className="pt-4">{children}</div>
      </div>
    </div>
  );
}

export function DropdownMenu({
  trigger,
  children,
  align = 'right',
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className={`absolute top-full mt-1.5 ${
            align === 'right' ? 'right-0' : 'left-0'
          } min-w-[220px] bg-white border border-[#E5E6EB] rounded-lg py-1.5 z-40 shadow-sm`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DataTable<T>({
  columns,
  rows,
  emptyMessage = 'No records available.',
  onRowClick,
}: {
  columns: Array<{
    key: string;
    header: string;
    align?: 'left' | 'right';
    render: (row: T) => React.ReactNode;
  }>;
  rows: T[];
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="border border-[#E5E6EB] rounded-lg bg-white py-10 px-4 text-center text-sm text-[#777B87]">
        {emptyMessage}
      </div>
    );
  }
  return (
    <div className="border border-[#E5E6EB] rounded-lg bg-white overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-[#E5E6EB] bg-[#F1F0EC]/50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`py-2.5 px-4 text-xs font-medium text-[#777B87] whitespace-nowrap ${
                  col.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E5E6EB]">
          {rows.map((row, idx) => (
            <tr
              key={idx}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`text-sm text-[#171923] ${
                onRowClick ? 'hover:bg-[#EEF1FF]/50 cursor-pointer' : 'hover:bg-[#F1F0EC]/30'
              } transition-colors`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`py-3 px-4 ${
                    col.align === 'right' ? 'text-right tabular-nums' : 'text-left'
                  }`}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border border-[#E5E6EB] rounded-lg bg-white p-10 text-center flex flex-col items-center justify-center max-w-xl mx-auto">
      <div className="w-11 h-11 rounded-lg bg-[#EEF1FF] text-[#3049F5] flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-[#171923]">{title}</h3>
      <p className="text-sm text-[#777B87] mt-1.5 mb-5 max-w-md">{description}</p>
      {action}
    </div>
  );
}
