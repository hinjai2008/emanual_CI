import { tests } from './dataUtility.js'
import { forms } from './dataUtility.js'
import completeJSON from './rawData.json'

// This can be false if you're using a fallback (i.e. SPA mode)
export const prerender = true;


export function load({}) {
    
    return {
        tests,
        forms,
        completeJSON,
    };
};

