<script>
    import "../../global.css"; // Import global CSS
    import { isAdmin } from "../../stores";
    import { isLabStaffMode } from "../../stores";
    import { isEditMode } from "../../stores";
    import { isCreateMode } from "../../stores";
    import { onDestroy } from "svelte";
    import DataRow from "$lib/DataRow.svelte";
    import { editedJSON } from "../../stores";


    let { data } = $props();

    let entryData = $derived(data.entryData);

    let adminlayout = $state(false);
    let LabStaffLayout = $state(false);
    let editModeLayout = $state(false);

    const unsubscribeIsAdmin = isAdmin.subscribe((isAdmin) => {
        if (isAdmin) {
            adminlayout = true;
        }
    });

    const unsubscribeIsLabStaffMode = isLabStaffMode.subscribe((isLabStaffMode) => {
        if (isLabStaffMode) {
            LabStaffLayout = true;
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

    function importJSONHandler(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                editedJSON.set(imported);
                setEditMode();
                alert("Imported successfully!");
            } catch (err) {
                alert("Invalid JSON file.");
            }
        };
        reader.readAsText(file);
    }

    function checkRemoved(){
        return !$editedJSON.testData.some((editedTest) => {
            console.log(editedTest.id, entryData.id);
            return editedTest.id === entryData.id;
        });
    }
    
</script>

<div class="m-2 {adminlayout ? 'w-50' : 'w-100'}" style="height: calc(100vh - 105px); overflow-y: scroll">
    {#if !entryData && $isCreateMode}

    <div class="d-flex justify-content-center align-items-center" style="height: 100%;">
        <div style="border: 2px solid #333; border-radius: 8px; padding: 2rem;">
            <h1>New Test Entry</h1>
        </div>
    </div>

    {:else if !entryData && !$isCreateMode}

    <h1>404 Page Not Found</h1>

    {:else}

    <table class="table table-striped table-bordered" style="width: 100%;">
        <tbody>
        <DataRow datatype={"testData"} rowName={"alert"} displayName={"Alert"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"testData"} rowName={"full_name"} displayName={"Full Name"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"testData"} rowName={"GCRS_name"} displayName={"CMS Name"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"testData"} rowName={"label_name"} displayName={"Label Name"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"testData"} rowName={"requirement"} displayName={"Requirement"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"testData"} rowName={"specimen_type"} displayName={"Specimen Type"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"testData"} rowName={"container"} displayName={"Container"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"testData"} rowName={"form"} displayName={"Form"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"testData"} rowName={"synonyms"} displayName={"Synonyms"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"testData"} rowName={"lab_and_category"} displayName={"Laboratory"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"testData"} rowName={"indication"} displayName={"Indications"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"testData"} rowName={"turn_around_time"} displayName={"Turnaround Time"} isEditable={false} entryData={entryData}/>
        {#if LabStaffLayout || adminlayout}
        <DataRow datatype={"testData"} rowName={"lab_handling"} displayName={"Lab Handling"} isEditable={false} entryData={entryData}/>
        {/if}
        </tbody>
    </table>

    {/if}
</div>

{#if adminlayout}
<div class="w-50" style="height: calc(100vh - 105px); overflow-y: scroll">
    {#if !entryData && !$isCreateMode}
    
    <h1>404 Page Not Found</h1>

    {:else if !editModeLayout}

    <div class="d-flex justify-content-center align-items-center" style="height: 100%;">
        <button type="button" onclick={setEditMode} class="btn btn-primary">Start new edit</button>
        <button type="button" class="btn btn-outline-secondary ms-2" onclick={() => document.getElementById('importJSONInput').click()}>Import from save</button>
        <input id="importJSONInput" type="file" accept="application/json" style="display: none;" onchange={importJSONHandler} />
    </div>

    {:else if checkRemoved()}

    <h1>This entry will be removed.</h1>

    {:else}
    <div class="m-2">
        <table class="table table-striped table-bordered" style="width: 100%;">
            <tbody>
            <DataRow datatype={"testData"} rowName={"alert"} displayName={"Alert"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"full_name"} displayName={"Full Name"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"GCRS_name"} displayName={"CMS Name"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"label_name"} displayName={"Label Name"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"requirement"} displayName={"Requirement"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"specimen_type"} displayName={"Specimen Type"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"container"} displayName={"Container"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"form"} displayName={"Form"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"synonyms"} displayName={"Synonyms"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"lab_and_category"} displayName={"Laboratory"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"indication"} displayName={"Indications"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"turn_around_time"} displayName={"Turnaround Time"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"test_handling"} displayName={"Lab Handling"} isEditable={true} entryData={entryData}/>
            </tbody>
        </table>
    </div>
    {/if}
</div>
{/if}