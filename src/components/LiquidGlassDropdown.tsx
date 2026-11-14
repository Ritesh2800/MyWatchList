import React, { useEffect, useRef, useState } from 'react';
import { CheckIcon, ChevronDownIcon } from './Icons';
import { ACETERNITY_GLASS_SURFACE_CLASS } from './LiquidGlassChrome';
import { LiquidGlass } from './ui/liquid-glass';

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
  const [resolvedAlign, setResolvedAlign] = useState<'left' | 'right'>(align);
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

      const estimatedMenuWidth = 228;
      if (align === 'right' && rect.right - estimatedMenuWidth < 12) {
        setResolvedAlign('left');
      } else if (align === 'left' && rect.left + estimatedMenuWidth > window.innerWidth - 12) {
        setResolvedAlign('right');
      } else {
        setResolvedAlign(align);
      }
    }
    setOpenState(!open);
  };

  const triggerInner = (
    <>
      {leadingIcon}
      <span className="truncate">{triggerLabel}</span>
      <ChevronDownIcon
        size={15}
        className={`shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? 'rotate-180' : ''} ${
          isActiveTrigger ? 'opacity-80' : 'text-[var(--muted)]'
        }`}
      />
    </>
  );

  return (
    <div ref={containerRef} className="relative inline-block max-w-full">
      {isActiveTrigger ? (
        <button
          ref={triggerRef}
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={handleToggle}
          className={`tap-press inline-flex min-h-[44px] max-w-full items-center justify-center gap-1.5 rounded-full bg-[var(--inverse-bg)] px-3.5 text-[13px] font-semibold whitespace-nowrap text-[var(--inverse-ink)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${triggerClassName}`}
        >
          {triggerInner}
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={handleToggle}
          className="tap-press inline-flex max-w-full rounded-full text-[13px] font-semibold whitespace-nowrap text-[var(--ink)] transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <LiquidGlass
            radius={999}
            bevelDepth={10}
            scale={28}
            aberration={2}
            frost={0.5}
            tint={0.48}
            className={`${ACETERNITY_GLASS_SURFACE_CLASS} max-w-full`}
            contentClassName={`flex min-h-[44px] max-w-full items-center justify-center gap-1.5 px-3.5 ${triggerClassName}`}
          >
            {triggerInner}
          </LiquidGlass>
        </button>
      )}

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={menuLabel || ariaLabel}
          className={`animate-menu-up absolute z-50 max-w-[calc(100vw-1.5rem)] ${menuWidthClass} ${
            resolvedAlign === 'left' ? 'left-0' : 'right-0'
          } ${openUpward ? 'bottom-full mb-2' : 'top-full mt-2'}`}
        >
          <LiquidGlass
            radius={22}
            bevelDepth={12}
            scale={28}
            aberration={2}
            frost={0.9}
            tint={0.72}
            className={ACETERNITY_GLASS_SURFACE_CLASS}
            contentClassName="p-1.5"
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
          </LiquidGlass>
        </div>
      )}
    </div>
  );
};
