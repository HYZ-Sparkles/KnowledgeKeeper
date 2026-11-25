import mammoth from 'mammoth/mammoth.browser.js';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { FileLike } from '../types';

/** Private binary text extraction adapter; nothing outside the core calls it. */
export interface FileExtraction {
  text: string;
  /** Spreadsheets are parsed as rows, not pushed through the textarea. */
  spreadsheet: boolean;
}

function reason(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/** pdf.js' legacy build runs in Node/Vitest without a browser-only worker. */
async function extractPdf(file: FileLike): Promise<string> {
  let task: ReturnType<typeof getDocument> | undefined;
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    task = getDocument({
      data,
      useWorkerFetch: false,
    });
    const pdf = await task.promise;
    const pages: string[] = [];
    for (let number = 1; number <= pdf.numPages; number += 1) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) =>
        'str' in item ? item.str + (item.hasEOL ? '\n' : '') : '').join(''));
    }
    return pages.join('\n').trim();
  } catch (cause) {
    throw new Error(`提取失败：文字版 PDF 无法读取（${reason(cause)}）。`
      + '请改用「或直接粘贴文本」。');
  } finally {
    if (task) await task.destroy();
  }
}

/** mammoth's browser bundle uses ArrayBuffer, matching the browser File API. */
async function extractDocx(file: FileLike): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
  } catch (cause) {
    throw new Error(`提取失败：.docx 无法读取（${reason(cause)}）。`
      + '请改用「或直接粘贴文本」。');
  }
}

/**
 * Dispatch by extension. Text formats yield plain text for the shared parser;
 * `.doc` and unknown formats are rejected with an explicit, actionable message.
 */
export async function extractFile(file: FileLike): Promise<FileExtraction> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.doc')) {
    throw new Error('请在 Word 里另存为 .docx。旧版 .doc 无法直接提取文字。');
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return { text: '', spreadsheet: true };
  }
  let text = '';
  if (name.endsWith('.pdf')) text = await extractPdf(file);
  else if (name.endsWith('.docx')) text = await extractDocx(file);
  else {
    throw new Error(`不支持的文件格式「${file.name}」，请选择 .pdf、.docx、.xlsx 或 .xls。`);
  }

  if (!text.trim()) {
    throw new Error('提取出的文字为 0 字，这可能是扫描件或图片。'
      + '请改用「或直接粘贴文本」。');
  }
  return { text, spreadsheet: false };
}
