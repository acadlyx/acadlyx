import { appendFile, stat } from "fs/promises";

export interface ZipEntry {
  name: string;
  offset: number;
  crc: number;
  size: number;
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number): Buffer {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function u32(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

export async function appendZipEntry(
  path: string,
  entries: ZipEntry[],
  name: string,
  data: Buffer,
): Promise<void> {
  if (!data.length) throw new Error("Cannot add an empty ZIP entry.");
  const nameBuffer = Buffer.from(name, "utf8");
  if (!nameBuffer.length || nameBuffer.length > 0xffff) {
    throw new Error("ZIP entry name is invalid or too long.");
  }

  const crc = crc32(data);
  const fileStat = await stat(path);
  const localHeader = Buffer.concat([
    Buffer.from("PK\\x03\\x04", "binary"),
    u16(20),
    u16(0x800),
    u16(0),
    u16(0),
    u16(0),
    u32(crc),
    u32(data.length),
    u32(data.length),
    u16(nameBuffer.length),
    u16(0),
    nameBuffer,
  ]);

  await appendFile(path, Buffer.concat([localHeader, data]));
  entries.push({
    name,
    offset: fileStat.size,
    crc,
    size: data.length,
  });
}

export async function finishZipArchive(
  path: string,
  entries: ZipEntry[],
): Promise<void> {
  if (!entries.length) throw new Error("Cannot finalize an empty ZIP archive.");

  const centralDirectory: Buffer[] = [];
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    centralDirectory.push(
      Buffer.concat([
        Buffer.from("PK\\x01\\x02", "binary"),
        u16(20),
        u16(20),
        u16(0x800),
        u16(0),
        u16(0),
        u16(0),
        u32(entry.crc),
        u32(entry.size),
        u32(entry.size),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(entry.offset),
        name,
      ]),
    );
  }

  const central = Buffer.concat(centralDirectory);
  const fileStat = await stat(path);
  const end = Buffer.concat([
    Buffer.from("PK\\x05\\x06", "binary"),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(central.length),
    u32(fileStat.size),
    u16(0),
  ]);

  await appendFile(path, Buffer.concat([central, end]));
}
