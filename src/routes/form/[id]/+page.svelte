<script>
    import "../../global.css"; // Import global CSS
    import { isAdmin } from "../../stores";
    import { isEditMode } from "../../stores";
    import { onDestroy } from "svelte";
    import { isCreateMode } from "../../stores";
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

    import { editedJSON } from "../../stores";
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
    return !$editedJSON.formData.some((editedForm) => {
        console.log(editedForm.id, entryData.id);
        return editedForm.id === entryData.id;
    });
    }

</script>


<div class="m-2 {adminlayout ? 'w-50' : 'w-100'}" style="height: calc(100vh - 105px); overflow-y: scroll">

    {#if !entryData && $isCreateMode}

        <div class="d-flex justify-content-center align-items-center" style="height: 100%;">
        <div style="border: 2px solid #333; border-radius: 8px; padding: 2rem;">
            <h1>New Form Entry</h1>
        </div>
    </div>

    {:else if !entryData && !$isCreateMode}

    <h1>404 Page Not Found</h1>

    {:else}
    <table class="table table-striped table-bordered" style="width: 100%;">
        <tbody>

        <DataRow datatype={"formData"} rowName={"form_name"} displayName={"Form Name"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"formData"} rowName={"form_code"} displayName={"Form Code"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"formData"} rowName={"remark"} displayName={"Remark"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"formData"} rowName={"form_link"} displayName={"Form Link"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"formData"} rowName={"lab_and_category"} displayName={"Laboratory"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"formData"} rowName={"last_updated"} displayName={"Last Updated"} isEditable={false} entryData={entryData}/>

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
                <DataRow datatype={"formData"} rowName={"form_name"} displayName={"Form Name"} isEditable={true} entryData={entryData}/>
                <DataRow datatype={"formData"} rowName={"form_code"} displayName={"Form Code"} isEditable={true} entryData={entryData}/>
                <DataRow datatype={"formData"} rowName={"remark"} displayName={"Remark"} isEditable={true} entryData={entryData}/>
                <DataRow datatype={"formData"} rowName={"form_link"} displayName={"Form Link"} isEditable={true} entryData={entryData}/>
                <DataRow datatype={"formData"} rowName={"lab_and_category"} displayName={"Laboratory"} isEditable={true} entryData={entryData}/>
                <DataRow datatype={"formData"} rowName={"last_updated"} displayName={"Last Updated"} isEditable={true} entryData={entryData}/>
            </tbody>
        </table>
    </div>
    {/if}
</div>
{/if}