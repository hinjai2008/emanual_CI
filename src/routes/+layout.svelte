<script>
  let { data, children } = $props();

  let rawTestData = data.rawTestData;

  import { base } from '$app/paths';
  import {isAdmin} from './stores';
 
  import * as JsSearch from 'js-search';

  // Initialize search
  const search = new JsSearch.Search('id');
  search.addIndex('full_name');
  search.addIndex('GCRS_name');
  search.addIndex('label_name');
  search.addIndex('synonyms');
  search.addDocuments(data.tests);

  let searchInput = $state('');
  let searchResults = $derived(search.search(searchInput));


  async function checkadmin() {

    const encoder = new TextEncoder();
    const encodedSearchInput = encoder.encode(searchInput);
    const hashBuffer= await window.crypto.subtle.digest("SHA-256", encodedSearchInput);
    const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
    const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(""); // convert bytes to hex string

    const encryptedAdminPw = "2ca5161d5fd55633223b61a03cc51c4ce7e32383b480f3eb37b4f122f24e4c23";

    if (hashHex === encryptedAdminPw) {
      isAdmin.set(true);
    }
  };

  // Function to download rawTestData as JSON
  function downloadRawTestData() {
    const blob = new Blob([JSON.stringify(rawTestData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rawTestData.json';
    a.click();
    URL.revokeObjectURL(url);
  }

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
      <li class="nav-item"><button class="nav-link" onclick={downloadRawTestData}>Download</button></li>
      <!-- <li class="nav-item"><a href="#" class="nav-link">Features</a></li>
      <li class="nav-item"><a href="#" class="nav-link">Pricing</a></li>
      <li class="nav-item"><a href="#" class="nav-link">FAQs</a></li>
      <li class="nav-item"><a href="#" class="nav-link">About</a></li> -->
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
              <strong class="mb-1">{test.full_name}</strong>
            </div>
            <div class="col-10 mb-1 small">{test.label_name}</div>
          </a>
        {/each}
      {:else}
        <!-- Display search results -->
        {#each searchResults as result}
          <a
            href="{base}/test/{result.id}"
            class="list-group-item list-group-item-action py-3 lh-tight"
          >
            <div class="d-flex w-100 align-items-center justify-content-between">
              <strong class="mb-1">{result.full_name}</strong>
            </div>
            <div class="col-10 mb-1 small">{result.label_name}</div>
          </a>
        {/each}
      {/if}
    </div>
  </div>

  <!-- Render Children -->
  {@render children()}
</div>