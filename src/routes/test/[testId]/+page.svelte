<script>
    import "../../global.css"; // Import global CSS
    import { isAdmin } from "../../stores";
    import { isEditMode } from "../../stores";
    import { onDestroy } from "svelte";
    import DataRow from "./DataRow.svelte";

    let { data } = $props();

    let adminlayout = $state(false);
    let editModeLayout = $state(false);
    let editingData = $state('');
    let editor = null;


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
        if (editor) {
            editor.destroy();
        }
    });

    function setEditMode() {
        isEditMode.set(true);
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

        <DataRow rowName={"full_name"} isEditable={false} data={data}/>
        <DataRow rowName={"GCRS_name"} isEditable={false} data={data}/>
        <DataRow rowName={"label_name"} isEditable={false} data={data}/>

        <tr>
            <th scope="row">Form</th>
            <td class="width: 80%;">{data.test.form}</td>
        </tr>
        <DataRow rowName={"requirement"} isEditable={false} data={data}/>
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
        <DataRow rowName={"indication"} isEditable={false} data={data}/>
        <DataRow rowName={"turn_around_time"} isEditable={false} data={data}/>
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

            <DataRow rowName={"full_name"} isEditable={true} data={data}/>
            <DataRow rowName={"GCRS_name"} isEditable={true} data={data}/>
            <DataRow rowName={"label_name"} isEditable={true} data={data}/>
            

            <tr>
                <th scope="row">Form</th>
                <td class="width: 80%;">{data.test.form}</td>
            </tr>

            <DataRow rowName={"requirement"} isEditable={true} data={data}/>

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

            <DataRow rowName={"indication"} isEditable={true} data={data}/>

            <DataRow rowName={"turn_around_time"} isEditable={true} data={data}/>
            </tbody>
        </table>
    </div>
    {/if}
</div>
{/if}