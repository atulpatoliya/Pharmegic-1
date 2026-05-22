'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { useEffect } from 'react';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Dialog({ isOpen, onClose, title, children }: DialogProps) {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Dialog Content */}
      <div className="relative w-full max-w-lg rounded-lg border border-slate-100 bg-white p-6 shadow-xl transition-all duration-300 animate-slide-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-sm p-1 text-slate-400 opacity-70 transition-opacity hover:opacity-100 focus:outline-hidden hover:bg-slate-50 cursor-pointer"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </button>
        </div>

        {/* Body */}
        <div className="py-4">{children}</div>
      </div>
    </div>
  );
}
