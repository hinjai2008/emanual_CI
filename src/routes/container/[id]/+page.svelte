<script>
    import "../../global.css"; // Import global CSS
    import { isAdmin, isCreateMode } from "../../stores";
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
    {#if !entryData && $isCreateMode}

    <div class="d-flex justify-content-center align-items-center" style="height: 100%;">
    <div style="border: 2px solid #333; border-radius: 8px; padding: 2rem;">
        <h1>New Container Entry</h1>
    </div>
    </div>

    {:else if !entryData && !$isCreateMode}

    <h1>404 Page Not Found</h1>

    {:else}
    
    <table class="table table-striped table-bordered" style="width: 100%;">
        <tbody>

        <DataRow datatype={"containerData"} rowName={"name"} displayName={"Container Name"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"containerData"} rowName={"code"} displayName={"Container Code"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"containerData"} rowName={"remark"} displayName={"Remark"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"containerData"} rowName={"imageSrc"} displayName={"Container Image"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"containerData"} rowName={"synonyms"} displayName={"Synonyms"} isEditable={false} entryData={entryData}/>
        <DataRow datatype={"containerData"} rowName={"last_modified"} displayName={"Last Modified"} isEditable={false} entryData={entryData}/>

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
</div>

    {:else}
    <div class="m-2">
        <table class="table table-striped table-bordered" style="width: 100%;">
            <tbody>
        <DataRow datatype={"containerData"} rowName={"name"} displayName={"Container Name"} isEditable={true} entryData={entryData}/>
        <DataRow datatype={"containerData"} rowName={"code"} displayName={"Container Code"} isEditable={true} entryData={entryData}/>
        <DataRow datatype={"containerData"} rowName={"remark"} displayName={"Remark"} isEditable={true} entryData={entryData}/>
        <DataRow datatype={"containerData"} rowName={"imageSrc"} displayName={"Container Image"} isEditable={true} entryData={entryData}/>
        <DataRow datatype={"containerData"} rowName={"synonyms"} displayName={"Synonyms"} isEditable={true} entryData={entryData}/>
        <DataRow datatype={"containerData"} rowName={"last_modified"} displayName={"Last Modified"} isEditable={true} entryData={entryData}/>
            </tbody>
        </table>
    </div>
    {/if}
</div>
{/if}