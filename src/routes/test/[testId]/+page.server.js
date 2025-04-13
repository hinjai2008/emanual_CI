import { tests, findDuplicateIds} from '../../data.js';
import { error } from '@sveltejs/kit';

/**
 * @param {{ params: { testId: string } }} context - `params.testId` is a string representing a numeric ID.
 */
export function load({ params }) {
    const test = tests.find((test) => test.id === parseInt(params.testId));

    if (!test) error(404);

    return {
        test
    };
}


// To tell the prerender about the dynamic route, we need to export a function that returns an array of all the possible values for the dynamic parameter.
// This function will be called at build time, so it should not rely on any runtime data.
// In this case, we can simply return an array of all the test IDs.
export function entries() {


    // Check for duplicate IDs in the tests array
    const duplicateIds = findDuplicateIds(tests);
    if (duplicateIds.length > 0) {
        throw new Error("Duplicate IDs found in the tests array: " + duplicateIds + ". Please ensure all IDs are unique.");
    }

    return tests.map((test) => {
        return {
                testId: test.id.toString()
            }
        });
    };