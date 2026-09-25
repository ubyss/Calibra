function detectDelimiter(firstLine: string): string {
  const semicolons = firstLine.split(';').length;
  const commas = firstLine.split(',').length;
  return semicolons > commas ? ';' : ',';
}

export function parseCsv(text: string): string[][] {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const delimiter = detectDelimiter(normalized.split('\n')[0] ?? '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let isQuoted = false;

  for (let index = 0; index < normalized.length; index++) {
    const char = normalized[index];

    if (isQuoted) {
      if (char === '"' && normalized[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') {
        isQuoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      isQuoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
}

function escapeCell(value: string | number): string {
  const text = String(value);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(escapeCell).join(';')).join('\n');
}

export function downloadFile(fileName: string, content: string, mimeType: string): void {
  const blob = new Blob(['\uFEFF', content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
