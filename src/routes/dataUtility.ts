import testData from './testData.json';

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
}

export const tests: Test[] = testData.testData as Test[];

// Utility function to find duplicate IDs
export function findDuplicateIds(tests: Test[]): number[] {
    const ids = tests.map(test => test.id);
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

// Example usage: Validate the `tests` array
// const duplicateIds = findDuplicateIds(tests);
// if (duplicateIds.length > 0) {
//     console.error("Duplicate IDs found in the tests array:", duplicateIds);
// }