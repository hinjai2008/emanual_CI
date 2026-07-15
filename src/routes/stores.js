import { writable } from 'svelte/store';
import completeJSON from './rawData.json'

export const initialJSON = completeJSON;

export const isAdmin = writable(false);

export const isStaff = writable(false);

export const isEditMode = writable(false);

export const beginEditSession = writable(async () => {
  isEditMode.set(true);
});

export const editedJSON = writable(completeJSON);

export const isCreateMode = writable(false);

export const concurrentEditLock = writable(false);

export const pauseEditorRender = writable(false);

export const globalFunctions = writable({
  updateEditTrace: null,
  deleteEntry: null
});

export function setBeginEditSession(handler) {
  beginEditSession.set(handler);
}

export function setGlobalFunctions(functions) {
  globalFunctions.set(functions);
}