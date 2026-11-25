import * as XLSX from 'xlsx';

/** Private template builder: no large binary is committed to the repo. */
export function excelTemplate(): Blob {
  const rows = [
    ['题型', '题干', 'A', 'B', 'C', 'D', 'E', 'F', '答案', '解析'],
    [
      '单选题', '示例：能表示的最小整数是？', '−128', '−127', '−256', '127',
      '', '', 'A', '8 位补码的范围是 −128 到 127。',
    ],
    [
      '判断题', '示例：补码的减法可以转换为加法。',
      '', '', '', '', '', '', '√', 'a − b = a + (−b)。',
    ],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, '题目');
  const bytes = XLSX.write(book, { bookType: 'xlsx', type: 'array' });
  return new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
