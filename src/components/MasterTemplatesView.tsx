import React, { useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  X,
} from 'lucide-react';
import {
  GENERATOR_MODULES,
  MasterTemplateRecord,
  TemplateSlotId,
  saveMasterTemplate,
  formatBytes,
  formatTimestamp,
} from '../db';

interface MasterTemplatesViewProps {
  templates: Record<TemplateSlotId, MasterTemplateRecord | undefined>;
  onRefreshTemplates: () => Promise<void>;
  onBack: () => void;
  onOpenGenerator: (slotId: TemplateSlotId) => void;
}

export const MasterTemplatesView: React.FC<MasterTemplatesViewProps> = ({
  templates,
  onRefreshTemplates,
  onBack,
  onOpenGenerator,
}) => {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [uploadingSlot, setUploadingSlot] = useState<TemplateSlotId | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const configuredCount = Object.values(templates).filter(Boolean).length;

  const triggerFileSelect = (slotId: TemplateSlotId) => {
    setErrorMessage(null);
    const input = fileInputRefs.current[slotId];
    if (input) {
      input.value = '';
      input.click();
    }
  };

  const handleFileChange = async (
    slotId: TemplateSlotId,
    templateName: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    const isDocxExtension = file.name.toLowerCase().endsWith('.docx');
    if (!isDocxExtension) {
      setErrorMessage(
        `Invalid file format for "${templateName}". Only Microsoft Word .docx files are accepted.`
      );
      event.target.value = '';
      return;
    }

    setUploadingSlot(slotId);
    try {
      const record: MasterTemplateRecord = {
        slotId,
        templateName,
        fileName: file.name,
        fileSize: file.size,
        fileBlob: file,
        uploadedAt: Date.now(),
      };

      await saveMasterTemplate(record);
      await onRefreshTemplates();
      setSuccessMessage(`Master template for "${templateName}" stored in local IndexedDB.`);
      window.setTimeout(() => {
        setSuccessMessage((prev) =>
          prev?.includes(templateName) ? null : prev
        );
      }, 3500);
    } catch {
      setErrorMessage(`Failed to store "${file.name}" in IndexedDB.`);
    } finally {
      setUploadingSlot(null);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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
              Master Templates
            </h1>
            <span className="text-xs font-mono tabular-nums text-[#64748B]">
              {configuredCount} / 5 Configured
            </span>
          </div>
        </div>
      </div>

      {/* Feedback Alerts */}
      {errorMessage && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-md px-4 py-3 flex items-center justify-between text-xs sm:text-sm text-[#B91C1C]">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-[#B91C1C] hover:opacity-75 p-1"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-white border border-[#CBD5E1] border-l-4 border-l-[#15803D] rounded-md px-4 py-3 flex items-center justify-between text-xs sm:text-sm text-[#0F172A] shadow-2xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-[#64748B] hover:text-[#0F172A] p-1"
            aria-label="Dismiss notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 5 Template Slots */}
      <div className="space-y-3">
        {GENERATOR_MODULES.map((slot) => {
          const existing = templates[slot.slotId];
          const isUploading = uploadingSlot === slot.slotId;

          return (
            <div
              key={slot.slotId}
              className="bg-white border border-[#E2E8F0] hover:border-[#CBD5E1] rounded-lg p-5 transition-colors shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              {/* Left: Template Name & Current Master Status */}
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono font-semibold text-[#64748B] tabular-nums">
                    {slot.indexNumber}
                  </span>
                  <h2 className="text-base font-bold text-[#0F172A] tracking-tight">
                    {slot.title}
                  </h2>
                </div>

                {/* Current Master Status (unboxed text metadata with separators) */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span className="font-semibold text-[#475569]">Current Master Status:</span>
                  {existing ? (
                    <>
                      <span className="inline-flex items-center gap-1 font-semibold text-[#15803D]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Configured</span>
                      </span>
                      <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
                      <span className="inline-flex items-center gap-1 font-mono text-[#0F172A]">
                        <FileText className="w-3.5 h-3.5 text-[#475569]" />
                        <span className="truncate max-w-[220px] sm:max-w-[300px]">
                          {existing.fileName}
                        </span>
                      </span>
                      <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
                      <span className="font-mono tabular-nums text-[#64748B]">
                        {formatBytes(existing.fileSize)}
                      </span>
                      <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
                      <span className="font-mono tabular-nums text-[#64748B]">
                        Updated {formatTimestamp(existing.uploadedAt)}
                      </span>
                    </>
                  ) : (
                    <span className="text-[#64748B] font-medium">
                      Not Configured (Awaiting .docx Master Upload)
                    </span>
                  )}
                </div>
              </div>

              {/* Right: Upload / Replace Master + Right-side arrow */}
              <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
                <input
                  ref={(el) => {
                    fileInputRefs.current[slot.slotId] = el;
                  }}
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => handleFileChange(slot.slotId, slot.title, e)}
                  className="hidden"
                  aria-label={`Upload .docx master template for ${slot.title}`}
                />

                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => triggerFileSelect(slot.slotId)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer border ${
                    existing
                      ? 'bg-white text-[#0F172A] border-[#CBD5E1] hover:bg-[#F8FAFC] hover:border-[#94A3B8]'
                      : 'bg-[#0F172A] text-white border-[#0F172A] hover:bg-[#1E293B]'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>
                    {isUploading
                      ? 'Saving...'
                      : existing
                      ? 'Replace Master (.docx)'
                      : 'Upload Master (.docx)'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenGenerator(slot.slotId)}
                  title={`Open ${slot.title} Requisition Module`}
                  aria-label={`Open ${slot.title} Requisition Module`}
                  className="p-2 text-[#475569] hover:text-[#0F172A] bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] rounded-md transition-colors cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
