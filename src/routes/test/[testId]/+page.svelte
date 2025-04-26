<script>
    import "../../global.css"; // Import global CSS
    import { isAdmin } from "../../stores";
    import { isEditMode } from "../../stores";
    import { onDestroy } from "svelte";
    import { editedTestData } from "../../stores";
    import Header from '@editorjs/header'; // Header can still be imported normally
    import { readonly } from "svelte/store";
    

    let { data } = $props();

    let adminlayout = $state(false);
    let editModeLayout = $state(false);
    let editingData = $state('');
    let editor = null;

    let thisTestEdit = $editedTestData.find(editedTest => editedTest.id === data.test.id);

    editedTestData.subscribe((editedTestData) => {
        thisTestEdit = editedTestData.find(editedTest => editedTest.id === data.test.id);
    });

    const unsubscribeIsAdmin = isAdmin.subscribe((isAdmin) => {
        console.log('Admin mode activated');
        if (isAdmin) {
            adminlayout = true;
        }
    });

    const unsubscribeIsEditMode = isEditMode.subscribe((isEditMode) => {
        if (isEditMode) {
            editModeLayout = true;
        }
    });

    onDestroy(() => {
        unsubscribeIsAdmin();
        unsubscribeIsEditMode();
        if (editor) {
            editor.destroy();
        }
    });

    function setEditMode() {
        isEditMode.set(true);
    }

    async function initializeEditor(target, data) {
        if (editor) {
            editor.readonly.toggle()
            editor = null;
        }

        let holder = document.getElementById(target);
        if (holder) {
            editingData = target;
        }

        // Dynamically import EditorJS to ensure it is only loaded in the browser
         const { default: EditorJS } = await import('@editorjs/editorjs');

        editor = new EditorJS({
            holder: target,
            tools: {
                header: Header,
            },
            data: data,
            onReady: () => {
                console.log('Editor.js is ready to work!');
            },
            onChange: () => {
                console.log('Now I know that Editor\'s content changed!');
            }
        });
    }

    function doneAction() {
        editor.save().then((outputData) => {
            let editedTestData_copy = $editedTestData;
            editedTestData_copy.map(editedTest => {
                if (editedTest.id === data.test.id) {
                    editedTest.full_name = outputData;
                    editedTestData.set(editedTestData_copy);
                    console.log(editedTestData_copy);
                }
            });
            editor.readOnly.toggle()
            editingData = '';

        }).catch((error) => {
            console.log('Saving failed: ', error);
        });
    }



</script>


