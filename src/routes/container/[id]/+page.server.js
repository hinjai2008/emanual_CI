import { containers, findDuplicateIds} from '../../dataUtility.js';
import { error } from '@sveltejs/kit';

/**
 * @param {{ params: { id: string } }} context - `params.id` is a string representing a numeric ID.
 */

export async function load({ params }) {
    const container = containers.find((container) => container.id === parseInt(params.id));

    if (!container) {
    return {
        entryData: null,
    }
    }

    return {
        entryData: container,
    };
}


// To tell the prerender about the dynamic route, we need to export a function that returns an array of all the possible values for the dynamic parameter.
// This function will be called at build time, so it should not rely on any runtime data.
// In this case, we can simply return an array of all the test IDs.
export function entries() {


    // Check for duplicate IDs in the tests array
    const duplicateIds = findDuplicateIds(containers);
    if (duplicateIds.length > 0) {
        throw new Error("Duplicate IDs found in the containers array: " + duplicateIds + ". Please ensure all IDs are unique.");
    }

       const maximumId = Math.max(...containers.map(container => container.id));
   
       const NUM_RESERVED_ID = 50;
   
       const idArray = []
   
       for (let i = 1; i <= maximumId + NUM_RESERVED_ID; i++) {
   
           // If the test is not found, we can still add an entry with a placeholder
           idArray.push({
               id: i.toString(),
           });
       }
   
       return idArray
    };