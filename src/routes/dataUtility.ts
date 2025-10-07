import rawData from './rawData.json';

export interface Test {
    id: number;
    full_name: string;
    GCRS_name: string;
    label_name: string;
    form: string;
    hospital: string;
    requirement: string;
    container: string;
    indication: string;
    turn_around_time: string;
    synonyms: string[];
    alert: string[];
    last_updated: string;
    lab_and_category: string;
    lab_handling: string;
}

export interface Form {
    id: number;
    form_name: string;
    form_code: string;
    form_link: string;
    remark: string;
    lab_and_category: string;
    last_updated: string;
}

export interface container {
    id: number;
    code: string;
    name: string;
    imageSrc: string;
    remark: string;
    synonyms: string[];
    last_modified: string;
}

export const tests: Test[] = rawData.testData as Test[];

export const forms: Form[] = rawData.formData as Form[];

export const containers: container[] = rawData.containerData as container[];

// Utility function to find duplicate IDs
export function findDuplicateIds<T extends { id: number }>(items: T[]): number[] {
    const ids = items.map(item => item.id);
    const duplicates: number[] = [];
    const seen = new Set<number>();

    for (const id of ids) {
        if (seen.has(id)) {
            duplicates.push(id);
        } else {
            seen.add(id);
        }
    }

    return [...new Set(duplicates)]; // Ensure duplicates are unique
}

// Example usage:
// const duplicateTestIds = findDuplicateIds(tests);
// const duplicateFormIds = findDuplicateIds(forms);