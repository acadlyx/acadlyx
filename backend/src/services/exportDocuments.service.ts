import { Buffer } from "node:buffer";

export type ExportDocumentRow = Record<string, string | number | boolean | null>;

function valueText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function xmlEscape(value: unknown): string {
  return valueText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** RFC 4180 CSV. Text that could be interpreted as a spreadsheet formula is neutralized. */
export function createCsv(rows: ExportDocumentRow[]): Buffer {
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const protect = (input: unknown): string => {
    let value = valueText(input);
    if (typeof input !== "number" && typeof input !== "boolean" && /^[\t\r\n ]*[=+\-@]/.test(value)) value = "'" + value;
    if (/[",\r\n]/.test(value)) value = '"' + value.replace(/"/g, '""') + '"';
    return value;
  };
  if (!columns.length) return Buffer.from("\uFEFF", "utf8");
  const lines = [columns.map(protect).join(","), ...rows.map((row) => columns.map((key) => protect(row[key])).join(","))];
  return Buffer.from("\uFEFF" + lines.join("\r\n") + "\r\n", "utf8");
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Minimal ZIP writer using stored entries. This keeps DOCX generation dependency-free. */
function zipStored(files: Array<{ name: string; data: Buffer }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const data = file.data;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(33, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function wordRun(value: unknown, bold = false): string {
  const text = xmlEscape(value);
  return "<w:r>" + (bold ? "<w:rPr><w:b/></w:rPr>" : "") +
    "<w:t xml:space=\"preserve\">" + text + "</w:t></w:r>";
}

function wordParagraph(value: unknown, bold = false): string {
  return "<w:p>" + wordRun(value, bold) + "</w:p>";
}

function wordCell(value: unknown, header = false): string {
  return "<w:tc><w:tcPr><w:tcW w:w=\"2400\" w:type=\"dxa\"/>" +
    (header ? "<w:shd w:fill=\"DCE6F1\"/>" : "") +
    "</w:tcPr>" + wordParagraph(value, header) + "</w:tc>";
}

function wordRow(values: unknown[], header = false): string {
  return "<w:tr>" + values.map((value) => wordCell(value, header)).join("") + "</w:tr>";
}

/** Generate a valid Office Open XML Word document without requiring a native binary. */
export function createDocx(rows: ExportDocumentRow[], type: string): Buffer {
  const columns = rows.length ? Object.keys(rows[0]) : ["Result"];
  const bodyRows = rows.length
    ? rows.map((row) => wordRow(columns.map((key) => valueText(row[key])))).join("")
    : wordRow(["No records matched the selected export."]);
  const table = "<w:tbl><w:tblPr><w:tblW w:w=\"0\" w:type=\"auto\"/><w:tblBorders>" +
    ["top", "left", "bottom", "right", "insideH", "insideV"].map((edge) =>
      "<w:" + edge + " w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"B7C9D6\"/>").join("") +
    "</w:tblBorders></w:tblPr><w:tblGrid>" + columns.map(() => "<w:gridCol w:w=\"2400\"/>").join("") +
    "</w:tblGrid>" + wordRow(columns, true) + bodyRows + "</w:tbl>";
  const documentXml = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
    "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body>" +
    wordParagraph("ACADLYX — " + type + " export", true) +
    wordParagraph("Records: " + rows.length + " | Generated: " + new Date().toISOString()) +
    table +
    "<w:sectPr><w:pgSz w:w=\"16838\" w:h=\"11906\" w:orient=\"landscape\"/><w:pgMar w:top=\"720\" w:right=\"720\" w:bottom=\"720\" w:left=\"720\" w:header=\"360\" w:footer=\"360\" w:gutter=\"0\"/></w:sectPr>" +
    "</w:body></w:document>";
  const files = [
    { name: "[Content_Types].xml", data: Buffer.from("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/></Types>", "utf8") },
    { name: "_rels/.rels", data: Buffer.from("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/></Relationships>", "utf8") },
    { name: "word/document.xml", data: Buffer.from(documentXml, "utf8") },
  ];
  return zipStored(files);
}

function ascii(value: unknown): string {
  return valueText(value).normalize("NFKD").replace(/[^\x20-\x7e]/g, "?");
}

function pdfEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function splitText(text: string, width = 100): string[] {
  const words = text.split(/\s+/);
  const result: string[] = [];
  let line = "";
  for (const word of words) {
    if (!word) continue;
    if (word.length > width) {
      if (line) result.push(line);
      line = "";
      for (let i = 0; i < word.length; i += width) result.push(word.slice(i, i + width));
    } else if (!line) line = word;
    else if ((line + " " + word).length <= width) line += " " + word;
    else { result.push(line); line = word; }
  }
  if (line) result.push(line);
  return result.length ? result : [""];
}

/** Plain, searchable, multi-page A4 PDF output using the standard Helvetica font. */
export function createPdf(rows: ExportDocumentRow[], type: string): Buffer {
  const lines: string[] = ["ACADLYX - " + ascii(type) + " export", "Records: " + rows.length + " | Generated: " + new Date().toISOString(), ""];
  if (!rows.length) lines.push("No records matched the selected export.");
  rows.forEach((row, index) => {
    lines.push("Record " + (index + 1));
    for (const [key, value] of Object.entries(row)) lines.push(...splitText(ascii(key) + ": " + ascii(value)));
    lines.push("");
  });
  const pageLines: string[][] = [];
  for (let i = 0; i < lines.length; i += 54) pageLines.push(lines.slice(i, i + 54));
  const pages = pageLines.length ? pageLines : [["No records matched the selected export."]];
  const objects: string[] = [];
  const pageIds = pages.map((_, index) => 4 + index * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = "<< /Type /Pages /Kids [" + pageIds.map((id) => id + " 0 R").join(" ") + "] /Count " + pages.length + " >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pages.forEach((page, index) => {
    const pageId = 4 + index * 2;
    const contentId = pageId + 1;
    const ops: string[] = ["BT", "/F1 9 Tf", "48 798 Td", "13 TL"];
    page.forEach((line, lineIndex) => {
      if (lineIndex > 0) ops.push("T*");
      ops.push("(" + pdfEscape(line) + ") Tj");
    });
    ops.push("ET");
    const stream = ops.join("\n");
    objects[pageId] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents " + contentId + " 0 R >>";
    objects[contentId] = "<< /Length " + Buffer.byteLength(stream, "ascii") + " >>\nstream\n" + stream + "\nendstream";
  });
  let output = "%PDF-1.4\n%ACADLYX\n";
  const offsets: number[] = [0];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(output, "ascii");
    output += id + " 0 obj\n" + objects[id] + "\nendobj\n";
  }
  const xref = Buffer.byteLength(output, "ascii");
  output += "xref\n0 " + objects.length + "\n0000000000 65535 f \n";
  for (let id = 1; id < objects.length; id++) output += String(offsets[id]).padStart(10, "0") + " 00000 n \n";
  output += "trailer\n<< /Size " + objects.length + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n";
  return Buffer.from(output, "ascii");
}
