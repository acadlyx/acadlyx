import assert from "node:assert/strict";
import test from "node:test";
import { assertUploadContentMatchesMime } from "../services/fileStorage.service";

test("JPEG, PNG, WebP and GIF payloads must match their declared image MIME", () => {
  assert.doesNotThrow(() => assertUploadContentMatchesMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg"));
  assert.doesNotThrow(() => assertUploadContentMatchesMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"));
  assert.doesNotThrow(() => assertUploadContentMatchesMime(Buffer.from("RIFF0000WEBP", "ascii"), "image/webp"));
  assert.doesNotThrow(() => assertUploadContentMatchesMime(Buffer.from("GIF89a", "ascii"), "image/gif"));
  assert.throws(() => assertUploadContentMatchesMime(Buffer.from("<html>not an image</html>"), "image/jpeg"), /does not match/i);
});

test("PDF and ZIP payloads must have their format signatures", () => {
  assert.doesNotThrow(() => assertUploadContentMatchesMime(Buffer.from("%PDF-1.7", "ascii"), "application/pdf"));
  assert.doesNotThrow(() => assertUploadContentMatchesMime(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]), "application/zip"));
  assert.doesNotThrow(() => assertUploadContentMatchesMime(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
  assert.throws(() => assertUploadContentMatchesMime(Buffer.from("<script>alert(1)</script>"), "application/pdf"), /does not match/i);
});

test("CSV and text files must be valid UTF-8 text without NUL bytes", () => {
  assert.doesNotThrow(() => assertUploadContentMatchesMime(Buffer.from("name,score\nA,90\n", "utf8"), "text/csv"));
  assert.doesNotThrow(() => assertUploadContentMatchesMime(Buffer.from("Student notes", "utf8"), "text/plain"));
  assert.throws(() => assertUploadContentMatchesMime(Buffer.from([0x41, 0x00, 0x42]), "text/plain"), /does not match/i);
  assert.throws(() => assertUploadContentMatchesMime(Buffer.from([0xff, 0xfe, 0xff]), "text/csv"), /does not match/i);
});
