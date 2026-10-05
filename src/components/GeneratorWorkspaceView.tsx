import React, { useState } from 'react';
import {
  ArrowLeft,
  FolderOpen,
  FileCheck2,
  AlertTriangle,
  ArrowUpRight,
  Download,
  AlertCircle,
  Plus,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import {
  CaseRecord,
  GeneratorSlotMeta,
  MasterTemplateRecord,
  TemplateSlotId,
  saveRecentRequisition,
  formatBytes,
  formatTimestamp,
  formatDateToDDMMYYYY,
} from '../db';
import {
  generateDocxFromMaster,
  downloadBlob,
  PlaceholderReplacement,
} from '../docxEngine';

interface GeneratorWorkspaceViewProps {
  moduleMeta: GeneratorSlotMeta;
  cases: CaseRecord[];
  masterTemplate?: MasterTemplateRecord;
  onBack: () => void;
  onNavigateCaseVault: () => void;
  onNavigateMasterTemplates: () => void;
  onRequisitionGenerated: () => Promise<void>;
}

interface IpEntry {
  id: string;
  ipAddress: string;
  date: string;
  time: string;
}

export const GeneratorWorkspaceView: React.FC<GeneratorWorkspaceViewProps> = ({
  moduleMeta,
  cases,
  masterTemplate,
  onBack,
  onNavigateCaseVault,
  onNavigateMasterTemplates,
  onRequisitionGenerated,
}) => {
  const [selectedCaseId, setSelectedCaseId] = useState<string>(cases[0]?.id || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Today's date in YYYY-MM-DD for date inputs
  const todayIso = new Date().toISOString().split('T')[0];

  // 1. KYC State (only actual master placeholders: Memo No., Date, Bank Name, Account Number, Statement From Date)
  const [kycMemoNo, setKycMemoNo] = useState('');
  const [kycDate, setKycDate] = useState(todayIso);
  const [kycBankName, setKycBankName] = useState('');
  const [kycAccountNumber, setKycAccountNumber] = useState('');
  const [kycStatementFromDate, setKycStatementFromDate] = useState('');

  // 2. CDR / CAF / SDR State
  const [cdrReqType, setCdrReqType] = useState<string>('CDR');
  const [cdrMobileNumber, setCdrMobileNumber] = useState('');
  const [cdrFromDate, setCdrFromDate] = useState('');
  const [cdrToDate, setCdrToDate] = useState('');

  // 3. IMEI State
  const [imeiNumber, setImeiNumber] = useState('');
  const [imeiFromDate, setImeiFromDate] = useState('');
  const [imeiToDate, setImeiToDate] = useState('');

  // 4. IPDR State
  const [ipdrMode, setIpdrMode] = useState<'IPDR' | 'IP_SUBSCRIBER_DETAILS'>('IPDR');
  // IPDR fields:
  const [ipdrTarget, setIpdrTarget] = useState('');
  const [ipdrFromDate, setIpdrFromDate] = useState('');
  const [ipdrFromTime, setIpdrFromTime] = useState('');
  const [ipdrToDate, setIpdrToDate] = useState('');
  const [ipdrToTime, setIpdrToTime] = useState('');
  // IP Subscriber entries:
  const [ipEntries, setIpEntries] = useState<IpEntry[]>([
    { id: '1', ipAddress: '', date: todayIso, time: '' },
  ]);

  // 5. Google Notice State
  const [googleEmailId, setGoogleEmailId] = useState('');
  const [googleDate, setGoogleDate] = useState(todayIso);

  const selectedCase = cases.find((c) => c.id === selectedCaseId);

  const addIpEntry = () => {
    setIpEntries((prev) => [
      ...prev,
      {
        id: String(Date.now() + Math.random()),
        ipAddress: '',
        date: todayIso,
        time: '',
      },
    ]);
  };

  const removeIpEntry = (id: string) => {
    if (ipEntries.length <= 1) return;
    setIpEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  const updateIpEntry = (id: string, field: keyof IpEntry, value: string) => {
    setIpEntries((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, [field]: value } : entry))
    );
  };

  /**
   * Helper to build strict exact placeholder patterns enclosed in {{...}}.
   * NEVER returns naked words like "IO", "CASE", "DATE", "CDR", etc.
   */
  const createPatterns = (key: string): string[] => {
    const cleanKey = key.trim().toUpperCase();
    return [
      `{{${cleanKey}}}`,
      `{{ ${cleanKey} }}`,
    ];
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setSuccessMessage(null);

    // Master template check
    if (!masterTemplate) {
      setValidationError(
        `Master DOCX template for "${moduleMeta.title}" is missing from IndexedDB. Please upload the master template first.`
      );
      return;
    }

    // Selected case check
    if (!selectedCase) {
      setValidationError('Please select an active Case Record from the Case Vault.');
      return;
    }

    if (!selectedCase.caseReference?.trim()) {
      setValidationError('Case Reference is missing in the selected Case Vault record.');
      return;
    }

    if (!selectedCase.ioName?.trim()) {
      setValidationError('IO Name is missing in the selected Case Vault record.');
      return;
    }

    const replacements: PlaceholderReplacement[] = [];
    let outFilename = '';
    let targetSubject = '';

    // ==========================================
    // 1. KYC REQUISITION
    // ==========================================
    if (moduleMeta.slotId === 'kyc_requisition') {
      if (!kycMemoNo.trim()) {
        setValidationError('Memo No. is required for KYC Requisition.');
        return;
      }
      if (!kycDate.trim()) {
        setValidationError('Date is required for KYC Requisition.');
        return;
      }
      if (!kycBankName.trim()) {
        setValidationError('Bank Name is required for KYC Requisition.');
        return;
      }
      if (!kycAccountNumber.trim()) {
        setValidationError('Account Number is required for KYC Requisition.');
        return;
      }
      if (!kycStatementFromDate.trim()) {
        setValidationError('Statement From Date is required for KYC Requisition.');
        return;
      }

      // Case Vault values automatically taken
      replacements.push({
        patterns: [
          ...createPatterns('CASE_REFERENCE'),
          ...createPatterns('CASE_REF'),
          ...createPatterns('CASE_NUMBER'),
          ...createPatterns('CASE_NO'),
        ],
        value: selectedCase.caseReference,
      });
      replacements.push({
        patterns: [
          ...createPatterns('IO_NAME'),
          ...createPatterns('INVESTIGATING_OFFICER'),
          ...createPatterns('IO'),
          ...createPatterns('NAME_OF_IO'),
        ],
        value: selectedCase.ioName,
      });

      // User fields corresponding strictly to master placeholders
      replacements.push({
        patterns: [...createPatterns('MEMO_NO'), ...createPatterns('MEMO_NUMBER')],
        value: kycMemoNo.trim(),
      });
      replacements.push({
        patterns: [...createPatterns('DATE'), ...createPatterns('REQUISITION_DATE')],
        value: formatDateToDDMMYYYY(kycDate),
      });
      replacements.push({
        patterns: [
          ...createPatterns('BANK_NAME'),
          ...createPatterns('BANK'),
          ...createPatterns('NAME_OF_BANK'),
        ],
        value: kycBankName.trim(),
      });
      replacements.push({
        patterns: [
          ...createPatterns('ACCOUNT_NUMBER'),
          ...createPatterns('ACCOUNT_NO'),
          ...createPatterns('ACC_NO'),
        ],
        value: kycAccountNumber.trim(),
      });
      replacements.push({
        patterns: [
          ...createPatterns('STATEMENT_FROM_DATE'),
          ...createPatterns('STMT_FROM_DATE'),
          ...createPatterns('STATEMENT_FROM'),
        ],
        value: formatDateToDDMMYYYY(kycStatementFromDate),
      });

      const sanitizedAcc = kycAccountNumber.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      outFilename = `KYC_${sanitizedAcc}.docx`;
      targetSubject = `A/C: ${kycAccountNumber.trim()} (${kycBankName.trim()})`;
    }

    // ==========================================
    // 2. CDR / CAF / SDR
    // ==========================================
    else if (moduleMeta.slotId === 'cdr_caf_sdr') {
      if (!cdrMobileNumber.trim()) {
        setValidationError('Mobile Number is required.');
        return;
      }
      if (!cdrFromDate.trim()) {
        setValidationError('From Date is required.');
        return;
      }
      if (!cdrToDate.trim()) {
        setValidationError('To Date is required.');
        return;
      }

      // Exact placeholders specified for CDR / CAF / SDR master
      replacements.push({
        patterns: ['{{CASE_REFERENCE}}', '{{CASE_REF}}', '{{CASE_NUMBER}}', '{{CASE_NO}}'],
        value: selectedCase.caseReference,
      });
      replacements.push({
        patterns: ['{{CASE_GIST}}', '{{GIST}}', '{{BRIEF_FACTS}}'],
        value: selectedCase.caseGist || '',
      });
      replacements.push({
        patterns: ['{{IO_NAME}}', '{{INVESTIGATING_OFFICER}}', '{{NAME_OF_IO}}'],
        value: selectedCase.ioName,
      });
      replacements.push({
        patterns: ['{{REQUISITION_TYPE}}', '{{REQ_TYPE}}'],
        value: cdrReqType,
      });
      replacements.push({
        patterns: ['{{MOBILE_NUMBER}}', '{{MOBILE_NO}}', '{{PHONE_NUMBER}}', '{{TARGET_NUMBER}}'],
        value: cdrMobileNumber.trim(),
      });
      replacements.push({
        patterns: ['{{FROM_DATE}}', '{{START_DATE}}', '{{PERIOD_FROM}}'],
        value: formatDateToDDMMYYYY(cdrFromDate),
      });
      replacements.push({
        patterns: ['{{TO_DATE}}', '{{END_DATE}}', '{{PERIOD_TO}}'],
        value: formatDateToDDMMYYYY(cdrToDate),
      });

      const sanitizedMobile = cdrMobileNumber.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      // Replace '+' or spaces with underscores for safe filenames (e.g. "CDR + CAF" -> "CDR_CAF", "CDR + CAF + SDR" -> "CDR_CAF_SDR")
      const safeReqTypePrefix = cdrReqType
        .replace(/\+/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
      outFilename = `${safeReqTypePrefix}_${sanitizedMobile}.docx`;
      targetSubject = `${cdrReqType} — Mobile: ${cdrMobileNumber.trim()}`;
    }

    // ==========================================
    // 3. IMEI SEARCHING
    // ==========================================
    else if (moduleMeta.slotId === 'imei_searching') {
      if (!imeiNumber.trim()) {
        setValidationError('IMEI Number is required.');
        return;
      }
      if (!imeiFromDate.trim()) {
        setValidationError('From Date is required.');
        return;
      }
      if (!imeiToDate.trim()) {
        setValidationError('To Date is required.');
        return;
      }

      // Case Vault values
      replacements.push({
        patterns: [
          ...createPatterns('CASE_REFERENCE'),
          ...createPatterns('CASE_REF'),
          ...createPatterns('CASE_NUMBER'),
          ...createPatterns('CASE_NO'),
        ],
        value: selectedCase.caseReference,
      });
      replacements.push({
        patterns: [
          ...createPatterns('IO_NAME'),
          ...createPatterns('INVESTIGATING_OFFICER'),
          ...createPatterns('IO'),
          ...createPatterns('NAME_OF_IO'),
        ],
        value: selectedCase.ioName,
      });
      replacements.push({
        patterns: [...createPatterns('CASE_TITLE'), ...createPatterns('TITLE')],
        value: selectedCase.caseTitle || '',
      });
      replacements.push({
        patterns: [...createPatterns('CASE_GIST'), ...createPatterns('GIST')],
        value: selectedCase.caseGist || '',
      });

      // User fields
      replacements.push({
        patterns: [
          ...createPatterns('IMEI_NUMBER'),
          ...createPatterns('IMEI_NO'),
          ...createPatterns('IMEI'),
        ],
        value: imeiNumber.trim(),
      });
      replacements.push({
        patterns: [
          ...createPatterns('FROM_DATE'),
          ...createPatterns('START_DATE'),
          ...createPatterns('PERIOD_FROM'),
        ],
        value: formatDateToDDMMYYYY(imeiFromDate),
      });
      replacements.push({
        patterns: [
          ...createPatterns('TO_DATE'),
          ...createPatterns('END_DATE'),
          ...createPatterns('PERIOD_TO'),
        ],
        value: formatDateToDDMMYYYY(imeiToDate),
      });

      const sanitizedImei = imeiNumber.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      outFilename = `IMEI_${sanitizedImei}.docx`;
      targetSubject = `IMEI: ${imeiNumber.trim()}`;
    }

    // ==========================================
    // 4. IPDR / IP SUBSCRIBER DETAILS
    // ==========================================
    else if (moduleMeta.slotId === 'ipdr_subscriber') {
      let dataRequiredContent = '';

      if (ipdrMode === 'IPDR') {
        if (!ipdrTarget.trim()) {
          setValidationError('Target IP / Identifier is required for IPDR.');
          return;
        }
        if (!ipdrFromDate.trim() || !ipdrFromTime.trim()) {
          setValidationError('From Date and From Time are required for IPDR.');
          return;
        }
        if (!ipdrToDate.trim() || !ipdrToTime.trim()) {
          setValidationError('To Date and To Time are required for IPDR.');
          return;
        }

        dataRequiredContent = `Target: ${ipdrTarget.trim()}, Period From: ${formatDateToDDMMYYYY(
          ipdrFromDate
        )} ${ipdrFromTime.trim()} To: ${formatDateToDDMMYYYY(ipdrToDate)} ${ipdrToTime.trim()}`;

        const sanitizedTarget = ipdrTarget.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        outFilename = `IPDR_${sanitizedTarget}.docx`;
        targetSubject = `IPDR — Target: ${ipdrTarget.trim()}`;
      } else {
        // IP SUBSCRIBER DETAILS
        const validEntries = ipEntries.filter(
          (e) => e.ipAddress.trim() || e.date.trim() || e.time.trim()
        );
        if (validEntries.length === 0) {
          setValidationError('At least one IP Subscriber entry (IP, Date, Time) is required.');
          return;
        }
        for (let i = 0; i < validEntries.length; i++) {
          const item = validEntries[i];
          if (!item.ipAddress.trim()) {
            setValidationError(`IP Address is missing in entry #${i + 1}.`);
            return;
          }
          if (!item.date.trim()) {
            setValidationError(`Date is missing in entry #${i + 1}.`);
            return;
          }
          if (!item.time.trim()) {
            setValidationError(`Time is missing in entry #${i + 1}.`);
            return;
          }
        }

        dataRequiredContent = validEntries
          .map(
            (item, idx) =>
              `(${idx + 1}) IP: ${item.ipAddress.trim()} | Date: ${formatDateToDDMMYYYY(
                item.date
              )} | Time: ${item.time.trim()}`
          )
          .join('\n');

        outFilename = `IP_SUBSCRIBER_DETAILS.docx`;
        targetSubject = `IP Subscriber Details (${validEntries.length} entries)`;
      }

      // Case Vault values
      replacements.push({
        patterns: [
          ...createPatterns('CASE_REFERENCE'),
          ...createPatterns('CASE_REF'),
          ...createPatterns('CASE_NUMBER'),
          ...createPatterns('CASE_NO'),
        ],
        value: selectedCase.caseReference,
      });
      replacements.push({
        patterns: [
          ...createPatterns('IO_NAME'),
          ...createPatterns('INVESTIGATING_OFFICER'),
          ...createPatterns('IO'),
          ...createPatterns('NAME_OF_IO'),
        ],
        value: selectedCase.ioName,
      });
      replacements.push({
        patterns: [...createPatterns('CASE_TITLE'), ...createPatterns('TITLE')],
        value: selectedCase.caseTitle || '',
      });
      replacements.push({
        patterns: [...createPatterns('CASE_GIST'), ...createPatterns('GIST')],
        value: selectedCase.caseGist || '',
      });

      // DATA_REQUIRED placeholder
      replacements.push({
        patterns: [
          ...createPatterns('DATA_REQUIRED'),
          ...createPatterns('DATA REQUIRED'),
          ...createPatterns('REQUIREMENT'),
          ...createPatterns('REQUIRED_DATA'),
        ],
        value: dataRequiredContent,
      });
    }

    // ==========================================
    // 5. GOOGLE NOTICE
    // ==========================================
    else if (moduleMeta.slotId === 'google_notice') {
      if (!googleEmailId.trim()) {
        setValidationError('Email / Gmail ID is required.');
        return;
      }
      if (!googleDate.trim()) {
        setValidationError('Date is required.');
        return;
      }

      // Case Vault values
      replacements.push({
        patterns: [
          ...createPatterns('CASE_REFERENCE'),
          ...createPatterns('CASE_REF'),
          ...createPatterns('CASE_NUMBER'),
          ...createPatterns('CASE_NO'),
        ],
        value: selectedCase.caseReference,
      });
      replacements.push({
        patterns: [
          ...createPatterns('CASE_GIST'),
          ...createPatterns('GIST'),
          ...createPatterns('BRIEF_FACTS'),
        ],
        value: selectedCase.caseGist || '',
      });
      replacements.push({
        patterns: [
          ...createPatterns('IO_NAME'),
          ...createPatterns('INVESTIGATING_OFFICER'),
          ...createPatterns('IO'),
          ...createPatterns('NAME_OF_IO'),
        ],
        value: selectedCase.ioName,
      });
      replacements.push({
        patterns: [...createPatterns('CASE_TITLE'), ...createPatterns('TITLE')],
        value: selectedCase.caseTitle || '',
      });

      // User fields
      replacements.push({
        patterns: [
          ...createPatterns('EMAIL_ID'),
          ...createPatterns('EMAIL'),
          ...createPatterns('GMAIL_ID'),
          ...createPatterns('GMAIL'),
          ...createPatterns('TARGET_EMAIL'),
          ...createPatterns('ACCOUNT_ID'),
        ],
        value: googleEmailId.trim(),
      });
      replacements.push({
        patterns: [...createPatterns('DATE'), ...createPatterns('NOTICE_DATE')],
        value: formatDateToDDMMYYYY(googleDate),
      });

      const sanitizedEmail = googleEmailId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      outFilename = `GOOGLE_NOTICE_${sanitizedEmail}.docx`;
      targetSubject = `Google Notice — ${googleEmailId.trim()}`;
    }

    setIsGenerating(true);
    try {
      // 1. Fresh copy from IndexedDB master DOCX blob
      const freshMasterBlob = masterTemplate.fileBlob;

      // 2. In-place placeholder replacement preserving all formatting and Word package structures
      const outputDocxBlob = await generateDocxFromMaster(freshMasterBlob, replacements);

      // 3. Download generated .docx immediately
      downloadBlob(outputDocxBlob, outFilename);

      // 4. Save to Recent Requisitions in local IndexedDB
      await saveRecentRequisition({
        id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        moduleTitle: moduleMeta.title,
        slotId: moduleMeta.slotId,
        filename: outFilename,
        caseReference: selectedCase.caseReference,
        targetSubject,
        generatedAt: Date.now(),
        fileBlob: outputDocxBlob,
      });

      await onRequisitionGenerated();

      setSuccessMessage(
        `Generated and downloaded "${outFilename}". Requisition added to Recent Requisitions.`
      );
    } catch {
      setValidationError(
        'An error occurred during DOCX processing. Ensure the uploaded template is a valid Microsoft Word .docx file.'
      );
    } finally {
      setIsGenerating(false);
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
          <div className="flex items-baseline gap-2.5">
            <span className="text-sm font-mono font-bold text-[#1E3A8A]">
              {moduleMeta.indexNumber}
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
              {moduleMeta.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-center">
          <button
            type="button"
            onClick={onNavigateCaseVault}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] rounded-md hover:bg-[#F8FAFC] transition-colors cursor-pointer"
          >
            <span>Open Case Vault</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#64748B]" />
          </button>
          <button
            type="button"
            onClick={onNavigateMasterTemplates}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] rounded-md hover:bg-[#F8FAFC] transition-colors cursor-pointer"
          >
            <span>Master Templates</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#64748B]" />
          </button>
        </div>
      </div>

      {/* Validation or Success Alerts */}
      {validationError && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-md px-4 py-3 flex items-center justify-between text-xs sm:text-sm text-[#B91C1C]">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-medium">{validationError}</span>
          </div>
          <button
            type="button"
            onClick={() => setValidationError(null)}
            className="text-[#B91C1C] hover:opacity-75 p-1"
          >
            ✕
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
          >
            ✕
          </button>
        </div>
      )}

      {/* Readiness Grid: Linked Master Template & Case Vault Selection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Master Template Readiness Card */}
        <section className="bg-white border border-[#E2E8F0] rounded-lg p-5 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">
                Assigned Master Template (.docx)
              </h2>
              <span className="text-xs font-mono text-[#64748B]">
                Slot {moduleMeta.indexNumber}
              </span>
            </div>

            {masterTemplate ? (
              <div className="pt-2 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#15803D]">
                  <FileCheck2 className="w-4 h-4 shrink-0" />
                  <span>Master Template Configured</span>
                </div>
                <div className="text-xs text-[#334155] font-mono break-all">
                  File: {masterTemplate.fileName} ({formatBytes(masterTemplate.fileSize)})
                </div>
                <div className="text-xs text-[#64748B] font-mono tabular-nums">
                  Uploaded: {formatTimestamp(masterTemplate.uploadedAt)}
                </div>
              </div>
            ) : (
              <div className="pt-2 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#B45309]">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>No Master Template Uploaded</span>
                </div>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  Upload a valid <code className="font-mono">.docx</code> master template for{' '}
                  <strong className="text-[#0F172A]">{moduleMeta.title}</strong> in the Master
                  Templates workspace before generating documents.
                </p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between">
            <span className="text-xs text-[#64748B]">SAINTHIA PS</span>
            <button
              type="button"
              onClick={onNavigateMasterTemplates}
              className="text-xs font-semibold text-[#1E3A8A] hover:underline cursor-pointer"
            >
              {masterTemplate ? 'Replace Master Template →' : 'Upload Master Template →'}
            </button>
          </div>
        </section>

        {/* Case Vault Context Selector Card */}
        <section className="bg-white border border-[#E2E8F0] rounded-lg p-5 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">
                Case Vault Selection
              </h2>
              <span className="text-xs font-mono tabular-nums text-[#64748B]">
                {cases.length} Saved {cases.length === 1 ? 'Case' : 'Cases'}
              </span>
            </div>

            {cases.length === 0 ? (
              <div className="pt-1 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#475569]">
                  <FolderOpen className="w-4 h-4 shrink-0" />
                  <span>No Cases Saved in Case Vault</span>
                </div>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  Add a case in the Case Vault to pre-fill Case Reference, Case Gist, and IO Name in this requisition module.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="generatorCaseSelect"
                    className="block text-xs font-semibold text-[#475569] mb-1"
                  >
                    Select Active Case Record <span className="text-[#B91C1C]">*</span>
                  </label>
                  <select
                    id="generatorCaseSelect"
                    value={selectedCaseId}
                    onChange={(e) => setSelectedCaseId(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-[#F8FAFC] border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-none focus:bg-white focus:border-[#1E3A8A]"
                  >
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.caseReference} — {c.caseTitle} (IO: {c.ioName})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCase && (
                  <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md text-xs space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-[#0F172A]">{selectedCase.caseTitle}</span>
                      <span className="font-mono font-semibold text-[#1E3A8A]">
                        {selectedCase.caseReference}
                      </span>
                    </div>
                    <div className="text-[#475569]">
                      <span className="font-semibold text-[#0F172A]">IO Name:</span> {selectedCase.ioName}
                    </div>
                    {selectedCase.caseGist && (
                      <div className="text-[#64748B] line-clamp-2 pt-0.5">
                        <span className="font-semibold text-[#0F172A]">Case Gist:</span> {selectedCase.caseGist}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between">
            <span className="text-xs text-[#64748B]">Source: SAINTHIA PS Case Vault</span>
            <button
              type="button"
              onClick={onNavigateCaseVault}
              className="text-xs font-semibold text-[#1E3A8A] hover:underline cursor-pointer"
            >
              Manage Case Vault →
            </button>
          </div>
        </section>
      </div>

      {/* Requisition Generator Form */}
      <section className="bg-white border border-[#E2E8F0] rounded-lg p-6 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#E2E8F0]">
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">
              {moduleMeta.title}
            </h2>
          </div>
          <span className="text-xs font-mono text-[#15803D] font-semibold">
            Ready
          </span>
        </div>

        <form onSubmit={handleGenerate} className="space-y-5">
          {/* ========================================================
              MODULE 1: KYC REQUISITION FORM FIELDS
          ======================================================== */}
          {moduleMeta.slotId === 'kyc_requisition' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-1.5">
                  Memo No. <span className="text-[#B91C1C]">*</span>
                </label>
                <input
                  type="text"
                  value={kycMemoNo}
                  onChange={(e) => setKycMemoNo(e.target.value)}
                  placeholder="e.g. 1042/SP/CYBER"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#1E3A8A]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-1.5">
                  Date <span className="text-[#B91C1C]">*</span>
                </label>
                <input
                  type="date"
                  value={kycDate}
                  onChange={(e) => setKycDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-none focus:border-[#1E3A8A]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-1.5">
                  Bank Name <span className="text-[#B91C1C]">*</span>
                </label>
                <input
                  type="text"
                  value={kycBankName}
                  onChange={(e) => setKycBankName(e.target.value)}
                  placeholder="e.g. State Bank of India, Sainthia Branch"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#1E3A8A]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-1.5">
                  Account Number <span className="text-[#B91C1C]">*</span>
                </label>
                <input
                  type="text"
                  value={kycAccountNumber}
                  onChange={(e) => setKycAccountNumber(e.target.value)}
                  placeholder="e.g. 39281726481"
                  className="w-full px-3.5 py-2 text-sm font-mono bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#1E3A8A]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-1.5">
                  Statement From Date <span className="text-[#B91C1C]">*</span>
                </label>
                <input
                  type="date"
                  value={kycStatementFromDate}
                  onChange={(e) => setKycStatementFromDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-none focus:border-[#1E3A8A]"
                  required
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-xs font-semibold text-[#475569] uppercase tracking-wider mb-1.5">
                  Automatic Case Vault Bindings
                </label>
                <div className="px-3.5 py-2 text-xs bg-[#F1F5F9] border border-[#CBD5E1] rounded-md text-[#475569] flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    <strong className="text-[#0F172A]">Ref:</strong>{' '}
                    {selectedCase?.caseReference || '—'}
                  </span>
                  <span>
                    <strong className="text-[#0F172A]">IO Name:</strong>{' '}
                    {selectedCase?.ioName || '—'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              MODULE 2: CDR / CAF / SDR FORM FIELDS
          ======================================================== */}
          {moduleMeta.slotId === 'cdr_caf_sdr' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-1.5">
                  Requisition Type <span className="text-[#B91C1C]">*</span>
                </label>
                <select
                  value={cdrReqType}
                  onChange={(e) => setCdrReqType(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-semibold bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-none focus:border-[#1E3A8A]"
                >
                  <option value="CDR">CDR</option>
                  <option value="CAF">CAF</option>
                  <option value="SDR">SDR</option>
                  <option value="CDR + CAF">CDR + CAF</option>
                  <option value="CDR + SDR">CDR + SDR</option>
                  <option value="CAF + SDR">CAF + SDR</option>
                  <option value="CDR + CAF + SDR">CDR + CAF + SDR</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-1.5">
                  Mobile Number <span className="text-[#B91C1C]">*</span>
                </label>
                <input
                  type="tel"
                  value={cdrMobileNumber}
                  onChange={(e) => setCdrMobileNumber(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3.5 py-2 text-sm font-mono bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#1E3A8A]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-1.5">
                  From Date <span className="text-[#B91C1C]">*</span>
                </label>
                <input
                  type="date"
                  value={cdrFromDate}
                  onChange={(e) => setCdrFromDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-none focus:border-[#1E3A8A]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-1.5">
                  To Date <span className="text-[#B91C1C]">*</span>
                </label>
                <input
                  type="date"
                  value={cdrToDate}
                  onChange={(e) => setCdrToDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-none focus:border-[#1E3A8A]"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#475569] uppercase tracking-wider mb-1.5">
                  Automatic Case Vault Bindings
                </label>
                <div className="px-3.5 py-2 text-xs bg-[#F1F5F9] border border-[#CBD5E1] rounded-md text-[#475569] flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    <strong className="text-[#0F172A]">Ref:</strong>{' '}
                    {selectedCase?.caseReference || '—'}
                  </span>
                  <span>
                    <strong className="text-[#0F172A]">IO:</strong>{' '}
                    {selectedCase?.ioName || '—'}
                  </span>
                  <span>
                    <strong className="text-[#0F172A]">Gist:</strong>{' '}
                    {selectedCase?.caseGist ? 'Auto-bound' : 'None'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              MODULE 3: IMEI SEARCHING FORM FIELDS
          ======================================================== */}
          {moduleMeta.slotId === 'imei_searching' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-1.5">
                  IMEI Number <span className="text-[#B91C1C]">*</span>
                </label>
                <input
                  type="text"
                  value={imeiNumber}
                  onChange={(e) => setImeiNumber(e.target.value)}
                  placeholder="e.g. 864521045612345"
                  className="w-full px-3.5 py-2 text-sm font-mono bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#1E3A8A]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-1.5">
                  From Date <span className="text-[#B91C1C]">*</span>
                </label>
                <input
                  type="date"
                  value={imeiFromDate}
                  onChange={(e) => setImeiFromDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-none focus:border-[#1E3A8A]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-1.5">
                  To Date <span className="text-[#B91C1C]">*</span>
                </label>
                <input
                  type="date"
                  value={imeiToDate}
                  onChange={(e) => setImeiToDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-none focus:border-[#1E3A8A]"
                  required
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-semibold text-[#475569] uppercase tracking-wider mb-1.5">
                  Automatic Case Vault Bindings
                </label>
                <div className="px-3.5 py-2 text-xs bg-[#F1F5F9] border border-[#CBD5E1] rounded-md text-[#475569] flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    <strong className="text-[#0F172A]">Ref:</strong>{' '}
                    {selectedCase?.caseReference || '—'}
                  </span>
                  <span>
                    <strong className="text-[#0F172A]">IO Name:</strong>{' '}
                    {selectedCase?.ioName || '—'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              MODULE 4: IPDR / IP SUBSCRIBER DETAILS FORM FIELDS
          ======================================================== */}
          {moduleMeta.slotId === 'ipdr_subscriber' && (
            <div className="space-y-4">
              {/* Mode Toggle */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-2">
                  Select Requisition Mode
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIpdrMode('IPDR')}
                    className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-md border transition-colors cursor-pointer ${
                      ipdrMode === 'IPDR'
                        ? 'bg-[#0F172A] text-white border-[#0F172A]'
                        : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    IPDR Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => setIpdrMode('IP_SUBSCRIBER_DETAILS')}
                    className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-md border transition-colors cursor-pointer ${
                      ipdrMode === 'IP_SUBSCRIBER_DETAILS'
                        ? 'bg-[#0F172A] text-white border-[#0F172A]'
                        : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    IP Subscriber Details Mode
                  </button>
                </div>
              </div>

              {ipdrMode === 'IPDR' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md">
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-1.5">
                      Target IP / Identifier <span className="text-[#B91C1C]">*</span>
                    </label>
                    <input
                      type="text"
                      value={ipdrTarget}
                      onChange={(e) => setIpdrTarget(e.target.value)}
                      placeholder="e.g. 103.21.244.0 or Target Identifier"
                      className="w-full px-3.5 py-2 text-sm font-mono bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#1E3A8A]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-1.5">
                      From Date <span className="text-[#B91C1C]">*</span>
                    </label>
                    <input
                      type="date"
                      value={ipdrFromDate}
                      onChange={(e) => setIpdrFromDate(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-none focus:border-[#1E3A8A]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-1.5">
                      From Time <span className="text-[#B91C1C]">*</span>
                    </label>
                    <input
                      type="time"
                      value={ipdrFromTime}
                      onChange={(e) => setIpdrFromTime(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-none focus:border-[#1E3A8A]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-1.5">
                      To Date <span className="text-[#B91C1C]">*</span>
                    </label>
                    <input
                      type="date"
                      value={ipdrToDate}
                      onChange={(e) => setIpdrToDate(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-none focus:border-[#1E3A8A]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-1.5">
                      To Time <span className="text-[#B91C1C]">*</span>
                    </label>
                    <input
                      type="time"
                      value={ipdrToTime}
                      onChange={(e) => setIpdrToTime(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-none focus:border-[#1E3A8A]"
                      required
                    />
                  </div>
                </div>
              ) : (
                /* IP SUBSCRIBER DETAILS: Multiple Entries */
                <div className="space-y-3 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#0F172A]">
                      IP Subscriber Entries ({ipEntries.length})
                    </span>
                    <button
                      type="button"
                      onClick={addIpEntry}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] rounded-md hover:bg-[#F1F5F9] transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Entry</span>
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {ipEntries.map((entry, index) => (
                      <div
                        key={entry.id}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end p-3 bg-white border border-[#CBD5E1] rounded-md"
                      >
                        <div className="sm:col-span-1 text-xs font-mono font-bold text-[#64748B] pb-2 sm:pb-0">
                          #{index + 1}
                        </div>

                        <div className="sm:col-span-5">
                          <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                            IP Address <span className="text-[#B91C1C]">*</span>
                          </label>
                          <input
                            type="text"
                            value={entry.ipAddress}
                            onChange={(e) => updateIpEntry(entry.id, 'ipAddress', e.target.value)}
                            placeholder="e.g. 103.22.45.18"
                            className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-[#CBD5E1] rounded text-[#0F172A] focus:outline-none focus:border-[#1E3A8A]"
                            required
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                            Date <span className="text-[#B91C1C]">*</span>
                          </label>
                          <input
                            type="date"
                            value={entry.date}
                            onChange={(e) => updateIpEntry(entry.id, 'date', e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-white border border-[#CBD5E1] rounded text-[#0F172A] focus:outline-none focus:border-[#1E3A8A]"
                            required
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                            Time <span className="text-[#B91C1C]">*</span>
                          </label>
                          <input
                            type="time"
                            value={entry.time}
                            onChange={(e) => updateIpEntry(entry.id, 'time', e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-white border border-[#CBD5E1] rounded text-[#0F172A] focus:outline-none focus:border-[#1E3A8A]"
                            required
                          />
                        </div>

                        <div className="sm:col-span-1 flex justify-end">
                          <button
                            type="button"
                            disabled={ipEntries.length <= 1}
                            onClick={() => removeIpEntry(entry.id)}
                            className="p-1.5 text-[#B91C1C] hover:bg-[#FEF2F2] rounded disabled:opacity-30 transition-colors cursor-pointer"
                            aria-label={`Remove entry ${index + 1}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 bg-[#F1F5F9] border border-[#CBD5E1] rounded-md text-xs text-[#475569] flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  <strong className="text-[#0F172A]">Ref:</strong>{' '}
                  {selectedCase?.caseReference || '—'}
                </span>
                <span>
                  <strong className="text-[#0F172A]">IO Name:</strong>{' '}
                  {selectedCase?.ioName || '—'}
                </span>
                <span>
                  <strong className="text-[#0F172A]">Destination Placeholder:</strong>{' '}
                  <code className="font-mono text-[#1E3A8A]">DATA_REQUIRED</code>
                </span>
              </div>
            </div>
          )}

          {/* ========================================================
              MODULE 5: GOOGLE NOTICE FORM FIELDS
          ======================================================== */}
          {moduleMeta.slotId === 'google_notice' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="sm:col-span-2 lg:col-span-2">
                <label className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-1.5">
                  Email / Gmail ID <span className="text-[#B91C1C]">*</span>
                </label>
                <input
                  type="email"
                  value={googleEmailId}
                  onChange={(e) => setGoogleEmailId(e.target.value)}
                  placeholder="e.g. target.user@gmail.com"
                  className="w-full px-3.5 py-2 text-sm font-mono bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#1E3A8A]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-1.5">
                  Date <span className="text-[#B91C1C]">*</span>
                </label>
                <input
                  type="date"
                  value={googleDate}
                  onChange={(e) => setGoogleDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-none focus:border-[#1E3A8A]"
                  required
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-semibold text-[#475569] uppercase tracking-wider mb-1.5">
                  Automatic Case Vault Bindings
                </label>
                <div className="px-3.5 py-2 text-xs bg-[#F1F5F9] border border-[#CBD5E1] rounded-md text-[#475569] flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    <strong className="text-[#0F172A]">Ref:</strong>{' '}
                    {selectedCase?.caseReference || '—'}
                  </span>
                  <span>
                    <strong className="text-[#0F172A]">IO Name:</strong>{' '}
                    {selectedCase?.ioName || '—'}
                  </span>
                  <span>
                    <strong className="text-[#0F172A]">Case Gist:</strong>{' '}
                    {selectedCase?.caseGist ? 'Auto-bound' : 'None'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="pt-4 border-t border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-[#64748B]">
              SAINTHIA PS
            </div>

            <button
              type="submit"
              disabled={isGenerating || !masterTemplate || !selectedCase}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs sm:text-sm font-semibold text-white bg-[#0F172A] hover:bg-[#1E293B] disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>{isGenerating ? 'Generating DOCX...' : 'Generate & Download DOCX'}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
