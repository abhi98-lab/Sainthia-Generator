import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Search,
  FolderOpen,
  X,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  CaseRecord,
  saveCaseRecord,
  deleteCaseRecord,
  formatTimestamp,
} from '../db';

interface CaseVaultViewProps {
  cases: CaseRecord[];
  onRefreshCases: () => Promise<void>;
  onBack: () => void;
}

interface CaseFormState {
  id: string | null;
  caseTitle: string;
  caseReference: string;
  caseGist: string;
  ioName: string;
}

const EMPTY_FORM: CaseFormState = {
  id: null,
  caseTitle: '',
  caseReference: '',
  caseGist: '',
  ioName: '',
};

export const CaseVaultView: React.FC<CaseVaultViewProps> = ({
  cases,
  onRefreshCases,
  onBack,
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formState, setFormState] = useState<CaseFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  const filteredCases = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter(
      (c) =>
        c.caseTitle.toLowerCase().includes(q) ||
        c.caseReference.toLowerCase().includes(q) ||
        c.caseGist.toLowerCase().includes(q) ||
        c.ioName.toLowerCase().includes(q)
    );
  }, [cases, searchQuery]);

  const showTemporaryFeedback = (msg: string) => {
    setFeedbackBanner(msg);
    window.setTimeout(() => {
      setFeedbackBanner((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const handleOpenAdd = () => {
    setFormState(EMPTY_FORM);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (record: CaseRecord) => {
    setFormState({
      id: record.id,
      caseTitle: record.caseTitle,
      caseReference: record.caseReference,
      caseGist: record.caseGist,
      ioName: record.ioName,
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleCancelForm = () => {
    setIsFormOpen(false);
    setFormState(EMPTY_FORM);
    setFormError(null);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = formState.caseTitle.trim();
    const reference = formState.caseReference.trim();
    const gist = formState.caseGist.trim();
    const io = formState.ioName.trim();

    if (!title || !reference || !io) {
      setFormError('Case Title, Case Reference, and IO Name are required fields.');
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      const now = Date.now();
      const existing = formState.id ? cases.find((c) => c.id === formState.id) : undefined;
      const record: CaseRecord = {
        id: formState.id || `case_${now}_${Math.random().toString(36).slice(2, 8)}`,
        caseTitle: title,
        caseReference: reference,
        caseGist: gist,
        ioName: io,
        createdAt: existing ? existing.createdAt : now,
        updatedAt: now,
      };

      await saveCaseRecord(record);
      await onRefreshCases();
      setIsFormOpen(false);
      setFormState(EMPTY_FORM);
      showTemporaryFeedback(
        formState.id ? 'Case record updated in Case Vault.' : 'New case saved to Case Vault.'
      );
    } catch {
      setFormError('Unable to save case to IndexedDB. Please check browser storage permissions.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async (id: string) => {
    try {
      await deleteCaseRecord(id);
      setDeletingId(null);
      if (formState.id === id) {
        handleCancelForm();
      }
      await onRefreshCases();
      showTemporaryFeedback('Case record deleted from Case Vault.');
    } catch {
      setFormError('Failed to delete case record.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action & Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#475569] hover:text-[#0F172A] mb-2 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
              Case Vault
            </h1>
            <span className="text-xs font-mono tabular-nums text-[#64748B]">
              {cases.length} {cases.length === 1 ? 'Case' : 'Cases'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-center">
          {!isFormOpen && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-[#0F172A] hover:bg-[#1E293B] rounded-md transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Case</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackBanner && (
        <div className="bg-white border border-[#CBD5E1] border-l-4 border-l-[#15803D] rounded-md px-4 py-3 flex items-center justify-between text-sm text-[#0F172A] shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Check className="w-4 h-4 text-[#15803D] shrink-0" />
            <span className="font-medium">{feedbackBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-[#64748B] hover:text-[#0F172A] p-1"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add / Edit Case Form Panel */}
      {isFormOpen && (
        <section
          aria-label={formState.id ? 'Edit Case Form' : 'Add Case Form'}
          className="bg-white border border-[#CBD5E1] rounded-lg p-5 sm:p-6 shadow-xs"
        >
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#E2E8F0]">
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">
                {formState.id ? 'Edit Case Record' : 'Add New Case Record'}
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                All case details are stored strictly in your browser&apos;s local IndexedDB.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCancelForm}
              className="p-1.5 text-[#64748B] hover:text-[#0F172A] rounded-md hover:bg-[#F8FAFC] transition-colors"
              aria-label="Close form"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div className="mb-4 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-md flex items-center gap-2 text-xs font-medium text-[#B91C1C]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmitForm} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="caseTitle"
                  className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-1.5"
                >
                  Case Title <span className="text-[#B91C1C]">*</span>
                </label>
                <input
                  id="caseTitle"
                  type="text"
                  value={formState.caseTitle}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, caseTitle: e.target.value }))
                  }
                  placeholder="Enter Case Title"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="caseReference"
                  className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-1.5"
                >
                  Case Reference <span className="text-[#B91C1C]">*</span>
                </label>
                <input
                  id="caseReference"
                  type="text"
                  value={formState.caseReference}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, caseReference: e.target.value }))
                  }
                  placeholder="Enter Case Reference"
                  className="w-full px-3.5 py-2 text-sm font-mono bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="ioName"
                  className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-1.5"
                >
                  IO Name <span className="text-[#B91C1C]">*</span>
                </label>
                <input
                  id="ioName"
                  type="text"
                  value={formState.ioName}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, ioName: e.target.value }))
                  }
                  placeholder="Enter Investigating Officer Name"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A]"
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="caseGist"
                className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-1.5"
              >
                Case Gist
              </label>
              <textarea
                id="caseGist"
                rows={4}
                value={formState.caseGist}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, caseGist: e.target.value }))
                }
                placeholder="Enter brief summary / gist of the case..."
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A] leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-[#475569] bg-white border border-[#CBD5E1] rounded-md hover:bg-[#F8FAFC] hover:text-[#0F172A] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-[#0F172A] hover:bg-[#1E293B] disabled:opacity-50 rounded-md transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Save Case'}</span>
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Search & Filter Bar (when cases exist) */}
      {cases.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#E2E8F0] rounded-lg p-3.5 shadow-2xs">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter saved cases by title, reference, gist, or IO name..."
              className="w-full pl-9 pr-3.5 py-1.5 text-xs sm:text-sm bg-[#F8FAFC] border border-[#CBD5E1] rounded-md text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:bg-white focus:border-[#1E3A8A]"
            />
          </div>
          <div className="text-xs text-[#64748B] font-mono tabular-nums">
            Showing {filteredCases.length} of {cases.length} saved record{cases.length === 1 ? '' : 's'}
          </div>
        </div>
      )}

      {/* Saved Cases List or Empty State */}
      {cases.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-10 text-center shadow-2xs">
          <div className="w-10 h-10 rounded-md bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center mx-auto mb-3 text-[#475569]">
            <FolderOpen className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-[#0F172A]">No Cases Saved in Case Vault</h2>
          <p className="text-xs sm:text-sm text-[#64748B] max-w-md mx-auto mt-1 mb-5">
            Add your investigation case records (Case Title, Case Reference, Case Gist, and IO Name) to store them locally in IndexedDB for requisition preparation.
          </p>
          {!isFormOpen && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#0F172A] hover:bg-[#1E293B] rounded-md transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Case</span>
            </button>
          )}
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-8 text-center shadow-2xs">
          <p className="text-sm font-medium text-[#0F172A]">No matching cases found</p>
          <p className="text-xs text-[#64748B] mt-1">
            No saved records match &ldquo;{searchQuery}&rdquo;.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCases.map((item) => {
            const isConfirmingDelete = deletingId === item.id;
            return (
              <article
                key={item.id}
                className="bg-white border border-[#E2E8F0] hover:border-[#CBD5E1] rounded-lg p-5 transition-colors shadow-2xs"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="text-base font-bold text-[#0F172A] break-words">
                        {item.caseTitle}
                      </h3>
                      <span className="text-xs font-mono font-semibold text-[#1E3A8A] tabular-nums">
                        Ref: {item.caseReference}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#475569]">
                      <span>
                        <strong className="font-semibold text-[#0F172A]">IO Name:</strong>{' '}
                        {item.ioName}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums text-[#64748B]">
                        Updated {formatTimestamp(item.updatedAt)}
                      </span>
                    </div>

                    <div className="pt-1">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] mb-0.5">
                        Case Gist
                      </div>
                      {item.caseGist ? (
                        <p className="text-sm text-[#334155] whitespace-pre-line leading-relaxed">
                          {item.caseGist}
                        </p>
                      ) : (
                        <p className="text-xs italic text-[#94A3B8]">No case gist provided.</p>
                      )}
                    </div>
                  </div>

                  {/* Action Controls */}
                  <div className="flex items-center gap-2 shrink-0 self-start pt-1 lg:pt-0">
                    {!isConfirmingDelete ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] rounded-md hover:bg-[#F8FAFC] hover:border-[#94A3B8] transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5 text-[#475569]" />
                          <span>Edit Case</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(item.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#B91C1C] bg-white border border-[#FECACA] rounded-md hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Case</span>
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 bg-[#FEF2F2] border border-[#FECACA] px-3 py-1.5 rounded-md">
                        <span className="text-xs font-semibold text-[#B91C1C]">
                          Confirm Delete?
                        </span>
                        <button
                          type="button"
                          onClick={() => handleConfirmDelete(item.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-white bg-[#B91C1C] hover:bg-[#991B1B] rounded-sm transition-colors cursor-pointer"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(null)}
                          className="px-2 py-1 text-xs font-semibold text-[#475569] hover:text-[#0F172A] transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
