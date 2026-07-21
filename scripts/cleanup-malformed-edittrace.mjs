#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const VALID_DATA_TYPES = new Set(['testData', 'formData', 'containerData']);
const VALID_EDIT_TYPES = new Set(['add', 'modify', 'remove', 'hide', 'unhide']);

function printUsage() {
  console.log('Usage: node scripts/cleanup-malformed-edittrace.mjs <input.json> [output.json] [--in-place]');
  console.log('Example: node scripts/cleanup-malformed-edittrace.mjs "C:/Users/raypc/Downloads/drafts_shared_latest.json" --in-place');
}

function isValidTrace(trace) {
  if (!trace || typeof trace !== 'object' || Array.isArray(trace)) {
    return false;
  }

  if (typeof trace.dataType !== 'string' || !VALID_DATA_TYPES.has(trace.dataType)) {
    return false;
  }

  if (typeof trace.editType !== 'string' || !VALID_EDIT_TYPES.has(trace.editType)) {
    return false;
  }

  if (!Object.prototype.hasOwnProperty.call(trace, 'dataId')) {
    return false;
  }

  return true;
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    printUsage();
    process.exit(1);
  }

  const inPlace = args.includes('--in-place');
  const filteredArgs = args.filter((value) => value !== '--in-place');

  const inputPath = filteredArgs[0];
  if (!inputPath) {
    printUsage();
    process.exit(1);
  }

  const resolvedInputPath = path.resolve(inputPath);
  if (!fs.existsSync(resolvedInputPath)) {
    console.error(`Input file not found: ${resolvedInputPath}`);
    process.exit(1);
  }

  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(resolvedInputPath, 'utf8'));
  } catch (error) {
    console.error(`Invalid JSON in ${resolvedInputPath}: ${error.message}`);
    process.exit(1);
  }

  const editTrace = payload?.editedJSON?.config?.editTrace;
  if (!Array.isArray(editTrace)) {
    console.error('No editedJSON.config.editTrace array found.');
    process.exit(1);
  }

  const invalidIndexes = [];
  const cleaned = [];

  for (let index = 0; index < editTrace.length; index += 1) {
    const trace = editTrace[index];
    if (isValidTrace(trace)) {
      cleaned.push(trace);
    } else {
      invalidIndexes.push(index);
    }
  }

  payload.editedJSON.config.editTrace = cleaned;

  let outputPath = filteredArgs[1];
  if (inPlace) {
    outputPath = resolvedInputPath;
  }

  if (!outputPath) {
    const parsed = path.parse(resolvedInputPath);
    outputPath = path.join(parsed.dir, `${parsed.name}.cleaned${parsed.ext || '.json'}`);
  } else {
    outputPath = path.resolve(outputPath);
  }

  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(`Input trace count: ${editTrace.length}`);
  console.log(`Removed malformed rows: ${invalidIndexes.length}`);
  if (invalidIndexes.length) {
    console.log(`Removed indexes: ${invalidIndexes.join(', ')}`);
  }
  console.log(`Output file: ${outputPath}`);
}

main();
