// Apply changes to test entries that have references to the changed form/container

import { editedJSON } from '../routes/stores';
import { get } from 'svelte/store';

// Fields in formData that are snapshotted into each test entry's form block,
// mapped to the corresponding key inside data.form.
const FORM_FIELD_MAP = {
    form_link:          (outputData) => outputData?.blocks?.[0]?.data?.url  ?? '',
    form_external_link: (outputData) => outputData?.blocks?.[0]?.data?.text ?? '',
    form_name:          (outputData) => outputData?.blocks?.[0]?.data?.text ?? '',
    form_code:          (outputData) => outputData?.blocks?.[0]?.data?.text ?? '',
};

/**
 * After a form entry field is saved, update the snapshot value stored in every
 * test entry that references the same form (matched by form_ref_id).
 *
 * @param {string|number} formRefId  - The refId of the form entry that was edited.
 * @param {string}        rowName    - The DataRow field that was saved (e.g. "form_link").
 * @param {object}        outputData - The EditorJS outputData returned by editor.save().
 */
export function formChangePropagation(formRefId, rowName, outputData) {
    const extractor = FORM_FIELD_MAP[rowName];
    if (!extractor) return; // field is not snapshotted in test entries

    const newValue = extractor(outputData);
    const refIdStr = String(formRefId);

    const current = get(editedJSON);
    let changed = false;

    for (const test of current.testData) {
        for (const blk of (test.form?.blocks ?? [])) {
            if (blk.type === 'form' && String(blk.data?.form?.form_ref_id) === refIdStr) {
                if (blk.data.form[rowName] !== newValue) {
                    blk.data.form[rowName] = newValue;
                    changed = true;
                }
            }
        }
    }

    if (changed) {
        editedJSON.set(current);
    }
}

/**
 * After a container entry's imageSrc field is saved, update the imageSrc
 * stored in every test entry container block that references the same container
 * (matched by ##CODE## pattern in data.text).
 *
 * @param {string|number} containerRefId - The refId of the container entry that was edited.
 * @param {string}        rowName        - The DataRow field that was saved (e.g. "imageSrc").
 * @param {object}        outputData     - The EditorJS outputData returned by editor.save().
 */
export function containerChangePropagation(containerRefId, rowName, outputData) {
    if (rowName !== 'imageSrc') return; // only imageSrc is snapshotted in test blocks

    const newImageSrc = outputData?.blocks?.[0]?.data?.imageSrc ?? '';
    const refIdStr = String(containerRefId);

    const current = get(editedJSON);

    // Resolve the container code from containerData by refId
    const containerEntry = current.containerData.find(
        (c) => String(c.refId) === refIdStr
    );
    if (!containerEntry) return;

    const codeText = containerEntry.code?.blocks?.[0]?.data?.text ?? '';
    if (!codeText) return;

    const codePattern = `##${codeText.toUpperCase()}##`;
    let changed = false;

    for (const test of current.testData) {
        for (const blk of (test.container?.blocks ?? [])) {
            if (
                blk.type === 'container' &&
                blk.data?.text?.toUpperCase() === codePattern &&
                blk.data.imageSrc !== newImageSrc
            ) {
                blk.data.imageSrc = newImageSrc;
                changed = true;
            }
        }
    }

    if (changed) {
        editedJSON.set(current);
    }
}