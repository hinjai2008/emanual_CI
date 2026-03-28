<script>
    import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
    import { page } from '$app/state';

  let { data, children } = $props();

  // let rawTestData = data.rawTestData;

  import { base } from '$app/paths';
  import { editedJSON, initialJSON, isCreateMode } from './stores';
  import { isAdmin , isStaff } from './stores';
  import { isEditMode } from './stores';
  import { pauseEditorRender } from './stores';
 
  import lunr from 'lunr';
  import { setGlobalFunctions } from './stores';
    import { form } from '$app/server';


  function updateEditTrace(dataType, dataId, refId, editType, field, originalValue, newValue) {
    if ($isAdmin) {
      const timestamp = new Date().toISOString();

      if (editType == "add") {
        const newTrace = {
          dataType,
          dataId,
          refId,
          editType,
          field: null,
          originalValue: null,
          newValue: null,
          timestamp
        };

        editedJSON.update((draft) => {
          draft.config.editTrace.push(newTrace);
          return draft;
        });
        return;
      }

      if (editType == "remove") {
        const existingEntryEditTraceIndex = $editedJSON.config.editTrace.findIndex(trace => 
          trace.dataType === dataType &&
          trace.dataId === dataId &&
          trace.editType === "add"
        );

        if (existingEntryEditTraceIndex !== -1) {
          // If the entry was newly added, remove the "add" trace instead of logging a "remove"
          editedJSON.update((draft) => {
            draft.config.editTrace.splice(existingEntryEditTraceIndex, 1);
            return draft;
          });
          return;
        } else {
          const newTrace = {
            dataType,
            dataId,
            refId,
            editType,
            field: null,
            originalValue: null,
            newValue: null,
            timestamp
          };

          editedJSON.update((draft) => {
            draft.config.editTrace.push(newTrace);
            return draft;
          });
          return;
        }

      }


      if(editType == "modify" && originalValue === newValue) {
        return; // No change in value, do not log
      }

      if(editType == "modify") {

        const existingEntryEditTraceIndex = $editedJSON.config.editTrace.findIndex(trace => 
          trace.dataType === dataType &&
          trace.dataId === dataId &&
          trace.editType === "add"
        );

        if (existingEntryEditTraceIndex !== -1) {
          // If the entry was newly added, no need to log modifications
          return;
        }
        
        const existingTraceIndex = $editedJSON.config.editTrace.findIndex(trace => 
          trace.dataType === dataType &&
          trace.dataId === dataId &&
          trace.field === field &&
          trace.editType === "modify"
        );

        if (existingTraceIndex !== -1) {
          // Update the existing trace entry
          editedJSON.update((draft) => {
            draft.config.editTrace[existingTraceIndex].newValue = newValue;
            draft.config.editTrace[existingTraceIndex].timestamp = timestamp;
            return draft;
          });
          return; // Exit after updating existing trace
        }

        else { 
          
          const newTrace = {
            dataType,
            dataId,
            refId,
            editType,
            field,
            originalValue,
            newValue,
            timestamp
          };

          editedJSON.update((draft) => {
            draft.config.editTrace.push(newTrace);
            return draft;
          });
        }

      };

  }}

  function removeEditTrace(dataType, dataId, field) {
    if ($isAdmin) {
      const traceIndex = $editedJSON.config.editTrace.findIndex(trace => 
        trace.dataType === dataType &&
        trace.dataId === dataId &&
        trace.field === field &&
        trace.editType === "modify"
      );

      if (traceIndex !== -1) {
        editedJSON.update((draft) => {
          draft.config.editTrace.splice(traceIndex, 1);
          return draft;
        });
      }
    }
  }

  setGlobalFunctions({
    updateEditTrace,
    removeEditTrace
  });


  let publicIndexData = $state({
    tests: [],
    forms: [],
    containers: []
  });
  let publicCategories = $state([]);

  onMount(async () => {
    try {
      const response = await fetch(`${base}/search-index.json`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to load search index: ${response.status}`);
      }

      const payload = await response.json();
      publicIndexData = payload?.indexData || { tests: [], forms: [], containers: [] };
      publicCategories = payload?.categories || [];
    } catch (error) {
      console.error('Unable to load static search index', error);
      publicIndexData = { tests: [], forms: [], containers: [] };
      publicCategories = [];
    }
  });



  let indexData = {}

  let testIdCap = Math.max(...initialJSON.testData.map(test => test.id)) + 50;
  let formIdCap = Math.max(...initialJSON.formData.map(form => form.id)) + 50;
  let containerIdCap = Math.max(...initialJSON.containerData.map(container => container.id)) + 50;

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
          editType: "",
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
          editType: "",
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
          editType: "",
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

    if($isAdmin){

    const editTrace = rawData.config.editTrace;

    for (let i=0; i<editTrace.length; i++) {
      const trace = editTrace[i];
      const dataType = trace.dataType.replace("Data", "s"); // "tests", "forms", or "containers"
      const entryId = trace.dataId;
      const editType = trace.editType; // "add", "modify", "remove"

      if (editType !== "add" && editType !== "modify" && editType !== "remove") {
        continue; // skip invalid edit types
      }

      const toUpdate = indexData[dataType].find(item => item.id === trace.dataType.replace("Data", "/") + entryId);
      if (toUpdate) {
        console.log(toUpdate)
        toUpdate.editType = editType;
      }
    }
  }

    return indexData.tests.concat(indexData.forms).concat(indexData.containers);
  };

  const public_index_document = (type, category) => {
    indexData = publicIndexData;

    const tests = publicIndexData.tests.filter((test) => {
      if (type !== "allTypesSelected" && type !== "testSelected") {
        return false;
      }

      if (!category) {
        return true;
      }

      return Array.isArray(test.categoryCodes) && test.categoryCodes.includes(category);
    });

    const forms = publicIndexData.forms.filter((form) => {
      if (type !== "allTypesSelected" && type !== "formSelected") {
        return false;
      }

      if (!category) {
        return true;
      }

      return Array.isArray(form.categoryCodes) && form.categoryCodes.includes(category);
    });

    const containers = publicIndexData.containers.filter(() => {
      return type === "allTypesSelected" || type === "containerSelected";
    });

    return tests.concat(forms).concat(containers);
  };


  function ngramTokenizer(token) {
  const str = token.toString(), n = 3, out = []
  for (let i = 0; i <= str.length - n; i++)
    out.push(new lunr.Token(str.substr(i, n), token.metadata))
  if (str.length < n) out.push(token)
  return out
}
  lunr.Pipeline.registerFunction(ngramTokenizer, 'ngramTokenizer')


  let selectedCategory = $state('');
  let selectedType = $state('allTypesSelected');

  let idx = $derived.by(()=>{return lunr(function () {
    
    this.field('full_name');
    this.field('GCRS_name');
    this.field('short_name');
    this.field('synonyms');
    this.ref('id');

    this.pipeline.reset();
    this.pipeline.add(lunr.trimmer, ngramTokenizer);
    this.searchPipeline.reset();
    this.searchPipeline.add(lunr.trimmer, ngramTokenizer);

    if (!$isAdmin) {
    const publicDocs = public_index_document(selectedType, selectedCategory);
    publicDocs.forEach(function (doc) {
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
  let publishInProgress = $state(false);
  let publishStatusMessage = $state('');
  const defaultPublishEndpoint = 'https://emanual-publish-api.rayyt2020.workers.dev/publish';

  function normalizePublishEndpoint(rawValue) {
    if (!rawValue) {
      return '';
    }

    let value = rawValue.trim();
    if (!/^https?:\/\//i.test(value)) {
      value = `https://${value}`;
    }

    if (!value.endsWith('/publish')) {
      value = `${value.replace(/\/$/, '')}/publish`;
    }

    return value;
  }

  async function publishChangesListener() {
    if (publishInProgress) {
      return;
    }

    if (!$isAdmin) {
      alert('Admin access is required to publish changes.');
      return;
    }

    const defaultEndpoint = localStorage.getItem('publishApiUrl') || defaultPublishEndpoint;
    const endpointInput = window.prompt(
      'Enter the publish API endpoint URL (Cloudflare Worker URL or /publish endpoint):',
      defaultEndpoint
    );

    if (!endpointInput) {
      return;
    }

    const endpoint = normalizePublishEndpoint(endpointInput);
    localStorage.setItem('publishApiUrl', endpoint);

    const existingSecret = sessionStorage.getItem('publishApiSecret') || '';
    const secretInput = window.prompt(
      'Enter the publish API bearer secret. It will be kept only for this browser tab.',
      existingSecret
    );

    if (!secretInput) {
      return;
    }

    sessionStorage.setItem('publishApiSecret', secretInput);

    const existingRecipientEmail = localStorage.getItem('publishRecipientEmail') || '';
    const recipientEmailInput = window.prompt(
      'Enter recipient email address for notifications',
      existingRecipientEmail
    );

    if (!recipientEmailInput && recipientEmailInput !== '') {
      return;
    }

    const recipientEmail = recipientEmailInput.trim();
    if (recipientEmail && !recipientEmail.includes('@')) {
      alert('Invalid email address.');
      return;
    }

    if (recipientEmail) {
      localStorage.setItem('publishRecipientEmail', recipientEmail);
    }

    if (!window.confirm('Publish the current edited JSON to GitHub Actions?')) {
      return;
    }

    publishInProgress = true;
    publishStatusMessage = 'Publishing...';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secretInput}`,
        },
        body: JSON.stringify({
          editedJSON: $editedJSON,
          commitMessage: `chore: publish editedJSON from UI (${new Date().toISOString()})`,
          adminEmail: recipientEmail,
          notificationChannel: 'email-only'
        })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.ok) {
        const details = result?.details ? `\n\nDetails: ${result.details}` : '';
        throw new Error((result?.error || `HTTP ${response.status}`) + details);
      }

      publishStatusMessage = 'Publish started.';

      if (result.actionsUrl && window.confirm('Publish started successfully. Open GitHub Actions page in a new tab?')) {
        window.open(result.actionsUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      publishStatusMessage = 'Publish failed.';
      alert(`Publish failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      publishInProgress = false;
    }
  }

  let searchResultsDetails = $derived.by(() => {
    const keyword = (searchInput || '').trim();

    // If no keyword is provided, show all filtered entries in alphabetical order
    if (!keyword) {
      const allEntries = $isAdmin
        ? index_document($editedJSON, selectedType, selectedCategory)
        : public_index_document(selectedType, selectedCategory);

      return [...allEntries].sort((a, b) =>
        (a.full_name || '').localeCompare((b.full_name || ''), undefined, { sensitivity: 'base' })
      );
    }

    const searchResults = idx.search(keyword);

    return searchResults.map(result => {
      const resultType = result.ref.split('/')[0]; 
      const foundItem = indexData[resultType+"s"].find(item => item.id === result.ref);
      return {
        ...foundItem,
        score: result.score
      };
    });
  });


  async function checkStatus() {
    const encoder = new TextEncoder();
    const encodedSearchInput = encoder.encode(searchInput);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", encodedSearchInput);
    const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""); // convert bytes to hex string

    const encryptedAdminPw = "2ca5161d5fd55633223b61a03cc51c4ce7e32383b480f3eb37b4f122f24e4c23";
    const encryptedStaffPw = "c24d0b20eebe6e430aa4a366fec5ecc04fef3f48a245a9e98a391fdc9fe85e57";

    if (hashHex === encryptedAdminPw) {
      isAdmin.set(true);
      searchInput = "";
    }

    if (hashHex === encryptedStaffPw) {
      isStaff.set(true);
      searchInput = "";
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
    refId: Math.floor(Math.random() * 100000000),
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
  updateEditTrace("testData", newTestId, newTest.refId, "add", null, null, null);
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

    form_external_link: {blocks: [
      {
        type: "paragraph",
        data: {
          text: "",
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
  updateEditTrace("formData", newFormId, newForm.refId, "add", null, null, null);
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
    refId: Math.floor(Math.random() * 100000000),
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
  updateEditTrace("containerData", newContainerId, newContainer.refId, "add", null, null, null);
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
      <li class="nav-item"><button type="button" class="nav-link active ms-2" onclick={publishChangesListener} disabled={publishInProgress}>{publishInProgress ? 'Publishing...' : 'Publish Site'}</button></li>
      {/if}
      
    </ul>
  </header>
  {#if publishStatusMessage}
  <div class="small text-muted mb-2">{publishStatusMessage}</div>
  {/if}
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
  {#each ($isAdmin ? $editedJSON.config.category : publicCategories) as category}
    <option value={category.code}>{category.text}</option>
  {/each}
  </select>
  </div>

    <!-- Search -->
    <div class="input-group" style="width: 97%;">
      <img class="input-group-text" src="{base}/search.svg" id="basic-addon1" style="width: 10%;" alt="search">
      <input bind:value={searchInput} onkeydown={checkStatus} id="search_sideBar" type="text" class="form-control" placeholder="Type in test / form name..." tabindex="0">
    </div>

    <!-- Search Results -->
    <div class="list-group list-group-flush border-bottom" style="height: calc(100vh - 230px); overflow-y: scroll">
        <!-- Display search results -->
        {#each searchResultsDetails as resultDetails}

          <a
            href="{base}/{resultDetails.id}"
            class="list-group-item list-group-item-action py-3 lh-tight"
            style="background-color: {resultDetails.editType === 'add' ? '#d4edda' : resultDetails.editType === 'modify' ? '#fff3cd' : resultDetails.editType === 'remove' ? '#f8d7da' : 'transparent'}"
          >
            <div 
              class="d-flex w-100 align-items-center justify-content-between">
              <strong class="mb-1">{resultDetails.id?.startsWith('test/') && resultDetails.GCRS_name ? resultDetails.GCRS_name : resultDetails.full_name}</strong>
            </div>
            <div class="col-10 mb-1 small">{resultDetails.short_name}</div>
          </a>
          
        {/each}
    </div>
  </div>

  <!-- Render Children -->
  {@render children()}
</div>