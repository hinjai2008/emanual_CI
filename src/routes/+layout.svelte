<script>
let {data, children} = $props();

import * as JsSearch from 'js-search';



var search = new JsSearch.Search('id');

search.addIndex('full_name');
search.addIndex('GCRS_name');
search.addIndex('label_name');
search.addIndex('synonyms');

search.addDocuments(data.tests);

let searchInput = $state('');

let searchResults = $derived(search.search((searchInput)))

</script>

<!-- NavBar -->
    <div class="container">
      <header class="d-flex flex-wrap justify-content-center py-3 mb-4 border-bottom">
        <a href="/" class="d-flex align-items-center mb-3 mb-md-0 me-md-auto text-dark text-decoration-none">
          <svg class="bi me-2" width="40" height="32"><use xlink:href="#bootstrap"></use></svg>
          <span class="fs-4">e-Lab manual</span>
        </a>
  
        <ul class="nav nav-pills">
          <li class="nav-item"><a href="/" class="nav-link active" aria-current="page">Home</a></li>
          <!-- <li class="nav-item"><a href="#" class="nav-link">Features</a></li>
          <li class="nav-item"><a href="#" class="nav-link">Pricing</a></li>
          <li class="nav-item"><a href="#" class="nav-link">FAQs</a></li>
          <li class="nav-item"><a href="#" class="nav-link">About</a></li> -->
        </ul>
      </header>
    </div>
    
    <!-- sidebar and content wraper -->
    <div class="d-flex flex-row">

    <!-- sidebar -->
    <div class="mt-2 d-flex flex-column align-items-stretch flex-shrink-0 bg-white" style="width: 500px; border-right: 1px solid #eaeaea;">

      <!-- search -->
      <div class="input-group" style="width: 97%;">
        <img class="input-group-text" src="search.svg" id="basic-addon1" style="width: 10%;" alt="search">
        <input bind:value={searchInput} id="search_sideBar" type="text" class="form-control" placeholder="Type in tests / forms to search" tabindex="0">
      </div>

      <!-- search results -->

        <div class="list-group list-group-flush border-bottom" style="height: calc(100vh - 143px); overflow-y: scroll">
          {#each searchResults as result}
          <a href="/test/{result.id}" class="list-group-item list-group-item-action py-3 lh-tight">
            <div class="d-flex w-100 align-items-center justify-content-between">
              <strong class="mb-1">{result.full_name}</strong>
            </div>
            <div class="col-10 mb-1 small">{result.label_name}</div>
          </a>
          {/each}
        </div>
        </div>

    <!--main content-->
      <!-- <embed class="w-100 py-4" type="text/html" src="/test1" style="height: calc(100vh - 100px);padding-left: 20%; padding-right: 20%"> -->
       {@render children()}
  </div>