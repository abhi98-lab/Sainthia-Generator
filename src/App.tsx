/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  ArrowRight,
  FolderOpen,
  FileText,
  FileSpreadsheet,
  Download,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import {
  CaseRecord,
  GENERATOR_MODULES,
  MasterTemplateRecord,
  RecentRequisitionRecord,
  TemplateSlotId,
  getAllCases,
  getAllMasterTemplates,
  getAllRecentRequisitions,
  deleteRecentRequisition,
  clearRecentRequisitions,
  checkIndexedDBHealth,
  formatTimestamp,
} from './db';
import { downloadBlob, openDocxBlob } from './docxEngine';
import { TopBar, ActiveView } from './components/TopBar';
import { CaseVaultView } from './components/CaseVaultView';
import { MasterTemplatesView } from './components/MasterTemplatesView';
import { GeneratorWorkspaceView } from './components/GeneratorWorkspaceView';
import { usePWAInstall } from './usePWAInstall';

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>({ type: 'dashboard' });
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [templates, setTemplates] = useState<
    Record<TemplateSlotId, MasterTemplateRecord | undefined>
  >({
    kyc_requisition: undefined,
    cdr_caf_sdr: undefined,
    imei_searching: undefined,
    ipdr_subscriber: undefined,
    google_notice: undefined,
  });
  const [recentRequisitions, setRecentRequisitions] = useState<RecentRequisitionRecord[]>([]);
  const [isDbActive, setIsDbActive] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadWorkspaceData = useCallback(async () => {
    try {
      const [loadedCases, loadedTemplates, loadedRecent, dbHealthy] = await Promise.all([
        getAllCases(),
        getAllMasterTemplates(),
        getAllRecentRequisitions(),
        checkIndexedDBHealth(),
      ]);
      setCases(loadedCases);
      setTemplates(loadedTemplates);
      setRecentRequisitions(loadedRecent);
      setIsDbActive(dbHealthy);
    } catch {
      setIsDbActive(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  const { canInstall, triggerInstall } = usePWAInstall();
  const [deletingRecentId, setDeletingRecentId] = useState<string | null>(null);

  const configuredTemplatesCount = Object.values(templates).filter(Boolean).length;

  const handleNavigate = (view: ActiveView) => {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDownloadSavedRecent = (record: RecentRequisitionRecord) => {
    if (record.fileBlob) {
      downloadBlob(record.fileBlob, record.filename);
    }
  };

  const handleDeleteRecentItem = async (id: string) => {
    try {
      await deleteRecentRequisition(id);
      setDeletingRecentId(null);
      await loadWorkspaceData();
    } catch (err) {
      console.error('Failed to delete recent requisition', err);
    }
  };

  const handleClearRecent = async () => {
    if (window.confirm('Clear all recent requisition logs from local storage?')) {
      await clearRecentRequisitions();
      await loadWorkspaceData();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F7FA] text-[#0F172A]">
      {/* Official Top Bar */}
      <TopBar
        activeView={activeView}
        onNavigate={handleNavigate}
        caseCount={cases.length}
        configuredTemplatesCount={configuredTemplatesCount}
        canInstall={canInstall}
        onInstall={triggerInstall}
      />

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeView.type === 'dashboard' && (
          <div className="space-y-8">
            {/* Workspace Masthead */}
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-5 border-b border-[#E2E8F0]">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight">
                  Sainthia Generator
                </h1>
                <p className="text-sm font-medium text-[#475569] mt-0.5">
                  By Abhijit Gorai
                </p>
              </div>
              <div className="text-xs font-bold tracking-widest text-[#1E3A8A] uppercase">
                SAINTHIA PS
              </div>
            </div>

            {/* Primary Workspace Card: CASE VAULT */}
            <section aria-label="Case Vault" className="w-full">
              <div className="bg-white border border-[#E2E8F0] hover:border-[#CBD5E1] rounded-lg p-6 sm:p-7 shadow-2xs flex flex-col justify-between transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1.5 max-w-3xl">
                    <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
                      CASE VAULT
                    </h2>
                  </div>

                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-5 py-3 text-left sm:text-right shrink-0">
                    <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-[#0F172A] block leading-none">
                      {isLoading ? '—' : cases.length}
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] mt-1 block">
                      Saved Cases
                    </span>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-[#E2E8F0] flex items-center justify-between gap-3">
                  <span className="text-xs text-[#64748B]">
                    {cases.length} {cases.length === 1 ? 'case' : 'cases'} available
                  </span>
                  <button
                    type="button"
                    onClick={() => handleNavigate({ type: 'case_vault' })}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-[#0F172A] hover:bg-[#1E293B] rounded-md transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span>Open Case Vault</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </section>

            {/* REQUISITION GENERATORS */}
            <section aria-labelledby="generators-heading" className="space-y-4">
              <div className="flex items-baseline justify-between pb-1 border-b border-[#E2E8F0]">
                <h2
                  id="generators-heading"
                  className="text-base sm:text-lg font-bold text-[#0F172A] tracking-tight uppercase"
                >
                  REQUISITION GENERATORS
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {GENERATOR_MODULES.map((mod) => (
                  <div
                    key={mod.slotId}
                    className="bg-white border border-[#E2E8F0] hover:border-[#CBD5E1] rounded-lg p-5 shadow-2xs flex flex-col justify-between transition-colors"
                  >
                    <div className="space-y-2">
                      <h3 className="text-base font-bold text-[#0F172A] tracking-tight">
                        {mod.indexNumber} {mod.title}
                      </h3>
                    </div>

                    <div className="pt-4 mt-4 border-t border-[#E2E8F0] flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          handleNavigate({ type: 'generator', slotId: mod.slotId })
                        }
                        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#0F172A] hover:text-[#1E3A8A] transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <span>Create Requisition</span>
                        <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Bottom Grid: 4. SYSTEM STATUS & 5. RECENT REQUISITIONS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* 4. SYSTEM STATUS */}
              <section
                aria-labelledby="system-status-heading"
                className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-lg p-5 sm:p-6 shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <div className="pb-3 mb-3 border-b border-[#E2E8F0] flex items-center justify-between">
                    <h2
                      id="system-status-heading"
                      className="text-sm sm:text-base font-bold text-[#0F172A] uppercase tracking-wider"
                    >
                      System Status
                    </h2>
                    <span className="text-xs font-mono text-[#15803D] font-semibold">
                      Operational
                    </span>
                  </div>

                  <dl className="divide-y divide-[#E2E8F0] text-xs sm:text-sm">
                    <div className="py-2.5 flex items-center justify-between gap-4">
                      <dt className="font-medium text-[#475569]">Case Vault</dt>
                      <dd className="font-mono font-semibold text-[#0F172A] tabular-nums">
                        {cases.length} {cases.length === 1 ? 'case saved' : 'cases saved'}
                      </dd>
                    </div>

                    <div className="py-2.5 flex items-center justify-between gap-4">
                      <dt className="font-medium text-[#475569]">Master Templates</dt>
                      <dd className="font-mono font-semibold text-[#0F172A] tabular-nums">
                        {configuredTemplatesCount} / 5 configured
                      </dd>
                    </div>

                    <div className="py-2.5 flex items-center justify-between gap-4">
                      <dt className="font-medium text-[#475569]">System</dt>
                      <dd className="font-mono font-semibold text-[#15803D]">
                        Active
                      </dd>
                    </div>

                    <div className="py-2.5 flex items-center justify-between gap-4">
                      <dt className="font-medium text-[#475569]">Generators</dt>
                      <dd className="font-mono font-semibold text-[#0F172A] tabular-nums">
                        5
                      </dd>
                    </div>

                    <div className="py-2.5 flex items-center justify-between gap-4">
                      <dt className="font-medium text-[#475569]">Recent Requisitions</dt>
                      <dd className="font-mono font-semibold text-[#0F172A] tabular-nums">
                        {recentRequisitions.length}
                      </dd>
                    </div>
                  </dl>
                </div>
              </section>

              {/* 5. RECENT REQUISITIONS */}
              <section
                aria-labelledby="recent-requisitions-heading"
                className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-lg p-5 sm:p-6 shadow-2xs flex flex-col"
              >
                <div className="pb-3 mb-4 border-b border-[#E2E8F0] flex items-center justify-between">
                  <div>
                    <h2
                      id="recent-requisitions-heading"
                      className="text-sm sm:text-base font-bold text-[#0F172A] uppercase tracking-wider"
                    >
                      Recent Requisitions
                    </h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-[#64748B] tabular-nums">
                      Count: {recentRequisitions.length}
                    </span>
                    {recentRequisitions.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearRecent}
                        className="text-[11px] font-semibold text-[#B91C1C] hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear Log</span>
                      </button>
                    )}
                  </div>
                </div>

                {recentRequisitions.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-8 px-4 bg-[#F8FAFC] border border-dashed border-[#CBD5E1] rounded-md">
                    <FileSpreadsheet className="w-7 h-7 text-[#64748B] mb-2.5" />
                    <h3 className="text-sm font-bold text-[#0F172A]">
                      No Recent Requisitions Generated
                    </h3>
                    <p className="text-xs text-[#64748B] max-w-md mt-1 leading-relaxed">
                      Generated requisition documents for SAINTHIA PS will be logged in this section once DOCX generation is executed.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {recentRequisitions.map((req) => (
                      <div
                        key={req.id}
                        className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#CBD5E1] rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#0F172A] truncate">
                              {req.filename}
                            </span>
                            <span className="text-[10px] font-mono text-[#64748B] uppercase">
                              [{req.moduleTitle}]
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 text-[#475569]">
                            <span>
                              <strong>Case Ref:</strong> {req.caseReference}
                            </span>
                            <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
                            <span>{req.targetSubject}</span>
                            <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
                            <span className="font-mono text-[#64748B]">
                              {formatTimestamp(req.generatedAt)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                          {req.fileBlob && (
                            <>
                              <button
                                type="button"
                                onClick={() => openDocxBlob(req.fileBlob!, req.filename)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 font-semibold text-white bg-[#1E3A8A] hover:bg-[#1E40AF] rounded transition-colors cursor-pointer"
                                title="Open document in device viewer"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Open</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadSavedRecent(req)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] rounded hover:bg-[#F1F5F9] transition-colors cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5 text-[#475569]" />
                                <span>Download</span>
                              </button>
                            </>
                          )}

                          {deletingRecentId !== req.id ? (
                            <button
                              type="button"
                              onClick={() => setDeletingRecentId(req.id)}
                              className="p-1.5 text-[#64748B] hover:text-[#B91C1C] rounded border border-transparent hover:border-[#FECACA] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                              title="Delete record from log"
                              aria-label="Delete entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <div className="flex items-center gap-1.5 bg-[#FEF2F2] border border-[#FECACA] px-2 py-1 rounded">
                              <span className="text-[11px] font-semibold text-[#B91C1C]">Delete?</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteRecentItem(req.id)}
                                className="px-2 py-0.5 text-[11px] font-semibold text-white bg-[#B91C1C] hover:bg-[#991B1B] rounded transition-colors cursor-pointer"
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingRecentId(null)}
                                className="px-1.5 py-0.5 text-[11px] font-semibold text-[#475569] hover:text-[#0F172A] transition-colors cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {activeView.type === 'case_vault' && (
          <CaseVaultView
            cases={cases}
            onRefreshCases={loadWorkspaceData}
            onBack={() => handleNavigate({ type: 'dashboard' })}
          />
        )}

        {activeView.type === 'master_templates' && (
          <MasterTemplatesView
            templates={templates}
            onRefreshTemplates={loadWorkspaceData}
            onBack={() => handleNavigate({ type: 'dashboard' })}
            onOpenGenerator={(slotId) =>
              handleNavigate({ type: 'generator', slotId })
            }
          />
        )}

        {activeView.type === 'generator' && (
          <GeneratorWorkspaceView
            moduleMeta={
              GENERATOR_MODULES.find((m) => m.slotId === activeView.slotId) ||
              GENERATOR_MODULES[0]
            }
            cases={cases}
            masterTemplate={
              templates[activeView.slotId as TemplateSlotId]
            }
            onBack={() => handleNavigate({ type: 'dashboard' })}
            onNavigateCaseVault={() => handleNavigate({ type: 'case_vault' })}
            onNavigateMasterTemplates={() =>
              handleNavigate({ type: 'master_templates' })
            }
            onRequisitionGenerated={loadWorkspaceData}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#E2E8F0] mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#64748B]">
          <div>
            <span className="font-semibold text-[#0F172A]">Sainthia Generator</span> · SAINTHIA PS
          </div>
          <div>
            By Abhijit Gorai
          </div>
        </div>
      </footer>
    </div>
  );
}
