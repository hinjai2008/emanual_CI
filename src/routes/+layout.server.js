import {tests} from './data.js'

// This can be false if you're using a fallback (i.e. SPA mode)
export const prerender = true;

export function load() {
    
    return {
        tests
    };
};

