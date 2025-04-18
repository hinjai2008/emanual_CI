import {tests} from './dataUtility.js'
import rawTestData from './testData.json'

// This can be false if you're using a fallback (i.e. SPA mode)
export const prerender = true;


export function load({}) {
    
    return {
        tests,
        rawTestData
    };
};

