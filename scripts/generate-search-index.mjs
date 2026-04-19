import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const rawDataPath = path.join(projectRoot, 'src', 'routes', 'rawData.json');
const outputPath = path.join(projectRoot, 'static', 'search-index.json');

function toTextBlocks(field) {
  if (!field || !Array.isArray(field.blocks) || field.blocks.length === 0) {
    return '';
  }

  return field.blocks[0]?.data?.text || '';
}

function toSynonyms(field) {
  if (!field || !Array.isArray(field.blocks) || field.blocks.length === 0) {
    return '';
  }

  const list = field.blocks[0]?.data?.synonymList;
  if (!Array.isArray(list)) {
    return '';
  }

  return list.join(' ');
}

function toSynonymsList(field) {
  if (!field || !Array.isArray(field.blocks) || field.blocks.length === 0) {
    return [];
  }

  const list = field.blocks[0]?.data?.synonymList;
  return Array.isArray(list) ? list : [];
}

function toCategoryCodes(field) {
  if (!field || !Array.isArray(field.blocks)) {
    return [];
  }

  return field.blocks
    .map((block) => block?.data?.categoryCode)
    .filter((code) => typeof code === 'string' && code.length > 0);
}

function buildIndex(rawData) {
  const tests = (rawData.testData || []).filter((test) => test?.is_hidden !== true).map((test) => ({
    id: `test/${test.id}`,
    full_name: toTextBlocks(test.full_name),
    GCRS_name: toTextBlocks(test.GCRS_name),
    short_name: toTextBlocks(test.label_name),
    synonyms: toSynonyms(test.synonyms),
    synonymsList: toSynonymsList(test.synonyms),
    editType: '',
    categoryCodes: toCategoryCodes(test.lab_and_category)
  }));

  const forms = (rawData.formData || []).filter((form) => form?.is_hidden !== true).map((form) => ({
    id: `form/${form.id}`,
    full_name: toTextBlocks(form.form_name),
    GCRS_name: '',
    short_name: toTextBlocks(form.form_code),
    synonyms: '',
    editType: '',
    categoryCodes: toCategoryCodes(form.lab_and_category)
  }));

  const containers = (rawData.containerData || []).filter((container) => container?.is_hidden !== true).map((container) => ({
    id: `container/${container.id}`,
    full_name: toTextBlocks(container.name),
    GCRS_name: '',
    short_name: toTextBlocks(container.code),
    synonyms: toSynonyms(container.synonyms),
    synonymsList: toSynonymsList(container.synonyms),
    editType: '',
    categoryCodes: []
  }));

  return {
    generatedAt: new Date().toISOString(),
    categories: rawData?.config?.category || [],
    indexData: {
      tests,
      forms,
      containers
    }
  };
}

const rawData = JSON.parse(fs.readFileSync(rawDataPath, 'utf8'));
const searchIndex = buildIndex(rawData);

fs.writeFileSync(outputPath, JSON.stringify(searchIndex), 'utf8');

console.log(
  `Generated static/search-index.json (tests: ${searchIndex.indexData.tests.length}, forms: ${searchIndex.indexData.forms.length}, containers: ${searchIndex.indexData.containers.length})`
);
