<script>
    import Header from '@editorjs/header'; // Header can still be imported normally
    import Paragraph from '@editorjs/paragraph';
    import { onDestroy, onMount } from 'svelte';
    import { editedTestData } from '../../stores';
    import { page } from "$app/state"; // Import the $page store
    import "../../global.css"


    let { rowName, isEditable, data } = $props();
    let isEditing = $state(false);

    let editor = null; // Define editor at the top level

    let thisTestEdit = $editedTestData.find(editedTest => editedTest.id.toString() === page.params.testId);

    editedTestData.subscribe((value) => {
        thisTestEdit = value.find(editedTest => editedTest.id.toString() === page.params.testId);
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

        // Dynamically import EditorJS to ensure it is only loaded in the browser
        const { default: EditorJS } = await import('@editorjs/editorjs');
        editor = new EditorJS({
            holder: holder,
            autofocus: false,
            readOnly: true,
            inlineToolbar: true,
            tools: {
                paragraph: Paragraph,
                header: Header,
            },
            data: loadedData,
        });
    }

    function editButtonhandler() {
        isEditing = true;
        editor.readOnly.toggle();
    }

    function doneAction() {
        editor.save().then((outputData) => {
            let editedTestData_copy = $editedTestData;
            editedTestData_copy.map((editedTest) => {
                if (editedTest.id.toString() === page.params.testId) {
                    editedTest[rowName] = outputData;
                    editedTestData.set(editedTestData_copy);
                    console.log(editedTestData_copy);
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
            thisTestEdit = $editedTestData.find(editedTest => editedTest.id.toString() === page.params.testId);
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
        {:else}
        
        {/if}
    </td>
</tr>