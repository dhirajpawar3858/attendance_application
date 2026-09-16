// Pure CSV parse/serialise. RFC-4180-ish: handles quotes, commas, newlines in fields.

/** Serialise a single field, quoting when needed. */
function escapeField(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** Build CSV text from headers + row objects (keyed by header). */
export function toCSV(headers: string[], rows: Array<Record<string, unknown>>): string {
  const lines = [headers.map(escapeField).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeField(row[h])).join(','));
  }
  return lines.join('\r\n');
}

/** Parse CSV text into an array of objects keyed by the header row. */
export function parseCSV(text: string): Array<Record<string, string>> {
  const rows = parseRows(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  const out: Array<Record<string, string>> = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    // skip fully-empty trailing lines
    if (cells.length === 1 && cells[0] === '') continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] ?? '';
    });
    out.push(obj);
  }
  return out;
}

/** Tokenise CSV into a matrix of raw string cells. */
export function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      pushField();
      i++;
      continue;
    }
    if (ch === '\r') {
      // handle CRLF and lone CR
      if (text[i + 1] === '\n') i++;
      pushRow();
      i++;
      continue;
    }
    if (ch === '\n') {
      pushRow();
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // flush last field/row if any content remains
  if (field !== '' || row.length > 0) {
    pushRow();
  }
  return rows;
}
