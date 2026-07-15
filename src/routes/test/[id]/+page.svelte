<script>
    import "../../global.css"; // Import global CSS
    import { isAdmin } from "../../stores";
    import { isStaff } from "../../stores";
    import { isEditMode } from "../../stores";
    import { isCreateMode } from "../../stores";
    import { onDestroy } from "svelte";
    import DataRow from "$lib/DataRow.svelte";
    import { beginEditSession, editedJSON, globalFunctions } from "../../stores";
    import { page } from "$app/state";


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

    const unsubscribeIsStaff = isStaff.subscribe((isStaff) => {
        if (isStaff) {
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

    async function setEditMode() {
        if (typeof $beginEditSession === 'function') {
            await $beginEditSession();
            return;
        }
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

    function checkNotExist(){
    const entryId = parseInt(page.params.id); // e.g., '123'

    return !entryData && $editedJSON.testData.every((editedTest) => {
        return editedTest.id !== entryId;
    });
    }

    function existsInEditedJSON() {
        const entryId = parseInt(page.params.id); // e.g., '123'
        return $editedJSON.testData.some((editedTest) => editedTest.id === entryId);
    }

    function isHiddenEntry() {
        return entryData?.is_hidden === true;
    }

    // Simple layout: reactive — reads from $editedJSON in admin mode so toggle reflects immediately
    let isSimpleLayout = $derived.by(() => {
        if (adminlayout) {
            const entryId = parseInt(page.params.id);
            const liveEntry = $editedJSON.testData.find(t => t.id === entryId);
            return liveEntry?.is_simple_layout === true;
        }
        return entryData?.is_simple_layout === true;
    });

    function toggleSimpleLayoutListener() {
        const entryId = parseInt(page.params.id);
        const currentEntry = $editedJSON.testData.find(t => t.id === entryId);
        if (!currentEntry) return;
        const currentValue = currentEntry.is_simple_layout === true;
        const newValue = !currentValue;
        editedJSON.update((draft) => {
            const target = draft.testData.find(t => t.id === entryId);
            if (target) {
                target.is_simple_layout = newValue;
            }
            return draft;
        });
        $globalFunctions.updateEditTrace?.('testData', entryId, currentEntry.refId || null, 'modify', 'is_simple_layout', currentValue, newValue);
    }

</script>

<div class="m-2 {adminlayout ? 'w-50' : 'w-100'}" style="height: calc(100vh - 105px); overflow-y: scroll">
    {#if isHiddenEntry() && !adminlayout}

    <h1>This entry is hidden.</h1>

    {:else if !entryData && ($isCreateMode || existsInEditedJSON())}

    <div class="d-flex justify-content-center align-items-center" style="height: 100%;">
        <div style="border: 2px solid #333; border-radius: 8px; padding: 2rem;">
            <h1>New Test Entry</h1>
            {#if existsInEditedJSON() && !$isCreateMode}
            <p class="mb-0">Imported from saved draft</p>
            {/if}
        </div>
    </div>

    {:else if !entryData && !$isCreateMode && !existsInEditedJSON()}

    <h1>404 Page Not Found</h1>

    {:else}

    <table class="table table-striped table-bordered" style="width: 100%;">
        <tbody>
        <DataRow datatype={"testData"} rowName={"alert"} displayName={"Alert"} isEditable={false} entryData={entryData}/>
        {#if adminlayout}
        <DataRow datatype={"testData"} rowName={"full_name"} displayName={"Full Name (To be removed)"} isEditable={false} entryData={entryData}/>
        {/if}
        <DataRow datatype={"testData"} rowName={"GCRS_name"} displayName={isSimpleLayout ? "Test Name" : "CMS Name"} isEditable={false} entryData={entryData}/>
        {#if !isSimpleLayout}
        <DataRow datatype={"testData"} rowName={"label_name"} displayName={"Label Name"} isEditable={false} entryData={entryData}/>
        {/if}
        <DataRow datatype={"testData"} rowName={"requirement"} displayName={"Special Requirement"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"testData"} rowName={"container"} displayName={"Container"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"testData"} rowName={"form"} displayName={"Form"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"testData"} rowName={"synonyms"} displayName={"Synonyms"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"testData"} rowName={"lab_and_category"} displayName={"Laboratory"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"testData"} rowName={"indication"} displayName={"Indications"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"testData"} rowName={"turn_around_time"} displayName={"Turnaround Time"} isEditable={false} entryData={entryData}/>
        {#if LabStaffLayout || adminlayout}
        <DataRow datatype={"testData"} rowName={"test_handling"} displayName={"Lab Handling"} isEditable={false} entryData={entryData}/>
        {/if}
        </tbody>
    </table>

    {/if}
</div>

{#if adminlayout}
<div class="w-50" style="height: calc(100vh - 105px); overflow-y: scroll">
    {#if (!entryData && !$isCreateMode && !existsInEditedJSON()) || checkNotExist()}
    
    <h1>404 Page Not Found</h1>

    {:else if !editModeLayout}

    <div class="d-flex justify-content-center align-items-center" style="height: 100%;">
        <button type="button" onclick={setEditMode} class="btn btn-primary">Start new edit</button>
        <button type="button" class="btn btn-outline-secondary ms-2" onclick={() => document.getElementById('importJSONInput').click()}>Import from save</button>
        <input id="importJSONInput" type="file" accept="application/json" style="display: none;" onchange={importJSONHandler} />
    </div>

    {:else if entryData && checkRemoved()}

    <h1>This entry will be removed.</h1>

    {:else}
    <div class="m-2">
        <table class="table table-striped table-bordered" style="width: 100%;">
            <tbody>
            <DataRow datatype={"testData"} rowName={"alert"} displayName={"Alert"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"full_name"} displayName={"Full Name (To be removed)"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"GCRS_name"} displayName={isSimpleLayout ? "Test Name (Simple Layout)" : "CMS Name"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"label_name"} displayName={isSimpleLayout ? "Label Name ⚠ hidden in Simple Layout" : "Label Name"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"requirement"} displayName={"Special Requirement"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"container"} displayName={"Container"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"form"} displayName={"Form"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"synonyms"} displayName={"Synonyms"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"lab_and_category"} displayName={"Laboratory"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"indication"} displayName={"Indications"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"turn_around_time"} displayName={"Turnaround Time"} isEditable={true} entryData={entryData}/>
            <DataRow datatype={"testData"} rowName={"test_handling"} displayName={"Lab Handling"} isEditable={true} entryData={entryData}/>
            </tbody>
        </table>
        <div class="d-flex align-items-center gap-2 mt-2 mb-3">
            <button type="button" onclick={toggleSimpleLayoutListener} class="btn btn-sm {isSimpleLayout ? 'btn-warning' : 'btn-outline-secondary'}">
                {isSimpleLayout ? '⚠ Simple Layout ON' : 'Simple Layout OFF'}
            </button>
            {#if isSimpleLayout}
            <span class="text-muted small">CMS Name field shown as "Test Name"; Label Name row hidden from public view.</span>
            {/if}
        </div>
    </div>
    {/if}
</div>
{/if}