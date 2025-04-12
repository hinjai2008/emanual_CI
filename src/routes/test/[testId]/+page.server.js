import { tests } from '../../data.js';
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