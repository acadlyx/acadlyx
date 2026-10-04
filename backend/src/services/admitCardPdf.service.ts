import { createHash } from "crypto";

function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function jpegDimensions(data: Buffer): { width: number; height: number } | null {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < data.length) {
    if (data[i] !== 0xff) { i++; continue; }
    const marker = data[i + 1]; i += 2;
    if (marker === 0xda || marker === 0xd9) break;
    const len = data.readUInt16BE(i);
    if (len < 2 || i + len > data.length) break;
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
      return { height: data.readUInt16BE(i + 3), width: data.readUInt16BE(i + 5) };
    }
    i += len;
  }
  return null;
}

function ascii(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "?");
}

/**
 * Dependency-free, deterministic A4 PDF generator for admit cards.
 *
 * Keeping this generator dependency-free makes document generation safe on
 * Render/Vercel environments where native PDF binaries are undesirable.
 * The same data contract can later be rendered by a richer template engine.
 */
export function createAdmitCardPdf(input: {
  institutionName: string;
  institutionAddress?: string | null;
  institutionLogoJpeg?: Buffer | null;
  studentPhotoJpeg?: Buffer | null;
  examination: string;
  sessionCode: string;
  serialNumber: string;
  studentName: string;
  rollNumber?: string | null;
  enrollmentNumber?: string | null;
  program?: string | null;
  department?: string | null;
  semester?: string | null;
  papers: Array<{
    code: string;
    name: string;
    date: string;
    startTime: string;
    endTime: string;
    room: string;
    seat: string;
  }>;
  instructions?: string | null;
  verificationValue?: string;
  institutionPrimaryColor?: string | null;
  config?: {
    showPhoto?: boolean; showQr?: boolean; showInstitutionAddress?: boolean;
    showEnrollmentNumber?: boolean; showProgram?: boolean; showDepartment?: boolean;
    showSemester?: boolean; showInstructions?: boolean; showSignatures?: boolean;
    showVerificationCode?: boolean; accent?: string; title?: string; subtitle?: string;
    footer?: string; instructions?: string;
  };
}): Buffer {
  const config = input.config ?? {};
  const accent = (config.accent || input.institutionPrimaryColor || "#1f3a5f").replace("#", "");
  const rgb = /^[0-9a-fA-F]{6}$/.test(accent) ? [parseInt(accent.slice(0,2),16)/255,parseInt(accent.slice(2,4),16)/255,parseInt(accent.slice(4,6),16)/255] : [0.12,0.23,0.37];
  const lines: Array<{ text: string; x: number; y: number; size: number; bold?: boolean }> = [];
  const add = (text: unknown, x: number, y: number, size: number, bold = false) =>
    lines.push({ text: ascii(text), x, y, size, bold });

  add(input.institutionName, 50, 790, 18, true);
  if (config.showInstitutionAddress !== false) add(input.institutionAddress ?? "", 50, 768, 9);
  add(config.title || "ADMIT CARD", 240, 735, 16, true);
  add(config.subtitle || input.examination, 50, 710, 12, true);
  add(`Session: ${input.sessionCode}`, 50, 690, 9);
  add(`Admit Card No.: ${input.serialNumber}`, 390, 690, 9, true);

  const details = [
    ["Student", input.studentName],
    ["Roll Number", input.rollNumber],
    ...(config.showEnrollmentNumber === false ? [] : [["Enrollment", input.enrollmentNumber] as const]),
    ...(config.showProgram === false ? [] : [["Program", input.program] as const]),
    ...(config.showDepartment === false ? [] : [["Department", input.department] as const]),
    ...(config.showSemester === false ? [] : [["Semester", input.semester] as const]),
  ];
  let y = 650;
  for (const [label, value] of details) {
    if (value) {
      add(`${label}: ${value}`, 55, y, 10);
      y -= 20;
    }
  }

  y -= 5;
  add("EXAMINATION SCHEDULE", 50, y, 11, true);
  y -= 24;

  const columns = [
    ["Subject", 50],
    ["Date", 220],
    ["Time", 285],
    ["Room", 380],
    ["Seat", 470],
  ] as const;
  for (const [label, x] of columns) add(label, x, y, 8, true);
  y -= 16;

  for (const paper of input.papers.slice(0, 16)) {
    add(`${paper.code} - ${paper.name}`.slice(0, 35), 50, y, 7);
    add(paper.date, 220, y, 7);
    add(`${paper.startTime}-${paper.endTime}`, 285, y, 7);
    add(paper.room, 380, y, 7);
    add(paper.seat, 470, y, 7);
    y -= 16;
  }

  y = Math.max(y - 18, 95);
  if (config.showInstructions !== false) {
  add("IMPORTANT INSTRUCTIONS", 50, y, 10, true);
  y -= 17;
  const instructions = ascii(config.instructions || input.instructions || "Carry this admit card and a valid institutional identity card to every examination.");
  for (const chunk of instructions.match(/.{1,95}/g) ?? []) {
    add(chunk, 55, y, 8);
    y -= 12;
  }
  }
  if (config.showQr !== false && input.verificationValue) {
    const digest = createHash("sha256").update(input.verificationValue).digest();
    const qx = 485, qy = 80, cell = 2.4;
    for (let row = 0; row < 21; row += 1) for (let col = 0; col < 21; col += 1) {
      const bit = digest[(row * 21 + col) % digest.length] & (1 << ((row + col) % 8));
      if (bit) lines.push({ text: "", x: qx + col * cell, y: qy + row * cell, size: cell });
    }
    if (config.showVerificationCode !== false) {
      add("Verification", 485, 70, 6);
      add(input.verificationValue, 485, 60, 6, true);
    }
  }
  if (config.showSignatures !== false) add("Controller of Examinations", 420, 70, 8, true);
  add("Generated by ACADLYX", 50, 35, 7);

  const objects: string[] = [];
  const offsets: number[] = [0];
  const imageDefs: Array<{ name: string; data: Buffer; width: number; height: number }> = [];
  if (input.institutionLogoJpeg) {
    const d = jpegDimensions(input.institutionLogoJpeg);
    if (d) imageDefs.push({ name: "ImLogo", data: input.institutionLogoJpeg, ...d });
  }
  if (input.studentPhotoJpeg && config.showPhoto !== false) {
    const d = jpegDimensions(input.studentPhotoJpeg);
    if (d) imageDefs.push({ name: "ImPhoto", data: input.studentPhotoJpeg, ...d });
  }
  const imageResources = imageDefs.map((image) => `/${image.name} ${7 + imageDefs.indexOf(image)} 0 R`).join(" ");
  const content = [
    "q",
    "0.7 w",
    "50 55 495 705 re S",
    `${rgb[0].toFixed(3)} ${rgb[1].toFixed(3)} ${rgb[2].toFixed(3)} rg`,
    "50 675 495 2 re f",
    "0 0 0 rg",
    "50 675 495 0.5 re f",
    "50 600 495 0.5 re f",
    "50 560 495 0.5 re f",
    ...(imageDefs.some((x) => x.name === "ImLogo") ? ["q", "50 780 55 40 cm /ImLogo Do", "Q"] : []),
    ...(imageDefs.some((x) => x.name === "ImPhoto") ? ["q", "485 620 70 90 cm /ImPhoto Do", "Q"] : []),
    ...lines.flatMap((line) => line.text === "" && line.size <= 3
      ? [`${line.x} ${line.y} 2.4 2.4 re f`]
      : [`BT /${line.bold ? "F2" : "F1"} ${line.size} Tf ${line.x} ${line.y} Td (${escapePdfText(line.text)}) Tj ET`]),

    "Q",
  ].join("\n");

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> /XObject << ${imageResources} >> >> /Contents 4 0 R >>`);
  objects.push(`<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  for (const image of imageDefs) {
    objects.push(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.data.length} >>\nstream\n${image.data.toString("latin1")}\nendstream`);
  }

  let output = "%PDF-1.4\n";
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(output, "latin1"));
    output += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(output, "latin1");
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    output += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /ID [<${createHash("sha256").update(output).digest("hex").slice(0, 32)}> <${createHash("sha256").update(output).digest("hex").slice(0, 32)}>] >>\nstartxref\n${xref}\n%%EOF\n`;

  const buffer = Buffer.from(output, "latin1");
  if (buffer.length < 500 || !buffer.subarray(0, 8).toString("ascii").startsWith("%PDF-1.")) {
    throw new Error("Admit card PDF generation produced an invalid document.");
  }
  return buffer;
}
