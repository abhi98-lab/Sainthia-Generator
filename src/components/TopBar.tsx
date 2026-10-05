import React from 'react';
import { Download } from 'lucide-react';

export type ActiveView =
  | { type: 'dashboard' }
  | { type: 'case_vault' }
  | { type: 'master_templates' }
  | { type: 'generator'; slotId: string };

interface TopBarProps {
  activeView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  caseCount: number;
  configuredTemplatesCount: number;
  canInstall?: boolean;
  onInstall?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  onNavigate,
  caseCount,
  configuredTemplatesCount,
  canInstall = false,
  onInstall,
}) => {
  const isVaultActive = activeView.type === 'case_vault';
  const isTemplatesActive = activeView.type === 'master_templates';

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[#E2E8F0] shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand & Author */}
        <button
          type="button"
          onClick={() => onNavigate({ type: 'dashboard' })}
          className="text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] rounded-sm shrink-0"
        >
          <div className="text-base sm:text-lg font-bold tracking-tight text-[#0F172A] group-hover:text-[#1E3A8A] transition-colors leading-tight">
            Sainthia Generator
          </div>
          <div className="text-xs font-medium text-[#64748B] leading-tight mt-0.5">
            By Abhijit Gorai
          </div>
        </button>

        {/* Center: SAINTHIA PS */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => onNavigate({ type: 'dashboard' })}
            className="text-xs sm:text-sm font-bold tracking-[0.14em] text-[#0F172A] uppercase px-2.5 py-1 rounded-sm hover:text-[#1E3A8A] transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
          >
            SAINTHIA PS
          </button>
        </div>

        {/* Right: Case Vault, Master Templates & Install App */}
        <nav className="flex items-center gap-2 sm:gap-3 shrink-0" aria-label="Workspace Navigation">
          <button
            type="button"
            onClick={() => onNavigate({ type: 'case_vault' })}
            className={`px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap border ${
              isVaultActive
                ? 'bg-[#0F172A] text-white border-[#0F172A]'
                : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:bg-[#F8FAFC] hover:border-[#94A3B8]'
            }`}
          >
            <span>Case Vault</span>
            <span
              className={`ml-1.5 font-mono text-xs tabular-nums ${
                isVaultActive ? 'text-slate-300' : 'text-[#64748B]'
              }`}
            >
              ({caseCount})
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate({ type: 'master_templates' })}
            className={`px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap border ${
              isTemplatesActive
                ? 'bg-[#0F172A] text-white border-[#0F172A]'
                : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:bg-[#F8FAFC] hover:border-[#94A3B8]'
            }`}
          >
            <span>Master Templates</span>
            <span
              className={`ml-1.5 font-mono text-xs tabular-nums ${
                isTemplatesActive ? 'text-slate-300' : 'text-[#64748B]'
              }`}
            >
              ({configuredTemplatesCount}/5)
            </span>
          </button>

          {/* Install App button: shown when native install prompt is available; hides after install */}
          {canInstall && (
            <button
              type="button"
              onClick={onInstall}
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-md text-white bg-[#1E3A8A] hover:bg-[#1E40AF] transition-colors whitespace-nowrap border border-[#1E3A8A] cursor-pointer shadow-2xs"
              title="Install Sainthia Generator as a standalone app on your device"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install App</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
};
