import { writable } from 'svelte/store';
import { tests } from './dataUtility';

export const isAdmin = writable(false);

export const isEditMode = writable(false);

export const editedTestData = writable(tests);