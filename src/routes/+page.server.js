import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { tests } from './dataUtility.js';

export const prerender = true;

export function load() {
	// const firstTestId = Math.min(...tests.map((test) => test.id));
	// redirect(307, `${base}/test/${firstTestId}`);
}
