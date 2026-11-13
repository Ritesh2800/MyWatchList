import React, { useEffect, useRef, useState } from 'react';
import { CheckIcon, ChevronDownIcon } from './Icons';

export interface LiquidGlassOption {
  value: string;
  label: string;
  tone?: 'default' | 'danger';
}

interface LiquidGlassDropdownProps {
  ariaLabel: string;
  triggerLabel: string;
  options: LiquidGlassOption[];
  selectedValue?: string;
  onSelect: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  isActiveTrigger?: boolean;
  align?: 'left' | 'right';
  leadingIcon?: React.ReactNode;
  menuLabel?: string;
  menuWidthClass?: string;
  triggerClassName?: string;
}

export const LiquidGlassDropdown: React.FC<LiquidGlassDropdownProps> = ({
  ariaLabel,
  triggerLabel,
  options,
  selectedValue,
  onSelect,
  onOpenChange,
  isActiveTrigger = false,
  align = 'right',
  leadingIcon,
  menuLabel,
  menuWidthClass = 'w-52',
  triggerClassName = '',
}) => {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const setOpenState = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenState(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenState(false);
        triggerRef.current?.focus();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
        if (!items || items.length === 0) return;
        e.preventDefault();
        const activeIdx = Array.from(items).findIndex((el) => el === document.activeElement);
        const nextIdx =
          e.key === 'ArrowDown'
            ? (activeIdx + 1) % items.length
            : (activeIdx - 1 + items.length) % items.length;
        items[nextIdx]?.focus();
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleToggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const estimatedMenuHeight = options.length * 44 + 20;
      const usableBelow = window.innerHeight - rect.bottom - 104;
      const usableAbove = rect.top - 78;
      setOpenUpward(usableBelow < estimatedMenuHeight && usableAbove > usableBelow);
    }
    setOpenState(!open);
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={handleToggle}
        className={`tap-press inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
          isActiveTrigger
            ? 'bg-[var(--inverse-bg)] text-[var(--inverse-ink)]'
            : 'border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--ink)] hover:border-[var(--accent)]'
        } ${triggerClassName}`}
      >
        {leadingIcon}
        <span>{triggerLabel}</span>
        <ChevronDownIcon
          size={15}
          className={`shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? 'rotate-180' : ''} ${
            isActiveTrigger ? 'opacity-80' : 'text-[var(--muted)]'
          }`}
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={menuLabel || ariaLabel}
          className={`glass-menu glass-refract animate-menu-up absolute z-50 p-1.5 ${menuWidthClass} ${
            align === 'left' ? 'left-0' : 'right-0'
          } ${openUpward ? 'bottom-full mb-2' : 'top-full mt-2'}`}
        >
          {options.map((opt) => {
            const active = selectedValue !== undefined && selectedValue === opt.value;
            const isDanger = opt.tone === 'danger';
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpenState(false);
                  onSelect(opt.value);
                }}
                className={`tap-press flex min-h-[44px] w-full items-center justify-between gap-2 rounded-[15px] px-3.5 text-left text-[14px] font-semibold transition-all duration-150 ${
                  isDanger
                    ? 'glass-menu-item-danger'
                    : active
                      ? 'glass-active text-[var(--ink)]'
                      : 'glass-menu-item'
                }`}
              >
                <span>{opt.label}</span>
                {active && <CheckIcon size={15} className="animate-check-pop shrink-0 text-[var(--accent)]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
