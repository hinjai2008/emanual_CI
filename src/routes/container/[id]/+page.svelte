<script>
    import "../../global.css"; // Import global CSS
    import { beginEditSession, isAdmin, isCreateMode } from "../../stores";
    import { isEditMode } from "../../stores";
    import { onDestroy } from "svelte";
    import DataRow from "$lib/DataRow.svelte";
    import { page } from "$app/state";


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

    async function setEditMode() {
        if (typeof $beginEditSession === 'function') {
            await $beginEditSession();
            return;
        }
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
    return !$editedJSON.containerData.some((editedContainer) => {
        console.log(editedContainer.id, entryData.id);
        return editedContainer.id === entryData.id;
    });
    }

    function checkNotExist(){
        const entryId = parseInt(page.params.id); // e.g., '123'

        return !entryData && $editedJSON.containerData.every((editedContainer) => {
            return editedContainer.id !== entryId;
        });


    }

    function existsInEditedJSON() {
        const entryId = parseInt(page.params.id); // e.g., '123'

        return $editedJSON.containerData.some((editedContainer) => {
            return editedContainer.id === entryId;
        });
    }

    function isHiddenEntry() {
        return entryData?.is_hidden === true;
    }


</script>


<div class="m-2 {adminlayout ? 'w-50' : 'w-100'}" style="height: calc(100vh - 105px); overflow-y: scroll">
    {#if isHiddenEntry() && !adminlayout}

    <h1>This entry is hidden.</h1>

    {:else if !entryData && ($isCreateMode || existsInEditedJSON())}

    <div class="d-flex justify-content-center align-items-center" style="height: 100%;">
    <div style="border: 2px solid #333; border-radius: 8px; padding: 2rem;">
        <h1>New Container Entry</h1>
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

        <DataRow datatype={"containerData"} rowName={"name"} displayName={"Container Name"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"containerData"} rowName={"code"} displayName={"Container Code"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"containerData"} rowName={"remark"} displayName={"Remark"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"containerData"} rowName={"imageSrc"} displayName={"Container Image"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"containerData"} rowName={"synonyms"} displayName={"Synonyms"} isEditable={false} entryData={entryData}/>

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
        <DataRow datatype={"containerData"} rowName={"name"} displayName={"Container Name"} isEditable={true} entryData={entryData}/>
        <DataRow datatype={"containerData"} rowName={"code"} displayName={"Container Code"} isEditable={true} entryData={entryData}/>
        <DataRow datatype={"containerData"} rowName={"remark"} displayName={"Remark"} isEditable={true} entryData={entryData}/>
        <DataRow datatype={"containerData"} rowName={"imageSrc"} displayName={"Container Image"} isEditable={true} entryData={entryData}/>
        <DataRow datatype={"containerData"} rowName={"synonyms"} displayName={"Synonyms"} isEditable={true} entryData={entryData}/>
            </tbody>
        </table>
    </div>
    {/if}
</div>
{/if}