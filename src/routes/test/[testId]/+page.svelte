<script>
    let {data} = $props();
</script>


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
                <span class="badge rounded-pill text-bg-warning">Accept only in specific time period</span>
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