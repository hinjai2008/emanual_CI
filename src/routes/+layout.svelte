<script>
    import { goto } from '$app/navigation';
    import { page } from '$app/state';

  let { data, children } = $props();

  // let rawTestData = data.rawTestData;

  import { base } from '$app/paths';
  import { editedJSON, isCreateMode } from './stores';
  import { isAdmin } from './stores';
  import { isEditMode } from './stores';
  import { pauseEditorRender } from './stores';
 
  import lunr from 'lunr';


  let indexData = {}

  let testIdCap = Math.max(...data.completeJSON.testData.map(test => test.id)) + 50;
  let formIdCap = Math.max(...data.completeJSON.formData.map(form => form.id)) + 50;
  let containerIdCap = Math.max(...data.completeJSON.containerData.map(container => container.id)) + 50;

  const index_document = (rawData, type, category) => {
    indexData = {

      tests: rawData.testData.filter((test)=>{

        if (type !== "allTypesSelected" && type !== "testSelected") {
          return false; // filter by type
        }

        if (!category) {
          return true; // include all tests if no category is provided
        }

        if (test.lab_and_category) {
          return test.lab_and_category.blocks.some((block) => {
            return block.data.categoryCode === category;
          });
        } else {
          return false; // exclude tests without lab_and_category
        }
      }).map((test) => {

        let result = {
          id: "test/" + test.id,
          full_name: "",
          GCRS_name: "",
          short_name: "",
          synonyms: "",
        }


        if (!test.GCRS_name.blocks || test.GCRS_name.blocks.length === 0) {
          result.GCRS_name = "";
        } else {
          result.GCRS_name = test.GCRS_name.blocks[0].data.text || "";
        }
        if (test.label_name.blocks === undefined || test.label_name.blocks.length === 0) {
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


      forms: rawData.formData.filter((form)=>{

        if (type !== "allTypesSelected" && type !== "formSelected") {
          return false; // filter by type
        }

        if (!category) {
          return true; // include all tests if no category is provided
        }

        if (form.lab_and_category) {
          return form.lab_and_category.blocks.some((block) => {
            return block.data.categoryCode === category;
          });
        } else {
          return false; // exclude tests without lab_and_category
        }
      }).map((form) => {

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

      containers: rawData.containerData.filter(()=>{

        if (type !== "allTypesSelected" && type !== "containerSelected") {
          return false; // filter by type
        } else {
          return true; // return all containers if type is "allTypesSelected" or "containerSelected"
        }

      }).map((container) => {

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

  let selectedCategory = $state('');
  let selectedType = $state('allTypesSelected');

  let idx = $derived.by(()=>{return lunr(function () {
    
    this.field('full_name');
    this.field('GCRS_name');
    this.field('short_name');
    this.field('synonyms');
    this.ref('id');


    if (!$isAdmin) {

    index_document(data.completeJSON, selectedType, selectedCategory).forEach(function (doc) {
      this.add(doc);
    }, this);


    } else if (isAdmin) {

      index_document($editedJSON, selectedType, selectedCategory).forEach(function (doc) {
        this.add(doc);
      }, this);

    }

  })
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



  $effect(() => {

    if($isAdmin) {

      function exportListener() {
        const blob = new Blob([JSON.stringify($editedJSON, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "editedJSON.json";
        a.click();
        URL.revokeObjectURL(url);
      }

    const exportButton = document.getElementById("exportButton");
    if (exportButton) {
      exportButton.addEventListener("click", exportListener);
    }

  }});


  function newTestListener() {

  const testIdList = $editedJSON.testData.map((test) => test.id);
  const newTestId = Math.max(...testIdList) + 1;

  if(newTestId > testIdCap) {
    alert("You have reached the maximum number of newly created tests (+50). Please commit the changes to the server before creating a new test.");
    return;
  }

  // template the new test
  const newTest = {
    id: newTestId,
    full_name: {
      blocks: [
        {
          type: "paragraph",
          data: {
            text: "New Test " + newTestId,
          },
        },
      ],
    },

    GCRS_name: {},

    label_name: {
      blocks: [
        {
          type: "paragraph",
          data: {
            text: "New Test " + newTestId,
          },
        },
      ],
    },

    synonyms: {
      blocks: [
        {
          type: "synonyms",
          data: {
            synonymList: [],
          },
        },
      ],
    },

  }
  
  const newTestData = [...$editedJSON.testData, newTest];
  const newEditedJSON = { ...$editedJSON, testData: newTestData };
  isCreateMode.set(true);
  pauseEditorRender.set(true);
  editedJSON.set(newEditedJSON);
  pauseEditorRender.set(false);
  goto(`${base}/test/${newTestId}`);
  }


  function newFormListener() {

  const formIdList = $editedJSON.formData.map((form) => form.id);
  const newFormId = Math.max(...formIdList) + 1;

  if(newFormId > formIdCap) {
    alert("You have reached the maximum number of newly created forms (+50). Please commit the changes to the server before creating a new form.");
    return;
  }

  // template the new form
  const newForm = {
    id: newFormId,
    refId: Math.floor(Math.random() * 100000000),
    form_name: {
      blocks: [
        {
          type: "paragraph",
          data: {
            text: "New Form " + newFormId,
          },
        },
      ],
    },

    form_link: {blocks: [
      {
        type: "form_link",
        data: {
          url: "",
        },
      },
    ]},

    form_code: {
      blocks: [
        {
          type: "paragraph",
          data: {
            text: "New Form " + newFormId,
          },
        },
      ],
    },

  }

  const newFormData = [...$editedJSON.formData, newForm];
  const newEditedJSON = { ...$editedJSON, formData: newFormData };
  isCreateMode.set(true);
  pauseEditorRender.set(true);
  editedJSON.set(newEditedJSON);
  pauseEditorRender.set(false);
  goto(`${base}/form/${newFormId}`);

  }


  function newContainerListener() {

  const containerIdList = $editedJSON.containerData.map((container) => container.id);
  const newContainerId = Math.max(...containerIdList) + 1;

  if(newContainerId > containerIdCap) {
    alert("You have reached the maximum number of newly created containers (+50). Please commit the changes to the server before creating a new container.");
    return;
  }

  // template the new test
  const newContainer = {
    id: newContainerId,
    code: {
      blocks: [
        {
          type: "paragraph",
          data: {
            text: "New_Container_" + newContainerId,
          },
        },
      ],
    },

    name: {blocks: [
      {
        type: "paragraph",
        data: {
          text: "NewContainer " + newContainerId,
        },
      },
    ]},

    synonyms: {
      blocks: [
        {
          type: "synonyms",
          data: {
            synonymList: [],
          },
        },
      ],
    },

  imageSrc: {
      blocks: [],
    },

  }

  const newContainerData = [...$editedJSON.containerData, newContainer]
  const newEditedJSON = { ...$editedJSON, containerData: newContainerData };
  isCreateMode.set(true);
  pauseEditorRender.set(true);
  editedJSON.set(newEditedJSON);
  pauseEditorRender.set(false);
  goto(`${base}/container/${newContainerId}`);

  }

  function removeEntryListener() {
    if ($isEditMode) {
      const pathSegments = page.url.pathname.split('/');
      const entryType = pathSegments[pathSegments.length - 2]; // e.g., 'test', 'form', 'container'
      const entryId = parseInt(pathSegments[pathSegments.length - 1]); // e.g., '123'

      if (entryType !== 'test' && entryType !== 'form' && entryType !== 'container') {
        alert('Removal failed. Please ensure you are on a valid test, form, or container page.');
        return;
      }

      if (!window.confirm(`Confirm removing this ${entryType} entry (ID: ${entryId})?`)) {
        return; // User cancelled the removal
      }

      // Call the appropriate store action to remove the entry
      switch (entryType) {
        case 'test':
          editedJSON.update((draft) => {
            draft.testData = draft.testData.filter((test) => test.id !== entryId);
            return draft
          });
          console.log($editedJSON)
          goto(`${base}/test/${entryId}`);
          break;
        case 'form':
          editedJSON.update((draft) => {
            draft.formData = draft.formData.filter((form) => form.id !== entryId);
            return draft
          });
          goto(`${base}/form/${entryId}`);
          break;
        case 'container':
          editedJSON.update((draft) => {
            draft.containerData = draft.containerData.filter((container) => container.id !== entryId);
            return draft
          });
          goto(`${base}/container/${entryId}`);
          break;
      }
    }
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

      {#if $isEditMode}
      <li class="nav-item ms-2"><button id="newTestButton" onclick={newTestListener} class="nav-link">New Test</button></li>
      <li class="nav-item"><button id="newFormButton" onclick={newFormListener} class="nav-link">New Form</button></li>
      <li class="nav-item"><button id="newContainerButton" onclick={newContainerListener} class="nav-link">New Container</button></li>
      <li class="nav-item"><button id="removeContainerButton" onclick={removeEntryListener} class="nav-link">Remove Current Entry</button></li>
      {/if}
      
      {#if $isAdmin}
      <li class="nav-item"><button id="exportButton" class="nav-link active">Save Changes</button></li>
      {/if}
      
    </ul>
  </header>
</div>

<!-- Sidebar and Content Wrapper -->
<div class="d-flex flex-row">
  <!-- Sidebar -->
  <div class="mt-2 d-flex flex-column align-items-stretch bg-white" style="width: 500px; border-right: 1px solid #eaeaea;">
  
  <!--Type Selection-->
  <div class="input-group mb-2 justify-content-center" style="width: 100%;">
  <!-- <img class="input-group-text" src="{base}/filter.svg" id="basic-addon1" style="width: 10%;" alt="filter"> -->
  <div class="btn-group" role="group" aria-label="Basic radio toggle button group">
  <input type="radio" class="btn-check" name="selectType" bind:group={selectedType} id="btnradio1" value="allTypesSelected" autocomplete="off">
  <label class="btn btn-outline-secondary" for="btnradio1">All Types</label>

  <input type="radio" class="btn-check" name="selectType" bind:group={selectedType} id="btnradio2" value="testSelected" autocomplete="off">
  <label class="btn btn-outline-secondary" for="btnradio2">Test</label>

  <input type="radio" class="btn-check" name="selectType" bind:group={selectedType} id="btnradio3" value="formSelected" autocomplete="off">
  <label class="btn btn-outline-secondary" for="btnradio3">Form</label>

  <input type="radio" class="btn-check" name="selectType" bind:group={selectedType} id="btnradio4" value="containerSelected" autocomplete="off">
  <label class="btn btn-outline-secondary" for="btnradio4">Container</label>
  </div>
  </div>

  <!-- Category Filter -->
  <div class="input-group mb-1" style="width: 97%;">
  <img class="input-group-text" src="{base}/filter.svg" id="basic-addon1" style="width: 10%;" alt="filter">
  <select bind:value={selectedCategory} class="form-select form-control" aria-label="Default select example">
  <option value="">All Categories</option>
  {#each $editedJSON.config.category as category}
    <option value={category.code}>{category.text}</option>
  {/each}
  </select>
  </div>

    <!-- Search -->
    <div class="input-group" style="width: 97%;">
      <img class="input-group-text" src="{base}/search.svg" id="basic-addon1" style="width: 10%;" alt="search">
      <input bind:value={searchInput} onkeydown={checkadmin} id="search_sideBar" type="text" class="form-control" placeholder="Type in test / form name..." tabindex="0">
    </div>

    <!-- Search Results -->
    <div class="list-group list-group-flush border-bottom" style="height: calc(100vh - 230px); overflow-y: scroll">
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
    </div>
  </div>

  <!-- Render Children -->
  {@render children()}
</div>