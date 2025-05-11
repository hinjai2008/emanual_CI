<script>
  let { data, children } = $props();

  // let rawTestData = data.rawTestData;

  import { base } from '$app/paths';
  import { editedJSON } from './stores';
  import { isAdmin } from './stores';
  import { onMount } from "svelte";
 
  import lunr from 'lunr';
    import { tests } from './dataUtility';

  // Initialize search
  // const search = new JsSearch.Search('id');
  // search.addIndex(['full_name', 'blocks[0]', 'data', 'text']);
  // search.addIndex(['GCRS_name', 'blocks', 'data', 'text']);
  // search.addIndex(['label_name', 'blocks', 'data', 'text']);
  // search.addIndex(['synonyms', 'blocks', 'data', 'text']);
  // search.addDocuments(data.tests);

  // let searchInput = $state('');
  // let searchResults = $derived(search.search(searchInput));

  let indexData = $state({})

  const index_document = () => {
    indexData = {
      tests: data.tests.map((test) => {

        let result = {
          id: "test/" + test.id,
          full_name: "",
          GCRS_name: "",
          short_name: "",
          synonyms: "",
        }

        if (test.GCRS_name.blocks === undefined) {
          result.GCRS_name = "";
        } else {
          result.GCRS_name = test.GCRS_name.blocks[0].data.text;
        }
        if (test.label_name.blocks === undefined) {
          result.short_name = "";
        } else {
          result.short_name = test.label_name.blocks[0].data.text;
        }
        if (test.synonyms.blocks === undefined) {
          result.synonyms = "";
        } else {
          let synonymsList = test.synonyms.blocks[0].data.synonymList;
          
            
          result.synonyms = synonymsList.join(' ');

        }
        if (test.full_name.blocks === undefined) {
          console.log("A test entry is missing a full name");
          return
        } else {
          result.full_name = test.full_name.blocks[0].data.text;
        }

        return result
      }),


      forms: data.forms.map((form) => {

        let result = {
          id: "form/" + form.id,
          full_name: "",
          short_name: "",
          synonyms: "",
        }

        if (form.form_name.blocks === undefined) {
          console.log("A form entry is missing a full name");
          return
        } else {
          result.full_name = form.form_name.blocks[0].data.text;
        }
        if (form.form_code.blocks === undefined) {
          form.form_code.blocks[0].data.text = "";
        } else {
          result.short_name = form.form_code.blocks[0].data.text;
        }

        return result
      }),

      containers: data.containers.map((container) => {

        let result = {
          id: "container/" + container.id,
          full_name: "",
          short_name: "",
        }

        if (container.name.blocks === undefined) {
          console.log("A container entry is missing a full name");
          return
        } else {
          result.full_name = container.name.blocks[0].data.text;
        }
        if (container.code.blocks === undefined) {
          console.log("A container entry is missing self-defined code");
        } else {
          result.short_name = container.code.blocks[0].data.text;
        }
        if (container.synonyms.blocks === undefined) {
          result.synonyms = "";
        } else {
          let synonymsList = container.synonyms.blocks[0].data.synonymList;
          result.synonyms = synonymsList.join(' ');
        }

        return result
      })
    };
    return indexData.tests.concat(indexData.forms).concat(indexData.containers);
  };

  let idx = lunr(function () {
    this.field('full_name');
    this.field('GCRS_name');
    this.field('short_name');
    this.field('synonyms');
    this.ref('id');

    index_document().forEach(function (doc) {
      this.add(doc);
    }, this);

  });


  let searchInput = $state('');
  let searchResults = $derived(idx.search(searchInput));

  let searchResultsDetails = $derived.by(() => {
  
    return searchResults.map(result => {
      const resultType = result.ref.split('/')[0]; 
      const foundItem = indexData[resultType+"s"].find(item => item.id === result.ref);
      return {
        ...foundItem,
        score: result.score
      };
    });
  });


  async function checkadmin() {
    const encoder = new TextEncoder();
    const encodedSearchInput = encoder.encode(searchInput);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", encodedSearchInput);
    const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""); // convert bytes to hex string

    const encryptedAdminPw = "2ca5161d5fd55633223b61a03cc51c4ce7e32383b480f3eb37b4f122f24e4c23";

    if (hashHex === encryptedAdminPw) {
      isAdmin.set(true);
    }
  };

  function exportListener() {
        const blob = new Blob([JSON.stringify($editedJSON, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "editedJSON.json";
        a.click();
        URL.revokeObjectURL(url);
      }

  onMount(() => {
    const exportButton = document.getElementById("exportButton");
    if (exportButton) {
      // Ensure no duplicate listeners are added
      exportButton.addEventListener("click", exportListener);
    }
  });

  // Reactive statement to update the event listener when editedJSON changes
  $effect(() => {
    console.log(searchResults);
    const exportButton = document.getElementById("exportButton");
    if (exportButton) {


      // Ensure no duplicate listeners are added
      exportButton.removeEventListener("click", exportListener);
      exportButton.addEventListener("click", exportListener);
    }
  });

</script>

<!-- NavBar -->
<div class="container">
  <header class="d-flex flex-wrap justify-content-center py-3 mb-4 border-bottom">
    <a href="{base}/" class="d-flex align-items-center mb-3 mb-md-0 me-md-auto text-dark text-decoration-none">
      <svg class="bi me-2" width="40" height="32"><use xlink:href="#bootstrap"></use></svg>
      <span class="fs-4">e-Lab manual</span>
    </a>

    <ul class="nav nav-pills">
      <li class="nav-item"><a href="{base}/" class="nav-link active" aria-current="page">Home</a></li>
      <li class="nav-item"><button id="exportButton" class="nav-link">Export changes</button></li>
    </ul>
  </header>
</div>

<!-- Sidebar and Content Wrapper -->
<div class="d-flex flex-row">
  <!-- Sidebar -->
  <div class="mt-2 d-flex flex-column align-items-stretch bg-white" style="width: 500px; border-right: 1px solid #eaeaea;">
    <!-- Search -->
    <div class="input-group" style="width: 97%;">
      <img class="input-group-text" src="{base}/search.svg" id="basic-addon1" style="width: 10%;" alt="search">
      <input bind:value={searchInput} onkeydown={checkadmin} id="search_sideBar" type="text" class="form-control" placeholder="Type in tests / forms to search" tabindex="0">
    </div>

    <!-- Search Results -->
    <div class="list-group list-group-flush border-bottom" style="height: calc(100vh - 143px); overflow-y: scroll">
      {#if searchInput.length === 0}
        <!-- Display all tests when no search input -->
        {#each data.tests as test}
          <a
            href="{base}/test/{test.id}"
            class="list-group-item list-group-item-action py-3 lh-tight"
          >
            <div class="d-flex w-100 align-items-center justify-content-between">
              <strong class="mb-1">{test.full_name.blocks[0].data.text}</strong>
            </div>
            <div class="col-10 mb-1 small">{test.label_name.blocks[0].data.text}</div>
          </a>
        {/each}
        
        <!-- Display all forms when no search input -->
        {#each data.forms as form}
          <a
            href="{base}/form/{form.id}"
            class="list-group-item list-group-item-action py-3 lh-tight"
          >
            <div class="d-flex w-100 align-items-center justify-content-between">
              <strong class="mb-1">{form.form_name.blocks[0].data.text}</strong>
            </div>
            <div class="col-10 mb-1 small">{form.form_code.blocks[0].data.text}</div>
          </a>
        {/each}

        {#each data.containers as container}
          <a
            href="{base}/container/{container.id}"
            class="list-group-item list-group-item-action py-3 lh-tight"
          >
            <div class="d-flex w-100 align-items-center justify-content-between">
              <strong class="mb-1">{container.name.blocks[0].data.text}</strong>
            </div>
            <div class="col-10 mb-1 small">{container.code.blocks[0].data.text}</div>
          </a>
        {/each}

      {:else}
        <!-- Display search results -->
        {#each searchResultsDetails as resultDetails}

          <a
            href="{base}/{resultDetails.id}"
            class="list-group-item list-group-item-action py-3 lh-tight"
          >
            <div class="d-flex w-100 align-items-center justify-content-between">
              <strong class="mb-1">{resultDetails.full_name}</strong>
            </div>
            <div class="col-10 mb-1 small">{resultDetails.short_name}</div>
          </a>
          
        {/each}
      {/if}
    </div>
  </div>

  <!-- Render Children -->
  {@render children()}
</div>