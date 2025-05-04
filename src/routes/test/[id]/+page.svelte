<script>
    import "../../global.css"; // Import global CSS
    import { isAdmin } from "../../stores";
    import { isEditMode } from "../../stores";
    import { onDestroy } from "svelte";
    import DataRow from "$lib/DataRow.svelte";


    let { data } = $props();

    let entryData = $derived(data.entryData);

    let adminlayout = $state(false);
    let editModeLayout = $state(false);

    const unsubscribeIsAdmin = isAdmin.subscribe((isAdmin) => {
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
    });

    function setEditMode() {
        isEditMode.set(true);
    }
</script>

<div class="m-2 {adminlayout ? 'w-50' : 'w-100'}" style="height: calc(100vh - 105px); overflow-y: scroll">
    <table class="table table-striped table-bordered" style="width: 100%;">
        <tbody>

        <DataRow datatype={"testData"} rowName={"alert"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"testData"} rowName={"full_name"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"testData"} rowName={"GCRS_name"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"testData"} rowName={"label_name"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"testData"} rowName={"form"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"testData"} rowName={"requirement"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"testData"} rowName={"container"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"testData"} rowName={"synonyms"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"testData"} rowName={"indication"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"testData"} rowName={"turn_around_time"} isEditable={false} entryData={entryData}/>
        </tbody>
    </table>
</div>

{#if adminlayout}
<div class="w-50" style="height: calc(100vh - 105px); overflow-y: scroll">
    {#if !editModeLayout}
<div class="d-flex justify-content-center align-items-center" style="height: 100%;">
    <button type="button" onclick={setEditMode} class="btn btn-primary">Start new edit</button>
</div>
    {:else}
    <div class="m-2">
        <table class="table table-striped table-bordered" style="width: 100%;">
            <tbody>
            <DataRow datatype={"testData"} rowName={"alert"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"full_name"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"GCRS_name"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"label_name"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"form"} isEditable={true} entryData={entryData}/>
            

            <!-- <tr>
                <th scope="row">Form</th>
                <td class="width: 80%;">{entryData.form}</td>
            </tr> -->

            <DataRow datatype={"testData"} rowName={"requirement"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"container"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"synonyms"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"indication"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"turn_around_time"} isEditable={true} entryData={entryData}/>
            </tbody>
        </table>
    </div>
    {/if}
</div>
{/if}