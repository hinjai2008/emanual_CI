<script>
    import Header from '@editorjs/header'; // Header can still be imported normally
    import Paragraph from '@editorjs/paragraph';
    import AlertTag from '$lib/alert-tag/alert-tag.js';
    
    import { onDestroy, onMount } from 'svelte';
    import { editedJSON } from '../../stores';
    import { page } from "$app/state"; // Import the $page store
    import "../../global.css"
    import SampleContainerTool from '$lib/sample-container-tool/sample-container-tool';
    import SynonymTool from '$lib/synonym/synonym';


    let { rowName, isEditable, data } = $props();
    let isEditing = $state(false);

    let editor = null; // Define editor at the top level

    let thisTestEdit = $editedJSON["testData"].find(editedTest => editedTest.id.toString() === page.params.testId);

    editedJSON.subscribe((value) => {
        thisTestEdit = value["testData"].find(editedTest => editedTest.id.toString() === page.params.testId);
    });

    onMount(async () => {

        initializeEditor(); // Initialize the editor after the component is mounted

        });


    async function initializeEditor() {

        let loadedData = data.test[rowName];

        const holder = isEditable ? rowName+"-editable" : rowName;

        if (isEditable) {
            loadedData = thisTestEdit[rowName];
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

    function doneAction() {
        editor.save().then((outputData) => {
            let editedJSON_copy = $editedJSON;
            editedJSON_copy["testData"].map((editedTest) => {
                if (editedTest.id.toString() === page.params.testId) {
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
        const testId = page.params.testId;
        if (editor) {
            editor.destroy(); // Clean up the previous editor instance
            thisTestEdit = $editedJSON["testData"].find(editedTest => editedTest.id.toString() === page.params.testId);
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
                <button type="button" class="btn btn-sm btn-secondary ms-2 m-1">Cancel</button>
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