<div class="m-2 {adminlayout ? 'w-50' : 'w-100'}">
    <table class="table table-striped table-bordered" style="width: 100%;">
        <tbody>
        <tr>
            <th scope="row">Alert/Reminder</th>
            <td class="" style="width: 80%;">
                {#if data.test.alert.includes("ICE")}
                <span class="badge rounded-pill text-bg-primary">On-Ice transport</span>
                {/if}

                {#if data.test.alert.includes("BOOK")}
                <span class="badge rounded-pill text-bg-info">Advance Booking/Consultation</span>
                {/if}

                {#if data.test.alert.includes("CONTAINER")}
                <span class="badge rounded-pill text-bg-warning">Special container/collection</span>
                {/if}

                {#if data.test.alert.includes("URGENT")}
                <span class="badge rounded-pill text-bg-danger">Send to lab immediately</span>
                {/if}

                {#if data.test.alert.includes("FORM")}
                <span class="badge rounded-pill text-bg-secondary">Send with request form</span>
                {/if}

                {#if data.test.alert.includes("TIME")}
                <span class="badge rounded-pill text-bg-warning">Fresh specimen needed. Accept only in specific time period.</span>
                {/if}
            </td>
        </tr>
        <tr>
            <th scope="row">Full Test Name</th>
            <td class="" style="width: 80%;">{data.test.full_name}</td>
        </tr>
        <tr>
            <th scope="row">GCRS name</th>
            <td class="width: 80%;">{data.test.GCRS_name}</td>
        </tr>
        <tr>
            <th scope="row">Label name</th>
            <td class="width: 80%;">{data.test.label_name}</td>
        </tr>
        <tr>
            <th scope="row">Form</th>
            <td class="width: 80%;">{data.test.form}</td>
        <tr>
            <th scope="row">Requirement</th>
            <td class="width: 80%;">{data.test.requirement}</td>
        </tr>
        <tr>
            <th scope="row">Container</th>
            <td class="width: 80%;">
                <div class="card bg-primary-subtle" style="width: 18rem;">
                    <div class="card-body">
                      <p class="card-text">{data.test.container}</p>
                    </div>
                    <!-- <img src="/clot_blood.jfif" class="card-img-bottom p-2" alt="..."> -->
                  </div>
            </td>
        </tr>
        <tr>
            <th scope="row">Synonyms</th>
            <td class="width: 80%;">{data.test.synonyms}</td>
        </tr>
        <tr>
            <th scope="row">Indication</th>
            <td class="width: 80%;">{data.test.indication}</td>
        </tr>
        <tr>
            <th scope="row">Turn-around Time</th>
            <td class="width: 80%;">{data.test.turn_around_time}</td>
        </tbody>
    </table>
</div>

{#if adminlayout}
<div class="w-50">
    {#if !editModeLayout}
<div class="d-flex justify-content-center align-items-center" style="height: 100%;">
    <button type="button" onclick={setEditMode} class="btn btn-primary">Start new edit</button>
</div>
    {:else}
    <div class="m-2">
        <table class="table table-striped table-bordered" style="width: 100%;">
            <tbody>
            <tr>
                <th scope="row">Alert/Reminder</th>
                <td class="" style="width: 80%;">
                    {#if data.test.alert.includes("ICE")}
                    <span class="badge rounded-pill text-bg-primary">On-Ice transport</span>
                    {/if}
    
                    {#if data.test.alert.includes("BOOK")}
                    <span class="badge rounded-pill text-bg-info">Advance Booking/Consultation</span>
                    {/if}
    
                    {#if data.test.alert.includes("CONTAINER")}
                    <span class="badge rounded-pill text-bg-warning">Special container/collection</span>
                    {/if}
    
                    {#if data.test.alert.includes("URGENT")}
                    <span class="badge rounded-pill text-bg-danger">Send to lab immediately</span>
                    {/if}
    
                    {#if data.test.alert.includes("FORM")}
                    <span class="badge rounded-pill text-bg-secondary">Send with request form</span>
                    {/if}
    
                    {#if data.test.alert.includes("TIME")}
                    <span class="badge rounded-pill text-bg-warning">Fresh specimen needed. Accept only in specific time period.</span>
                    {/if}
                </td>
            </tr>
            <tr>

                <script>
                    const EditedfullTestNameRender = new EditorJS({
                        holder: 'fullTestNameEditor',

                        readOnly: false,
                        data: thisTestEdit.full_name,
                        }
                    );
                </script>

                <th scope="row">Full Test Name</th>
                <td class="" style="width: 80%;">

                    <div id="fullTestNameEditor"></div>
                    {#if editingData == 'fullTestName'}

                    <div class="position-relative">
                        <div class="d-flex justify-content-end">
                            <button type="button" class="btn btn-sm btn-secondary ms-2 m-1">Cancel</button>
                            <button type="button" class="btn btn-sm btn-primary m-1" onclick={()=>doneAction()}>Done</button>
                        </div>
                    </div>


                    {:else}

                    <div class="position-relative">
                        {data.test.full_name}
                        <button type="button" class="btn btn-sm btn-secondary position-absolute top-0 end-0 opacity-75" onclick={() => initializeEditor('fullTestName', null)}>Edit</button>
                    </div>


                    {/if}
                </td>
            </tr>
            <tr>
                <th scope="row">GCRS name</th>
                <td class="width: 80%;">{data.test.GCRS_name}</td>
            </tr>
            <tr>
                <th scope="row">Label name</th>
                <td class="width: 80%;">{data.test.label_name}</td>
            </tr>
            <tr>
                <th scope="row">Form</th>
                <td class="width: 80%;">{data.test.form}</td>
            <tr>
                <th scope="row">Requirement</th>
                <td class="width: 80%;">{data.test.requirement}</td>
            </tr>
            <tr>
                <th scope="row">Container</th>
                <td class="width: 80%;">
                    <div class="card bg-primary-subtle" style="width: 18rem;">
                        <div class="card-body">
                          <p class="card-text">{data.test.container}</p>
                        </div>
                        <!-- <img src="/clot_blood.jfif" class="card-img-bottom p-2" alt="..."> -->
                      </div>
                </td>
            </tr>
            <tr>
                <th scope="row">Synonyms</th>
                <td class="width: 80%;">{data.test.synonyms}</td>
            </tr>
            <tr>
                <th scope="row">Indication</th>
                <td class="width: 80%;">{data.test.indication}</td>
            </tr>
            <tr>
                <th scope="row">Turn-around Time</th>
                <td class="width: 80%;">{data.test.turn_around_time}</td>
            </tbody>
        </table>
    </div>
    {/if}
</div>
{/if}