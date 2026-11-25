import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { createCore } from './index';
import { fixedClock, fixedRandom, memoryAdapter } from './helpers';
import type { FileLike } from './types';

function setup() {
  return createCore({
    storage: memoryAdapter(),
    clock: fixedClock('2026-01-01T08:00:00Z'),
    random: fixedRandom(),
  });
}

function fixtureFile(name: string, fixture: string): FileLike {
  const bytes = readFileSync(
    fileURLToPath(new URL(`./__fixtures__/${fixture}`, import.meta.url)),
  );
  return {
    name,
    type: '',
    async arrayBuffer() {
      return bytes.buffer.slice(
        bytes.byteOffset, bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
    },
  };
}

describe('应用核心 · 文件导入（PDF / Word）', () => {
  it('从文字版 PDF 提取文本，并用同一个解析器生成草稿', async () => {
    const core = setup();
    const result = await core.importFromFile(fixtureFile('卷子.pdf', 'sample.pdf'));

    expect(result.fileName).toBe('卷子.pdf');
    expect(result.skipTextarea).toBe(false);
    expect(result.text).toContain('PDF_LITERAL_KEEP');
    // The file path must not have its own parser: pasting the extracted text
    // produces exactly the same draft.
    expect(result.draft).toEqual(await core.importFromText(result.text));
    expect(result.draft.questions[0].stem).toContain('PDF_LITERAL_KEEP');
    expect(result.draft.questions[0].answerText).toBe('A');
  });

  it('从 .docx 提取文本，并用同一个解析器生成草稿', async () => {
    const core = setup();
    const result = await core.importFromFile(fixtureFile('卷子.docx', 'sample.docx'));

    expect(result.skipTextarea).toBe(false);
    expect(result.text).toContain('DOCX_LITERAL_KEEP');
    expect(result.draft).toEqual(await core.importFromText(result.text));
    expect(result.draft.questions[0].stem).toContain('DOCX_LITERAL_KEEP');
    expect(result.draft.questions[0].answerText).toBe('A');
  });

  it('.doc 给出明确提示', async () => {
    await expect(setup().importFromFile(fixtureFile('旧版.doc', 'sample.docx')))
      .rejects.toThrow('请在 Word 里另存为 .docx');
  });

  it('不支持的扩展名给出明确提示', async () => {
    await expect(setup().importFromFile(fixtureFile('图片.png', 'sample.docx')))
      .rejects.toThrow('不支持的文件格式');
  });

  it('提取失败给出明确提示', async () => {
    const broken: FileLike = {
      name: '损坏.pdf',
      type: '',
      async arrayBuffer() { return new Uint8Array([1, 2, 3]).buffer; },
    };
    await expect(setup().importFromFile(broken))
      .rejects.toThrow('提取失败');
  });

  it('提取出 0 字给出明确提示且不生成草稿', async () => {
    await expect(setup().importFromFile(fixtureFile('空白.pdf', 'empty.pdf')))
      .rejects.toThrow('提取出的文字为 0 字');
  });
});
