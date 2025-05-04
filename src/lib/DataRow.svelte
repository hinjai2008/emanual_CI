<script>
    import Header from '@editorjs/header'; // Header can still be imported normally
    import Paragraph from '@editorjs/paragraph';
    import AlertTag from '$lib/alert-tag/alert-tag.js';
    
    import { onDestroy, onMount } from 'svelte';
    import { editedJSON } from '../routes/stores';
    import { page } from "$app/state"; // Import the $page store
    import "../routes/global.css"
    import SampleContainerTool from '$lib/sample-container-tool/sample-container-tool';
    import SynonymTool from '$lib/synonym/synonym';
    import FormLinkTool from './form-link/form-link';
    import TestFormTool from './test-form/test-form';


    let { datatype, rowName, isEditable, entryData } = $props();
    let isEditing = $state(false);

    let editor = null; // Define editor at the top level

    let thisEntryEdit = $editedJSON[datatype].find(editedEntry => editedEntry.id.toString() === page.params.id);


    editedJSON.subscribe((value) => {
        thisEntryEdit = value[datatype].find(editedEntry => editedEntry.id.toString() === page.params.id);
    });

    onMount(async () => {

        initializeEditor(); // Initialize the editor after the component is mounted

        });


    async function initializeEditor() {

        let loadedData = entryData[rowName];

        const holder = isEditable ? rowName+"-editable" : rowName;

        if (isEditable) {
            loadedData = thisEntryEdit[rowName];
        }

        let tools = {
            paragraph: Paragraph,
            header: Header,
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

        if (rowName === "container") {
            tools = {
                container: {
                    class: SampleContainerTool,
                    config: {
                        
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
        isEditing = true;
        editor.readOnly.toggle();
    }


    function cancelAction() {
        editor.destroy(); // Destroy the editor instance
        isEditing = false; // Reset the editing state
        initializeEditor(); // Reinitialize the editor with the original data (editingData)
    }


    function doneAction() {
        editor.save().then((outputData) => {
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
        }).catch((error) => {
            console.log('Saving failed: ', error);
        });
    }


    $effect(() => {
        // This effect will run whenever the page changes
        let currentPage = page.params.id; // Get the current page ID from the URL
        if (editor) {
            editor.destroy(); // Clean up the previous editor instance
            thisEntryEdit = $editedJSON[datatype].find(editedEntry => editedEntry.id.toString() === page.params.id);
            initializeEditor()
        }

    });


    onDestroy(() => {
        if (editor) {
            editor.destroy(); // Clean up the editor instance when the component is destroyed
        }
    });
</script>

<tr>
    <th scope="row">{rowName}</th>
    <td class="position-relative" style="width: 80%;">

        <div id="{rowName}{isEditable ? "-editable" : ""}"></div>

        {#if isEditing}

        <div class="position-relative">
            <div class="d-flex justify-content-end">
                <button type="button" class="btn btn-sm btn-secondary ms-2 m-1" onclick={()=>cancelAction()}>Cancel</button>
                <button type="button" class="btn btn-sm btn-primary m-1" onclick={()=>doneAction()}>Done</button>
            </div>
        </div>

        {:else if isEditable}
        <div>
            <button type="button" class="btn btn-sm btn-secondary position-absolute top-50 end-0 mx-3 translate-middle-y opacity-75 z-3" onclick={() => editButtonhandler()}>Edit</button>
        </div>
        {/if}
    </td>
</tr>