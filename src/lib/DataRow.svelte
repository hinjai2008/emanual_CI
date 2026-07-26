<script>
    import Header from '@editorjs/header'; // Header can still be imported normally
    import Paragraph from '@editorjs/paragraph';
    import AlertTag from '$lib/alert-tag/alert-tag.js';
    
    import { onDestroy, onMount } from 'svelte';
    import { editedJSON, isCreateMode, pauseEditorRender } from '../routes/stores';
    import { page } from "$app/state"; // Import the $page store
    import "../routes/global.css"
    import SampleContainerTool from '$lib/sample-container-tool/sample-container-tool';
    import SynonymTool from '$lib/synonym/synonym';
    import FormLinkTool from './form-link/form-link';
    import TestFormTool from './test-form/test-form';
    import LabSelectionTool from './labSelectionTool/labSelectionTool';
    import ReferToTool from './refer-to/refer-to';
    import { formChangePropagation, containerChangePropagation } from './changePropagation.js';
    import { afterNavigate, beforeNavigate, onNavigate } from "$app/navigation";
    import { concurrentEditLock, isPublishFlowBlocked } from "../routes/stores";
    import "$lib/hideParagraphTool.css";
    import "$lib/labSelectionTool/labSelectionTool.css";
    import InlineCode from '@editorjs/inline-code';
    import { globalFunctions } from '../routes/stores';


    let { datatype, rowName, displayName, isEditable, entryData } = $props();
    let isEditing = $state(false);

    let editor = null; // Define editor at the top level

    let thisEntryEdit = $editedJSON[datatype].find(editedEntry => editedEntry.id.toString() === page.params.id);

    let modifyTraceExists = $state(false);

    function checkModifyTrace() {        
        if (!isEditable) {
            modifyTraceExists = false;
            return;
        }

        const thisModifyTrace = $editedJSON["config"]["editTrace"].find(trace => 
        trace.dataType === datatype && 
        trace.dataId.toString() === page.params.id && 
        trace.field === rowName && 
        trace.editType === "modify");

        if (thisModifyTrace) {
            modifyTraceExists = true;
        } else {
            modifyTraceExists = false;
        }
}

    function buildDefaultFormBlock(formName = "") {
        return {
            type: "form",
            data: {
                form: {
                    form_id: "",
                    form_ref_id: "",
                    form_code: "",
                    form_name: formName,
                    form_link: "",
                    form_external_link: "",
                    formRequestOnly: false,
                    specialTier: false
                }
            }
        };
    }

    function normalizeFormRowData(value) {
        const source = value && typeof value === 'object' ? value : {};
        const sourceBlocks = Array.isArray(source.blocks) ? source.blocks : [];
        const normalizedBlocks = [];

        for (const block of sourceBlocks) {
            if (!block || typeof block !== 'object') {
                continue;
            }

            if (block.type === 'form') {
                const raw = (block.data && typeof block.data === 'object')
                    ? (block.data.form && typeof block.data.form === 'object' ? block.data.form : block.data)
                    : {};

                normalizedBlocks.push({
                    ...block,
                    type: 'form',
                    data: {
                        form: {
                            form_id: raw.form_id ?? "",
                            form_ref_id: raw.form_ref_id ?? "",
                            form_code: raw.form_code ?? "",
                            form_name: raw.form_name ?? "",
                            form_link: raw.form_link ?? "",
                            form_external_link: raw.form_external_link ?? "",
                            formRequestOnly: raw.formRequestOnly === true,
                            specialTier: raw.specialTier === true
                        }
                    }
                });
                continue;
            }

            if (block.type === 'paragraph' && normalizedBlocks.length === 0) {
                const legacyText = typeof block?.data?.text === 'string' ? block.data.text.replace(/<[^>]*>/g, '').trim() : '';
                normalizedBlocks.push(buildDefaultFormBlock(legacyText));
            }
        }

        if (normalizedBlocks.length === 0) {
            normalizedBlocks.push(buildDefaultFormBlock());
        }

        return {
            ...source,
            blocks: normalizedBlocks
        };
    }

    function normalizeLoadedDataForRow(value) {
        if (rowName === 'form') {
            return normalizeFormRowData(value);
        }

        return value;
    }

    if (isEditable) {
        checkModifyTrace();
    }

    editedJSON.subscribe((value) => {

        checkModifyTrace();

        if (pauseEditorRender) { return; } // Skip rendering if pauseEditorRender is true

        thisEntryEdit = value[datatype].find(editedEntry => editedEntry.id.toString() === page.params.id);

    });

    onMount(() => {
        
        if(!editor) {
            initializeEditor(); // Initialize the editor when the component is mounted
        }

        });


    async function initializeEditor() {

        const loadedData = getCurrentLoadedData();

        if (!loadedData) {
            return
        }

        const holder = isEditable ? rowName+"-editable" : rowName;

        let tools = /** @type {Record<string, any>} */ ({
            paragraph: {
                class: Paragraph,
                inlineToolbar: true,
            },
            header: {
                class: Header,
                inlineToolbar: true,
            },
            inlineCode: {
                class: InlineCode,
                shortcut: 'CMD+SHIFT+L',
    },
        });


        if (rowName === "alert") {
            tools = {
                alertTag: {
                    class: AlertTag,
                    config: {
                            selectableTag: $editedJSON.config.alertTag
                    },
                },
            }
        }

        // For "testData" entries
        if (rowName === "container") {
            tools = {
                container: {
                    class: SampleContainerTool,
                    config: {
                        forContinerRegistration: false,
                        containerList: $editedJSON.containerData,
                    },
                },
            }
        }

        // For "ContainerData" entries
        if (rowName === "imageSrc") {
            tools = {
                imageSrc: {
                    class: SampleContainerTool,
                    config: {
                        forContinerRegistration: true,
                        containerList: $editedJSON.containerData,
                    },
                },
            }
        }

        if(rowName === "synonyms") {
            tools = {
                synonyms: {
                    class: SynonymTool,
                    config: {
                        
                    },
                },
            }
        }

        // For "Test" entries
        if(rowName === "form") {
            tools = {
                form: {
                    class: TestFormTool,
                    config: {
                        formList: $editedJSON.formData,
                    },
                },
            }
        }

        // For "Form" entries
        if(rowName === "form_link") {
            tools = {
                form_link: {
                    class: FormLinkTool,
                    config: {
                        
                    },
                },
            }
        }

        if(rowName === "lab_and_category") {
            tools = {
                lab_and_category: {
                    class: LabSelectionTool,
                    config: {
                        labList: $editedJSON.config.laboratories,
                    },
                },
            }
        }

        if(rowName === "requirement") {
            tools = {
                paragraph: {
                    class: Paragraph,
                    inlineToolbar: true,
                },
                header: {
                    class: Header,
                    inlineToolbar: true,
                },
                inlineCode: {
                    class: InlineCode,
                    shortcut: 'CMD+SHIFT+L',
                },
                referTo: {
                    class: ReferToTool,
                    config: {
                        labList: $editedJSON.config.laboratories,
                    },
                },
            }
        }


        // Dynamically import EditorJS to ensure it is only loaded in the browser
        const { default: EditorJS } = await import('@editorjs/editorjs');
        editor = new EditorJS({
            holder: holder,
            autofocus: false,
            readOnly: true,
            inlineToolbar: true,
            tools: tools,
            data: loadedData,
        });
    }

    function getCurrentLoadedData() {
        let value = null;

        if (thisEntryEdit && isEditable) {
            value = thisEntryEdit[rowName];
        }
        else if (!isEditable && entryData) {
            value = entryData[rowName];
        }

        if (!value) {
            return null;
        }

        return normalizeLoadedDataForRow(value);
    }

    async function renderCurrentDataInEditor() {
        const loadedData = getCurrentLoadedData();

        if (!editor || !loadedData || typeof editor.render !== 'function') {
            return false;
        }

        try {
            if (editor.isReady && typeof editor.isReady.then === 'function') {
                await editor.isReady;
            }

            await editor.render(loadedData);
            return true;
        } catch (error) {
            console.warn('Editor rerender failed, will recreate editor instance:', error);
            return false;
        }
    }

    async function destroyEditorInstance() {
        const currentEditor = editor;
        editor = null;

        if (!currentEditor) {
            return;
        }

        try {
            if (currentEditor.isReady && typeof currentEditor.isReady.then === 'function') {
                await currentEditor.isReady.catch(() => {});
            }

            if (typeof currentEditor.destroy === 'function') {
                currentEditor.destroy();
            }
        } catch (error) {
            console.warn('Editor teardown skipped due to error:', error);
        }
    }


    function editButtonhandler() {

        if ($isPublishFlowBlocked) {
            alert("Editing is temporarily locked while publish/deployment is in progress. Please complete deployment and refresh status.");
            return;
        }

        if ($concurrentEditLock) {
            alert("Please complete/cancel the other editing action before starting a new one.");
            return;
        }

        isEditing = true;
        editor.readOnly.toggle();
        concurrentEditLock.set(true); // Set the lock to true when editing starts

    }


    function cancelAction() {
        void destroyEditorInstance(); // Destroy the editor instance
        isEditing = false; // Reset the editing state
        concurrentEditLock.set(false); // Release the lock
        initializeEditor(); // Reinitialize the editor with the original data (editingData)
    }

    function resetAction() {

        if(!window.confirm("Confirm resetting? All current edits in this row will be lost.")){
            return; 
        }

        void destroyEditorInstance();
        let editedJSON_copy = $editedJSON;
            editedJSON_copy[datatype].map((editedTest) => {
                if (editedTest.id.toString() === page.params.id) {
                    editedTest[rowName] = entryData[rowName];
                    editedJSON.set(editedJSON_copy);
                }
            });
        isEditing = false;
        $globalFunctions.removeEditTrace(datatype, page.params.id, rowName);
        concurrentEditLock.set(false); // Release the lock
        initializeEditor();
    }


    function doneAction() {
        editor.save().then((outputData) => {

            if (rowName === "requirement" && outputData && outputData.blocks) {
                outputData.blocks = outputData.blocks.map((block) => {
                    if (block.type === 'referTo') {
                        return {
                            ...block,
                            type: 'paragraph',
                            data: {
                                text: block.data?.text || '',
                            },
                        };
                    }
                    return block;
                });
            }

            //validation
            // The following fields cannot be empty as they will be indexed by the search
            if (rowName === "full_name" || rowName === "label_name" || rowName === "form_name" || rowName === "form_code" || rowName === "name" || rowName === "code") {

                if (!outputData.blocks) {
                    alert("This field cannot be empty.");
                    return;
                }

                if (outputData.blocks.length === 0) {
                    alert("This field cannot be empty.");
                    return;
                }

                if (outputData.blocks[0].data.text.length === 0) {
                    alert("This field cannot be empty.");
                    return;
                }
            }


            const FORM_PROPAGATED_FIELDS = ['form_link', 'form_external_link', 'form_name', 'form_code'];
            const CONTAINER_PROPAGATED_FIELDS = ['imageSrc'];
            const willPropagate =
                (datatype === 'formData' && entryData?.refId && FORM_PROPAGATED_FIELDS.includes(rowName)) ||
                (datatype === 'containerData' && entryData?.refId && CONTAINER_PROPAGATED_FIELDS.includes(rowName));

            if (willPropagate) {
                const entityLabel = datatype === 'formData' ? 'form' : 'container';
                if (!window.confirm(`Saving "${rowName}" will automatically update this field in all test entries that reference this ${entityLabel}. Proceed?`)) {
                    return; // abort save, editor stays in editing mode
                }
            }

            let editedJSON_copy = $editedJSON;
            editedJSON_copy[datatype].map((editedTest) => {
                if (editedTest.id.toString() === page.params.id) {
                    editedTest[rowName] = outputData;
                    editedJSON.set(editedJSON_copy);
                    console.log(editedJSON_copy);
                }
            });
            editor.readOnly.toggle();
            isEditing = false;
            if (datatype === 'formData' && entryData?.refId && FORM_PROPAGATED_FIELDS.includes(rowName)) {
                formChangePropagation(entryData.refId, rowName, outputData);
            }
            if (datatype === 'containerData' && entryData?.refId && CONTAINER_PROPAGATED_FIELDS.includes(rowName)) {
                containerChangePropagation(entryData.refId, rowName, outputData);
            }
            if(entryData) {
                $globalFunctions.updateEditTrace(datatype, page.params.id, null, "modify", rowName, entryData[rowName], outputData);
            }
            concurrentEditLock.set(false); // Release the lock
       
        }).catch((error) => {
            console.log('Saving failed: ', error);
        });
    }


    afterNavigate(() => {

        if(isEditable) {
            checkModifyTrace();
        }

        if ($pauseEditorRender) { return; } // Skip rendering if pauseEditorRender is true

        // This effect will run whenever the page changes
        let currentPage = page.params.id; // Get the current page ID from the URL
        if (editor) {
            thisEntryEdit = $editedJSON[datatype].find(editedEntry => editedEntry.id.toString() === page.params.id);
            void (async () => {
                const rendered = await renderCurrentDataInEditor();
                if (!rendered) {
                    await destroyEditorInstance();
                    await initializeEditor();
                }
            })();

        }

    });


    onDestroy(() => {
        void destroyEditorInstance(); // Clean up the editor instance when the component is destroyed
    });

    beforeNavigate(({cancel})=>{
        if (isEditing) {
            window.alert("You have unsaved changes. Please save or cancel before navigating away.");
            cancel();
        }
    })

</script>

<tr>
    <th scope="row" style="{isEditable && modifyTraceExists ? 'background-color: #fff3cd;' : ''}">{displayName}</th>
    <td class="position-relative" style="width: 80%;">

        <div id="{rowName}{isEditable ? "-editable" : ""}"></div>

        {#if isEditing}

        <div class="position-relative">
            <div class="d-flex justify-content-end">
                {#if entryData}
                <button type="button" class="btn btn-sm btn-secondary ms-2" style="margin-top: 150px;" onclick={()=>resetAction()}>Reset</button>
                {/if}
                <button type="button" class="btn btn-sm btn-secondary ms-2" style="margin-top: 150px;" onclick={()=>cancelAction()}>Cancel</button>
                <button type="button" class="btn btn-sm btn-primary ms-2" style="margin-top: 150px;" onclick={()=>doneAction()}>Done</button>
            </div>
        </div>

        {:else if isEditable && !$concurrentEditLock && !$isPublishFlowBlocked}
        <div>
            <button type="button" class="btn btn-sm btn-secondary position-absolute top-50 end-0 mx-3 translate-middle-y opacity-75 z-3" onclick={() => editButtonhandler()}>Edit</button>
        </div>
        {/if}
    </td>
</tr>