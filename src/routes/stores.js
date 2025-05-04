import { writable } from 'svelte/store';
import completeJSON from './rawData.json'

export const isAdmin = writable(false);

export const isEditMode = writable(false);

export const editedJSON = writable(completeJSON);