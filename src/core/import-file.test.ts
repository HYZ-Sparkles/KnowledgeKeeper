import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
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

/** Build a fixed-column workbook in memory, like the runtime template does. */
function workbookFile(name: string, rows: string[][]): FileLike {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, '题目');
  const bytes = XLSX.write(book, { bookType: 'xlsx', type: 'array' });
  return {
    name,
    type: '',
    async arrayBuffer() { return bytes as ArrayBuffer; },
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

describe('应用核心 · Excel 导入', () => {
  it('固定列工作簿直接生成草稿，跳过文本框且与文本导入警示一致', async () => {
    const core = setup();
    const result = await core.importFromFile(workbookFile('模板.xlsx', [
      ['题型', '题干', 'A', 'B', 'C', 'D', 'E', 'F', '答案', '解析'],
      [
        '单选题', 'Excel_LITERAL_KEEP question', 'yes', 'no',
        '', '', '', '', 'A', 'because',
      ],
      [
        '多选题', 'Excel_MULTIPLE question', '甲', '乙',
        '丙', '', '', '', 'AC', '',
      ],
    ]));

    expect(result.skipTextarea).toBe(true);
    expect(result.text).toBe('');
    expect(result.draft.warnings).toEqual([]);
    expect(result.draft.questions).toMatchObject([
      {
        type: 'single',
        stem: 'Excel_LITERAL_KEEP question',
        options: [{ letter: 'A', text: 'yes' }, { letter: 'B', text: 'no' }],
        answerText: 'A',
        explanation: 'because',
        missingAnswer: false,
      },
      {
        type: 'multiple',
        stem: 'Excel_MULTIPLE question',
        answerText: 'AC',
        explanation: '',
        missingAnswer: false,
      },
    ]);
  });

  it('只有表头的表格给出 0 题错误，不返回空草稿', async () => {
    const core = setup();
    const empty = workbookFile('空表.xlsx', [
      ['题型', '题干', 'A', 'B', 'C', 'D', 'E', 'F', '答案', '解析'],
    ]);

    await expect(core.importFromFile(empty)).rejects.toThrow('没有识别到题目');
  });

  it('空题型走推断、答案大写且判断符号规范成 √，空行跳过', async () => {
    const core = setup();
    const result = await core.importFromFile(
      fixtureFile('推断.xlsx', 'inferred.xlsx'),
    );

    expect(result.draft.questions.map((q) => q.type)).toEqual([
      'single', 'truefalse', 'single',
    ]);
    expect(result.draft.questions.map((q) => q.answerText)).toEqual([
      'B', '√', '',
    ]);
    expect(result.draft.warnings).toEqual([{
      code: 'ANSWER_COUNT_MISMATCH',
      severity: 'warn',
      questionNumbers: [3],
      message: '识别到 3 道题，答案 2 个。第 3 题缺答案，标红了。',
    }]);
  });

  it('题型列写匹配题时报错并指出行号', async () => {
    await expect(setup().importFromFile(
      fixtureFile('匹配.xlsx', 'matching.xlsx'),
    )).rejects.toThrow(/第 2 行.*匹配题/);
  });

  it('.xls 样本同样能解析', async () => {
    const core = setup();
    const result = await core.importFromFile(
      fixtureFile('旧版.xls', 'sample.xls'),
    );

    expect(result.skipTextarea).toBe(true);
    expect(result.draft.questions[0].stem).toContain('Excel_XLS_LITERAL');
    expect(result.draft.questions[0].answerText).toBe('A');
    expect(result.draft.warnings).toEqual([]);
  });

  it('运行时生成的模板可被同一个 seam 正常导入', async () => {
    const core = setup();
    const blob = core.excelTemplate();
    const buffer = await blob.arrayBuffer();
    const result = await core.importFromFile({
      name: 'KnowledgeKeeper-导入模板.xlsx',
      type: blob.type,
      async arrayBuffer() { return buffer; },
    });

    expect(result.draft.questions.length).toBeGreaterThan(0);
    expect(result.draft.warnings).toEqual([]);
  });
});
