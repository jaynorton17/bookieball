/**
 * Convert a PNG image to ICO format.
 * The ICO file embeds the PNG data directly (modern approach, supported Vista+).
 *
 * Usage: node scripts/png-to-ico.mjs <input.png> [output.ico]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, basename, dirname } from 'node:path';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/png-to-ico.mjs <input.png> [output.ico]');
  process.exit(1);
}

let outputPath = process.argv[3];
if (!outputPath) {
  outputPath = resolve(dirname(inputPath), basename(inputPath, '.png') + '.ico');
}

async function convertPngToIco(input, output) {
  const pngData = await readFile(input);

  // ICO header: reserved(2) + type(2) + count(2)
  // type=1 means ICO
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);     // reserved
  header.writeUInt16LE(1, 2);     // type = ICO
  header.writeUInt16LE(1, 4);     // count = 1 image

  // Directory entry: 16 bytes
  const entry = Buffer.alloc(16);
  // Width (0 means 256)
  entry.writeUInt8(0, 0);
  // Height (0 means 256)
  entry.writeUInt8(0, 1);
  // Color palette count (0 means no palette)
  entry.writeUInt8(0, 2);
  // Reserved
  entry.writeUInt8(0, 3);
  // Color planes (1 for ICO)
  entry.writeUInt16LE(1, 4);
  // Bits per pixel (32 for PNG with alpha)
  entry.writeUInt16LE(32, 6);
  // Size of image data
  entry.writeUInt32LE(pngData.length, 8);
  // Offset in file (header + entry = 22)
  entry.writeUInt32LE(22, 12);

  const icoData = Buffer.concat([header, entry, pngData]);
  await writeFile(output, icoData);
  console.log(`Created ICO: ${output} (${icoData.length} bytes)`);
}

convertPngToIco(inputPath, outputPath).catch((err) => {
  console.error('Conversion failed:', err);
  process.exit(1);
});
