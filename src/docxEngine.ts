import JSZip from 'jszip';

/**
 * Escapes characters for XML string replacement.
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface PlaceholderReplacement {
  /**
   * Search keys to look for. E.g. ['{{CASE_REFERENCE}}']
   * STRICT REQUIREMENT: Only exact placeholders enclosed in {{...}} are replaced.
   */
  patterns: string[];
  value: string;
}

/**
 * Normalizes paragraph XML so that if a placeholder like {{IO_NAME}} or {{REQUISITION_TYPE}}
 * is split across multiple adjacent <w:t> runs due to Word formatting/spelling checks,
 * it is accurately detected and replaced without affecting any surrounding text,
 * words like "REQUISITION", "investigation", "Recommendation", or any formatting/layout.
 */
function replaceInXmlString(xmlContent: string, replacements: PlaceholderReplacement[]): string {
  // Process paragraph by paragraph to maintain paragraph run isolation and layout properties
  const paragraphRegex = /(<w:p\b[^>]*>)([\s\S]*?)(<\/w:p>)/g;

  return xmlContent.replace(paragraphRegex, (fullParagraph, openTag, innerContent, closeTag) => {
    let modifiedInner = innerContent;

    // Filter to only valid replacements
    const validReplacements = replacements.filter((r) => r.patterns && r.patterns.length > 0);

    // Loop through replacements
    for (const rep of validReplacements) {
      const safeVal = rep.value !== undefined && rep.value !== null ? escapeXml(rep.value) : '';

      for (const rawPattern of rep.patterns) {
        if (!rawPattern) continue;
        // Enforce exact placeholder matching (must be enclosed in {{...}})
        const pattern = rawPattern.trim();

        // 1. Direct replacement if the full placeholder sits within a single <w:t>...</w:t>
        const directRegex = new RegExp(`(<w:t\\b[^>]*>)([\\s\\S]*?)(<\\/w:t>)`, 'g');
        modifiedInner = modifiedInner.replace(directRegex, (match: string, tOpen: string, text: string, tClose: string) => {
          if (text.includes(pattern)) {
            // Replace exact pattern occurrence only
            return `${tOpen}${text.split(pattern).join(safeVal)}${tClose}`;
          }
          return match;
        });

        // 2. Multi-run split handling:
        // Word frequently splits {{ and placeholder names across multiple runs, e.g.
        // <w:t>{</w:t><w:t>{IO_</w:t><w:t>NAME}}</w:t>
        // Check if pattern is present across the runs of this paragraph
        const textRunMatches: {
          start: number;
          end: number;
          text: string;
          fullMatch: string;
          prefix: string;
          suffix: string;
        }[] = [];

        const tTagRegex = /<w:t\b([^>]*)>([\s\S]*?)<\/w:t>/g;
        let pText = '';
        let m: RegExpExecArray | null;

        while ((m = tTagRegex.exec(modifiedInner)) !== null) {
          const runText = m[2];
          textRunMatches.push({
            start: pText.length,
            end: pText.length + runText.length,
            text: runText,
            fullMatch: m[0],
            prefix: `<w:t${m[1]}>`,
            suffix: '</w:t>',
          });
          pText += runText;
        }

        // Search for the exact placeholder in the concatenated text
        let searchIndex = pText.indexOf(pattern);
        while (searchIndex !== -1 && textRunMatches.length > 0) {
          const patternLength = pattern.length;
          const patternEnd = searchIndex + patternLength;

          let remainingValueToInsert = safeVal;

          for (let i = 0; i < textRunMatches.length; i++) {
            const run = textRunMatches[i];
            const overlapStart = Math.max(run.start, searchIndex);
            const overlapEnd = Math.min(run.end, patternEnd);

            if (overlapStart < overlapEnd) {
              const runOffsetStart = overlapStart - run.start;
              const runOffsetEnd = overlapEnd - run.start;

              const before = run.text.substring(0, runOffsetStart);
              const after = run.text.substring(runOffsetEnd);

              const insertText = remainingValueToInsert;
              remainingValueToInsert = ''; // inserted into the first overlapping run

              const newText = `${before}${insertText}${after}`;
              const newRunContent = `${run.prefix}${newText}${run.suffix}`;
              modifiedInner = modifiedInner.replace(run.fullMatch, newRunContent);
              run.text = newText;
              run.fullMatch = newRunContent;
            }
          }

          // Check if there are other instances of this placeholder in the paragraph
          pText = pText.substring(0, searchIndex) + safeVal + pText.substring(patternEnd);
          searchIndex = pText.indexOf(pattern);
        }
      }
    }

    return `${openTag}${modifiedInner}${closeTag}`;
  });
}

/**
 * Reads a fresh master docx blob, replaces ONLY exact placeholders in document.xml
 * and any headers/footers, and packages the exact same docx without altering any formatting,
 * margins, fonts, tables, alignment, or layout.
 */
export async function generateDocxFromMaster(
  masterDocxBlob: Blob,
  replacements: PlaceholderReplacement[]
): Promise<Blob> {
  const arrayBuffer = await masterDocxBlob.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  // XML files where text content can reside
  const xmlFilesToProcess: string[] = [];

  zip.forEach((relativePath) => {
    if (
      relativePath === 'word/document.xml' ||
      relativePath.startsWith('word/header') ||
      relativePath.startsWith('word/footer')
    ) {
      xmlFilesToProcess.push(relativePath);
    }
  });

  for (const filePath of xmlFilesToProcess) {
    const file = zip.file(filePath);
    if (file) {
      const xmlContent = await file.async('string');
      const updatedXml = replaceInXmlString(xmlContent, replacements);
      zip.file(filePath, updatedXml);
    }
  }

  // Generate output docx with original package compression
  const generatedBlob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
    compressionOptions: {
      level: 6,
    },
  });

  return generatedBlob;
}

/**
 * Utility to trigger immediate browser download of the generated docx file.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/**
 * Utility to open the generated DOCX in the device's available document viewer
 * using standard web APIs (Web Share API for files or object URL navigation).
 */
export async function openDocxBlob(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  // 1. Try Web Share API (native sheet on Android, iOS, Windows, macOS that opens in Office / Docs viewer)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: filename,
      });
      return true;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return true;
      }
    }
  }

  // 2. Open via Blob URL in new window/tab for browsers that support direct document preview/association
  try {
    const fileUrl = URL.createObjectURL(file);
    const opened = window.open(fileUrl, '_blank', 'noopener,noreferrer');
    if (opened) {
      window.setTimeout(() => URL.revokeObjectURL(fileUrl), 120000);
      return true;
    }
  } catch {
    // Fall through to anchor click
  }

  // 3. Fallback: prompt open/download trigger
  downloadBlob(blob, filename);
  return true;
}
