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
    import { afterNavigate, beforeNavigate, onNavigate } from "$app/navigation";
    import { concurrentEditLock } from "../routes/stores";
    import "$lib/hideParagraphTool.css";
    import InlineCode from '@editorjs/inline-code';


    let { datatype, rowName, displayName, isEditable, entryData } = $props();
    let isEditing = $state(false);

    let editor = null; // Define editor at the top level

    let thisEntryEdit = $editedJSON[datatype].find(editedEntry => editedEntry.id.toString() === page.params.id);


    editedJSON.subscribe((value) => {

        if (pauseEditorRender) { return; } // Skip rendering if pauseEditorRender is true

        thisEntryEdit = value[datatype].find(editedEntry => editedEntry.id.toString() === page.params.id);
    });

    onMount(() => {
        
        if(!editor) {
            initializeEditor(); // Initialize the editor when the component is mounted
        }

        });


    async function initializeEditor() {

        let loadedData;

        if(thisEntryEdit && isEditable) {
            loadedData = thisEntryEdit[rowName];
        }

        else if (!isEditable && entryData) {
            loadedData = entryData[rowName];
        }

        else {
            return
        }

        const holder = isEditable ? rowName+"-editable" : rowName;

        let tools = {
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
        };


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


    function editButtonhandler() {

        if ($concurrentEditLock) {
            alert("Please complete/cancel the other editing action before starting a new one.");
            return;
        }

        isEditing = true;
        editor.readOnly.toggle();
        concurrentEditLock.set(true); // Set the lock to true when editing starts

    }


    function cancelAction() {
        editor.destroy(); // Destroy the editor instance
        isEditing = false; // Reset the editing state
        concurrentEditLock.set(false); // Release the lock
        initializeEditor(); // Reinitialize the editor with the original data (editingData)
    }

    function resetAction() {

        if(!window.confirm("Confirm resetting? All current edits in this row will be lost.")){
            return; 
        }

        editor.destroy();
        let editedJSON_copy = $editedJSON;
            editedJSON_copy[datatype].map((editedTest) => {
                if (editedTest.id.toString() === page.params.id) {
                    editedTest[rowName] = entryData[rowName];
                    editedJSON.set(editedJSON_copy);
                }
            });
        isEditing = false;
        concurrentEditLock.set(false); // Release the lock
        initializeEditor();
    }


    function doneAction() {
        editor.save().then((outputData) => {

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
            concurrentEditLock.set(false); // Release the lock
       
        }).catch((error) => {
            console.log('Saving failed: ', error);
        });
    }


    afterNavigate(() => {

        if ($pauseEditorRender) { return; } // Skip rendering if pauseEditorRender is true

        // This effect will run whenever the page changes
        let currentPage = page.params.id; // Get the current page ID from the URL
        if (editor) {

            editor.destroy();
            thisEntryEdit = $editedJSON[datatype].find(editedEntry => editedEntry.id.toString() === page.params.id);
            initializeEditor()

        }

    });


    onDestroy(() => {
        if (editor) {

            editor.isReady.then(() => {

                editor.destroy(); // Clean up the editor instance when the component is destroyed
            });
        }
    });

    beforeNavigate(({cancel})=>{
        if (isEditing) {
            window.alert("You have unsaved changes. Please save or cancel before navigating away.");
            cancel();
        }
    })

</script>

<tr>
    <th scope="row">{displayName}</th>
    <td class="position-relative" style="width: 80%;">

        <div id="{rowName}{isEditable ? "-editable" : ""}"></div>

        {#if isEditing}

        <div class="position-relative">
            <div class="d-flex justify-content-end">
                <button type="button" class="btn btn-sm btn-secondary ms-2" style="margin-top: 150px;" onclick={()=>resetAction()}>Reset</button>
                <button type="button" class="btn btn-sm btn-secondary ms-2" style="margin-top: 150px;" onclick={()=>cancelAction()}>Cancel</button>
                <button type="button" class="btn btn-sm btn-primary ms-2" style="margin-top: 150px;" onclick={()=>doneAction()}>Done</button>
            </div>
        </div>

        {:else if isEditable && !$concurrentEditLock}
        <div>
            <button type="button" class="btn btn-sm btn-secondary position-absolute top-50 end-0 mx-3 translate-middle-y opacity-75 z-3" onclick={() => editButtonhandler()}>Edit</button>
        </div>
        {/if}
    </td>
</tr>