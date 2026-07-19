<script>
    import { goto } from '$app/navigation';
  import { onDestroy, onMount } from 'svelte';
    import { page } from '$app/state';

  let { data, children } = $props();

  // let rawTestData = data.rawTestData;

  import { base } from '$app/paths';
  import { editedJSON, initialJSON, isCreateMode } from './stores';
  import { isAdmin , isStaff } from './stores';
  import { isEditMode } from './stores';
  import { pauseEditorRender } from './stores';
 
  import lunr from 'lunr';
  import { setBeginEditSession, setGlobalFunctions } from './stores';

  /**
   * @param {any} value
   */
  function readEditorJsText(value) {
    if (!value) {
      return '';
    }

    if (typeof value === 'string') {
      return value.trim();
    }

    const blockText = value?.blocks?.[0]?.data?.text;
    if (typeof blockText === 'string') {
      return blockText.trim();
    }

    return '';
  }

  /**
   * @param {string} dataType
   * @param {string|null|undefined} field
   */
  function isNameField(dataType, field) {
    if (!field) {
      return false;
    }

    if (dataType === 'testData') {
      return field === 'GCRS_name' || field === 'full_name' || field === 'label_name';
    }

    if (dataType === 'formData') {
      return field === 'form_name' || field === 'form_code';
    }

    if (dataType === 'containerData') {
      return field === 'name' || field === 'code';
    }

    return false;
  }

  /**
   * @param {any} source
   * @param {string} dataType
   * @param {string|number} dataId
   */
  function findEntryByTypeAndId(source, dataType, dataId) {
    if (!source) {
      return null;
    }

    const idText = String(dataId);

    if (dataType === 'testData') {
      const testEntries = Array.isArray(source.testData) ? source.testData : [];
      for (const entry of testEntries) {
        if (String(entry?.id) === idText) {
          return entry;
        }
      }
      return null;
    }

    if (dataType === 'formData') {
      const formEntries = Array.isArray(source.formData) ? source.formData : [];
      for (const entry of formEntries) {
        if (String(entry?.id) === idText) {
          return entry;
        }
      }
      return null;
    }

    if (dataType === 'containerData') {
      const containerEntries = Array.isArray(source.containerData) ? source.containerData : [];
      for (const entry of containerEntries) {
        if (String(entry?.id) === idText) {
          return entry;
        }
      }
      return null;
    }

    return null;
  }

  /**
   * @param {string} dataType
   * @param {any} entry
   */
  function getEntryNameSnapshot(dataType, entry) {
    if (!entry) {
      return '';
    }

    if (dataType === 'testData') {
      return (
        readEditorJsText(entry.GCRS_name) ||
        readEditorJsText(entry.full_name) ||
        readEditorJsText(entry.label_name)
      );
    }

    if (dataType === 'formData') {
      return readEditorJsText(entry.form_name) || readEditorJsText(entry.form_code);
    }

    if (dataType === 'containerData') {
      return readEditorJsText(entry.name) || readEditorJsText(entry.code);
    }

    return '';
  }

  /**
   * @param {string} dataType
   * @param {string|number} dataId
   * @param {string|null|undefined} field
   * @param {any} newValue
   */
  function resolveNameSnapshot(dataType, dataId, field, newValue) {
    if (isNameField(dataType, field)) {
      const nameFromValue = readEditorJsText(newValue);
      if (nameFromValue) {
        return nameFromValue;
      }
    }

    const editedEntry = findEntryByTypeAndId($editedJSON, dataType, dataId);
    const editedName = getEntryNameSnapshot(dataType, editedEntry);
    if (editedName) {
      return editedName;
    }

    const initialEntry = findEntryByTypeAndId(initialJSON, dataType, dataId);
    return getEntryNameSnapshot(dataType, initialEntry);
  }


  function updateEditTrace(dataType, dataId, refId, editType, field, originalValue, newValue) {
    if ($isAdmin) {
      const timestamp = new Date().toISOString();
      const nameSnapshot = resolveNameSnapshot(dataType, dataId, field, newValue);

      if (editType == "hide" || editType == "unhide") {
        const sameActionIndex = $editedJSON.config.editTrace.findIndex(trace =>
          trace.dataType === dataType &&
          trace.dataId === dataId &&
          trace.editType === editType
        );

        if (sameActionIndex !== -1) {
          editedJSON.update((draft) => {
            draft.config.editTrace[sameActionIndex].timestamp = timestamp;
            draft.config.editTrace[sameActionIndex].field = field;
            draft.config.editTrace[sameActionIndex].originalValue = originalValue;
            draft.config.editTrace[sameActionIndex].newValue = newValue;
            draft.config.editTrace[sameActionIndex].nameSnapshot = nameSnapshot;
            return draft;
          });
          return;
        }

        const oppositeEditType = editType === "hide" ? "unhide" : "hide";
        const oppositeActionIndex = $editedJSON.config.editTrace.findIndex(trace =>
          trace.dataType === dataType &&
          trace.dataId === dataId &&
          trace.editType === oppositeEditType
        );

        if (oppositeActionIndex !== -1) {
          editedJSON.update((draft) => {
            draft.config.editTrace.splice(oppositeActionIndex, 1);
            return draft;
          });
        }

        const newTrace = {
          nameSnapshot,
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
            nameSnapshot,
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
            draft.config.editTrace[existingTraceIndex].nameSnapshot = nameSnapshot;
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
            nameSnapshot,
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

  setBeginEditSession(beginRemoteEditSession);


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
          hidden: Boolean(test.is_hidden),
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
          result.synonymsList = synonymsList;

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
          hidden: Boolean(form.is_hidden),
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
          hidden: Boolean(container.is_hidden),
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
          result.synonymsList = synonymsList;
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
      const editType = trace.editType; // "add", "modify", "remove", "hide", "unhide"

      if (editType !== "add" && editType !== "modify" && editType !== "remove" && editType !== "hide" && editType !== "unhide") {
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
  let selectedEditType = $state('allEditTypesSelected');
  let selectedVisibility = $state('allVisibilitySelected');

  function matchesSelectedEditType(entry) {
    if (selectedEditType === 'allEditTypesSelected') {
      return true;
    }

    if (selectedEditType === 'noEditTypeSelected') {
      return !entry?.editType;
    }

    return entry?.editType === selectedEditType;
  }

  function matchesSelectedVisibility(entry) {
    if (selectedVisibility === 'allVisibilitySelected') {
      return true;
    }

    if (selectedVisibility === 'hiddenOnlySelected') {
      return entry?.hidden === true;
    }

    if (selectedVisibility === 'visibleOnlySelected') {
      return entry?.hidden !== true;
    }

    return true;
  }

  function matchesAdminFilters(entry) {
    return matchesSelectedEditType(entry) && matchesSelectedVisibility(entry);
  }

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

  const defaultPublishEndpoint = 'https://emanual-publish-api.rayyt2020.workers.dev/publish';

  let searchInput = $state('');
  let goToIdInput = $state('');
  let publishInProgress = $state(false);
  let publishStatusMessage = $state('');
  let publishActionsUrl = $state('');
  let showAdminLogin = $state(false);
  let showStaffLogin = $state(false);
  let adminLoginName = $state('');
  let adminLoginSecret = $state('');
  let adminLoginApiUrl = $state(defaultPublishEndpoint);
  let adminLoginInProgress = $state(false);
  let adminLoginError = $state('');
  let staffLoginPasskey = $state('');
  let staffLoginInProgress = $state(false);
  let staffLoginError = $state('');
  let draftStatusMessage = $state('');
  let draftRevision = $state(0);
  let draftSaveInProgress = $state(false);
  let draftLoadInProgress = $state(false);
  let draftReady = $state(false);
  let suppressDraftAutosave = $state(false);
  let draftLastUpdatedAt = $state('');
  let draftLastUpdatedBy = $state('');
  let draftAutosaveTimer = null;
  let draftStoreUnsubscribe = null;
  let hasObservedInitialDraftValue = false;
  let pendingDraftAutosave = false;
  const draftEditSaveDelayMs = 400;
  let syncCheckEnabled = $state(false);
  let syncStatus = $state('idle');
  let syncStatusMessage = $state('');
  let predeployVersion = $state(null);
  let productionVersion = $state(null);
  let syncCheckTimer = null;
  let issuesPanelOpen = $state(false);
  let issuesStatusMessage = $state('');
  let issuesErrorMessage = $state('');
  let issuesLoading = $state(false);
  let issuesRevision = $state(0);
  let issuesUpdatedAt = $state('');
  let issuesUpdatedBy = $state('');
  let issuesLoadedForSession = $state(false);
  let issueLogs = $state([]);
  let issueActionInputById = $state({});
  let issueActionTypeById = $state({});
  let showResolvedClosedInPanel = $state(false);
  let newIssueTitle = $state('');
  let newIssueDescription = $state('');
  let newIssueRefsInput = $state('');

  function deepCloneJSON(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeApiBase(rawValue) {
    if (!rawValue) {
      return '';
    }

    let value = rawValue.trim();
    if (!/^https?:\/\//i.test(value)) {
      value = `https://${value}`;
    }

    value = value.replace(/\/$/, '');
    if (value.endsWith('/publish')) {
      return value.slice(0, -('/publish'.length));
    }

    return value;
  }

  function endpointFromBase(apiBase, route) {
    return `${apiBase.replace(/\/$/, '')}${route}`;
  }

  function getSavedApiBase() {
    if (typeof window === 'undefined') {
      return normalizeApiBase(defaultPublishEndpoint);
    }

    const directBase = localStorage.getItem('publishApiBase') || '';
    if (directBase) {
      return normalizeApiBase(directBase);
    }

    const publishUrl = localStorage.getItem('publishApiUrl') || defaultPublishEndpoint;
    return normalizeApiBase(publishUrl);
  }

  function persistApiBase(apiBase) {
    localStorage.setItem('publishApiBase', apiBase);
    localStorage.setItem('publishApiUrl', endpointFromBase(apiBase, '/publish'));
  }

  function normalizeVersionUrl(rawValue) {
    return (rawValue || '').trim();
  }

  function defaultPredeployVersionUrl() {
    return 'https://hinjai2008.github.io/emanual_CI/content-version.json';
  }

  function isSyncCheckHostEnabled() {
    if (typeof window === 'undefined') {
      return false;
    }

    const hostname = window.location.hostname.toLowerCase();
    return !hostname.includes('github.io') && !hostname.includes('githubusercontent.com');
  }

  function withCacheBuster(url) {
    const parsedUrl = new URL(url, window.location.href);
    parsedUrl.searchParams.set('ts', String(Date.now()));
    return parsedUrl.toString();
  }

  async function fetchVersionMarker(url) {
    try {
      const response = await fetch(withCacheBuster(url));
      if (!response.ok) {
        return { ok: false, error: `HTTP ${response.status}` };
      }

      return { ok: true, data: await response.json() };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown network error'
      };
    }
  }

  /**
   * @param {{ silent?: boolean }=} options
   */
  async function refreshSyncStatus(options = {}) {
    if (!$isAdmin || typeof window === 'undefined' || !syncCheckEnabled) {
      return;
    }

    const silent = options.silent === true;

    const predeployVersionUrl = normalizeVersionUrl(
      localStorage.getItem('predeployContentVersionUrl') || defaultPredeployVersionUrl()
    );  
    if (!predeployVersionUrl) {
      syncStatus = 'idle';
      syncStatusMessage = '';
      predeployVersion = null;
      productionVersion = null;
      return;
    }

    if (!silent) {
      syncStatus = 'checking';
    }

    const [predeployResp, productionResp] = await Promise.all([
      fetchVersionMarker(predeployVersionUrl),
      fetchVersionMarker(`${base}/content-version.json`)
    ]);

    if (!predeployResp.ok) {
      syncStatus = 'unknown';
      syncStatusMessage = `Unable to read latest pre-deployment version: ${predeployResp.error}`;
      return;
    }

    predeployVersion = predeployResp.data;

    if (!productionResp.ok) {
      syncStatus = 'unknown';
      syncStatusMessage = `Unable to read production version: ${productionResp.error}`;
      productionVersion = null;
      return;
    }

    productionVersion = productionResp.data;

    const preSha = predeployResp.data?.contentSha256;
    const prodSha = productionResp.data?.contentSha256;

    if (!preSha || !prodSha) {
      syncStatus = 'unknown';
      syncStatusMessage = 'Sync status is unavailable because the version marker is incomplete.';
      return;
    }

    if (preSha === prodSha) {
      syncStatus = 'in-sync';
      syncStatusMessage = 'insync';
    } else {
      syncStatus = 'out-of-sync';
      syncStatusMessage = 'out of sync';
    }
  }

  async function configurePredeployVersionUrl() {
    if (!$isAdmin || typeof window === 'undefined' || !syncCheckEnabled) {
      return;
    }

    const existingUrl = localStorage.getItem('predeployContentVersionUrl') || defaultPredeployVersionUrl();
    const input = window.prompt(
      'Enter the pre-deployment (GitHub Pages) content-version URL:',
      existingUrl
    );

    if (input === null) {
      return;
    }

    const normalizedUrl = normalizeVersionUrl(input);

    if (!normalizedUrl) {
      localStorage.removeItem('predeployContentVersionUrl');
      syncStatus = 'idle';
      syncStatusMessage = '';
      predeployVersion = null;
      productionVersion = null;
      return;
    }

    localStorage.setItem('predeployContentVersionUrl', normalizedUrl);
    await refreshSyncStatus();
  }

  function startSyncPolling() {
    if (typeof window === 'undefined' || !syncCheckEnabled || syncCheckTimer) {
      return;
    }

    syncCheckTimer = window.setInterval(() => {
      void refreshSyncStatus({ silent: true });
    }, 10000);
  }

  function stopSyncPolling() {
    if (syncCheckTimer) {
      clearInterval(syncCheckTimer);
      syncCheckTimer = null;
    }
  }

  function normalizePublishEndpoint(rawValue) {
    const apiBase = normalizeApiBase(rawValue);
    return apiBase ? endpointFromBase(apiBase, '/publish') : '';
  }

  async function ensureApiBaseInteractive() {
    const savedApiBase = getSavedApiBase();
    if (savedApiBase) {
      return savedApiBase;
    }

    const defaultEndpoint = localStorage.getItem('publishApiUrl') || defaultPublishEndpoint;
    const endpointInput = window.prompt(
      'Enter the publish API endpoint URL (Cloudflare Worker URL or /publish endpoint):',
      defaultEndpoint
    );

    if (!endpointInput) {
      return '';
    }

    const apiBase = normalizeApiBase(endpointInput);
    if (!apiBase) {
      return '';
    }

    persistApiBase(apiBase);
    return apiBase;
  }

  async function ensureSecretInteractive() {
    const existingSecret = sessionStorage.getItem('publishApiSecret') || '';
    if (existingSecret) {
      return existingSecret;
    }

    const secretInput = window.prompt(
      'Enter the publish API bearer secret. It will be kept only for this browser tab.',
      existingSecret
    );

    if (!secretInput) {
      return '';
    }

    sessionStorage.setItem('publishApiSecret', secretInput);
    return secretInput;
  }

  function getPublisherName() {
    return (localStorage.getItem('publishAdminName') || '').trim();
  }

  function openAdminLogin() {
    if (!$isStaff && !$isAdmin) {
      return;
    }
    showAdminLogin = true;
    showStaffLogin = false;
    adminLoginError = '';
    adminLoginName = localStorage.getItem('publishAdminName') || '';
    adminLoginSecret = sessionStorage.getItem('publishApiSecret') || '';
    adminLoginApiUrl = localStorage.getItem('publishApiUrl') || defaultPublishEndpoint;
  }

  function closeAdminLogin() {
    showAdminLogin = false;
    adminLoginError = '';
  }

  function openStaffLogin() {
    showStaffLogin = true;
    showAdminLogin = false;
    staffLoginError = '';
    staffLoginPasskey = '';
  }

  function closeStaffLogin() {
    showStaffLogin = false;
    staffLoginError = '';
    staffLoginPasskey = '';
  }

  async function submitAdminLogin() {
    const displayName = adminLoginName.trim();
    const sharedToken = adminLoginSecret.trim();
    const apiBase = normalizeApiBase(adminLoginApiUrl);

    if (!displayName) {
      adminLoginError = 'Display name is required.';
      return;
    }

    if (!sharedToken) {
      adminLoginError = 'Shared token is required.';
      return;
    }

    if (!apiBase) {
      adminLoginError = 'Publish API URL is required.';
      return;
    }

    adminLoginInProgress = true;
    adminLoginError = '';

    try {
      const response = await fetch(endpointFromBase(apiBase, '/draft/load'), {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify({ _secret: sharedToken })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        const details = result?.details ? ` ${result.details}` : '';
        throw new Error((result?.error || `HTTP ${response.status}`) + details);
      }

      localStorage.setItem('publishAdminName', displayName);
      sessionStorage.setItem('publishApiSecret', sharedToken);
      persistApiBase(apiBase);

      isStaff.set(false);
      isAdmin.set(true);
      issuesLoadedForSession = false;
      closeAdminLogin();
      publishStatusMessage = '';
      draftStatusMessage = 'Admin login verified. Start a new edit to load the remote draft.';
    } catch (error) {
      adminLoginError = error instanceof Error ? error.message : 'Admin login failed.';
    } finally {
      adminLoginInProgress = false;
    }
  }

  async function submitStaffLogin() {
    const passkey = staffLoginPasskey.trim();

    if (!passkey) {
      staffLoginError = 'Staff passkey is required.';
      return;
    }

    staffLoginInProgress = true;
    staffLoginError = '';

    try {
      const encoder = new TextEncoder();
      const encodedPasskey = encoder.encode(passkey);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', encodedPasskey);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
      const encryptedStaffPw = 'c24d0b20eebe6e430aa4a366fec5ecc04fef3f48a245a9e98a391fdc9fe85e57';

      if (hashHex !== encryptedStaffPw) {
        throw new Error('Invalid staff passkey.');
      }

      isAdmin.set(false);
      isStaff.set(true);
      isEditMode.set(false);
      closeStaffLogin();
      draftStatusMessage = '';
      publishStatusMessage = '';
    } catch (error) {
      staffLoginError = error instanceof Error ? error.message : 'Staff login failed.';
    } finally {
      staffLoginInProgress = false;
    }
  }

  function logoutUser() {
    isEditMode.set(false);
    isAdmin.set(false);
    isStaff.set(false);
    draftReady = false;
    draftRevision = 0;
    draftLastUpdatedAt = '';
    draftLastUpdatedBy = '';
    draftStatusMessage = '';
    publishStatusMessage = '';
    publishActionsUrl = '';
    sessionStorage.removeItem('publishApiSecret');
    localStorage.removeItem('publishAdminName');
    showAdminLogin = false;
    showStaffLogin = false;
    adminLoginError = '';
    staffLoginError = '';
    issuesLoadedForSession = false;
    issueLogs = [];
    issueActionInputById = {};
    issueActionTypeById = {};
    issuesStatusMessage = '';
    issuesErrorMessage = '';
  }

  function getDraftLoadEndpoint() {
    const apiBase = getSavedApiBase();
    return apiBase ? endpointFromBase(apiBase, '/draft/load') : '';
  }

  function getDraftSaveEndpoint() {
    const apiBase = getSavedApiBase();
    return apiBase ? endpointFromBase(apiBase, '/draft/save') : '';
  }

  function getIssuesLoadEndpoint() {
    const apiBase = getSavedApiBase();
    return apiBase ? endpointFromBase(apiBase, '/issues/load') : '';
  }

  function getIssuesCreateEndpoint() {
    const apiBase = getSavedApiBase();
    return apiBase ? endpointFromBase(apiBase, '/issues/create') : '';
  }

  function getIssuesUpdateEndpoint() {
    const apiBase = getSavedApiBase();
    return apiBase ? endpointFromBase(apiBase, '/issues/update') : '';
  }

  function getIssuesAddActionEndpoint() {
    const apiBase = getSavedApiBase();
    return apiBase ? endpointFromBase(apiBase, '/issues/add-action') : '';
  }

  function getIssuesUpdateActionEndpoint() {
    const apiBase = getSavedApiBase();
    return apiBase ? endpointFromBase(apiBase, '/issues/update-action') : '';
  }

  function parseEntryRefsInput(rawInput) {
    if (!rawInput) {
      return [];
    }

    const rawParts = String(rawInput)
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    const refs = [];
    const seen = new Set();
    for (const part of rawParts) {
      const [rawType, rawId] = part.split('/');
      const type = String(rawType || '').trim().toLowerCase();
      const id = Number(rawId);
      if (!['test', 'form', 'container'].includes(type) || !Number.isFinite(id) || id <= 0) {
        continue;
      }

      const key = `${type}/${id}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      refs.push({ type, id });
    }

    return refs;
  }

  function stringifyEntryRefs(entryRefs) {
    if (!Array.isArray(entryRefs) || entryRefs.length === 0) {
      return '';
    }

    return entryRefs
      .map((ref) => `${ref?.type || ''}/${ref?.id || ''}`)
      .filter((ref) => ref !== '/')
      .join(', ');
  }

  function setIssueActionMaps(issues) {
    const nextActionInputMap = {};
    const nextActionTypeMap = {};

    for (const issue of issues) {
      const issueId = String(issue?.id || '');
      if (!issueId) {
        continue;
      }
      nextActionInputMap[issueId] = issueActionInputById[issueId] || '';
      nextActionTypeMap[issueId] = issueActionTypeById[issueId] || '';
    }

    issueActionInputById = nextActionInputMap;
    issueActionTypeById = nextActionTypeMap;
  }

  function updateIssueActionInput(issueId, value) {
    issueActionInputById = {
      ...issueActionInputById,
      [issueId]: value
    };
  }

  function updateIssueActionType(issueId, value) {
    issueActionTypeById = {
      ...issueActionTypeById,
      [issueId]: value
    };
  }

  function issueIsTerminal(statusValue) {
    const normalized = String(statusValue || '').toLowerCase();
    return normalized === 'closed' || normalized === 'resolved';
  }

  function getIssueStatusFromAction(actionType) {
    if (actionType === 'follow-up') {
      return 'in-progress';
    }
    if (actionType === 'resolve') {
      return 'resolved';
    }
    if (actionType === 'close') {
      return 'closed';
    }
    return null;
  }

  function beginIssueAction(issueId, actionType, currentStatus) {
    if (issueIsTerminal(currentStatus) && actionType !== 'comment') {
      issuesErrorMessage = 'Only comment action is allowed for closed or resolved issues.';
      return;
    }
    issuesErrorMessage = '';
    updateIssueActionType(issueId, actionType);
  }

  function normalizeIssueRecord(issue) {
    return {
      ...issue,
      id: String(issue?.id || ''),
      status: String(issue?.status || 'open'),
      entryRefs: Array.isArray(issue?.entryRefs) ? issue.entryRefs : [],
      actions: Array.isArray(issue?.actions) ? issue.actions : [],
      timeline: Array.isArray(issue?.timeline) ? issue.timeline : []
    };
  }

  function applyIssueMutation(result, options = {}) {
    const normalizedIssue = result?.issue ? normalizeIssueRecord(result.issue) : null;
    const shouldPrepend = options.prepend === true;

    if (normalizedIssue) {
      const existingIndex = issueLogs.findIndex((issue) => String(issue?.id || '') === normalizedIssue.id);
      const nextIssues = [...issueLogs];

      if (existingIndex === -1) {
        if (shouldPrepend) {
          nextIssues.unshift(normalizedIssue);
        } else {
          nextIssues.push(normalizedIssue);
        }
      } else {
        nextIssues[existingIndex] = normalizedIssue;
      }

      issueLogs = nextIssues;
    }

    issuesRevision = Number(result?.revision || issuesRevision);
    issuesUpdatedAt = String(result?.updatedAt || issuesUpdatedAt || '');
    issuesUpdatedBy = String(result?.updatedBy || issuesUpdatedBy || '');
    issuesLoadedForSession = true;
    setIssueActionMaps(issueLogs);
  }

  function getIssueStatusBadgeClass(statusValue) {
    const normalized = String(statusValue || '').toLowerCase();
    if (normalized === 'open') {
      return 'text-bg-danger';
    }
    if (normalized === 'in-progress') {
      return 'text-bg-warning';
    }
    if (normalized === 'resolved') {
      return 'text-bg-success';
    }
    if (normalized === 'closed') {
      return 'text-bg-secondary';
    }
    return 'text-bg-light';
  }

  function getIssueActionButtonClass(actionType) {
    if (actionType === 'comment') {
      return 'btn-outline-secondary';
    }
    if (actionType === 'follow-up') {
      return 'btn-outline-primary';
    }
    if (actionType === 'resolve') {
      return 'btn-outline-success';
    }
    if (actionType === 'close') {
      return 'btn-outline-dark';
    }
    return 'btn-outline-secondary';
  }

  function getTimelineEventClass(eventType) {
    const normalized = String(eventType || '').toLowerCase();
    if (normalized === 'created') {
      return 'issue-timeline-event-created';
    }
    if (normalized === 'updated') {
      return 'issue-timeline-event-updated';
    }
    if (normalized === 'action-added' || normalized === 'action-updated') {
      return 'issue-timeline-event-action';
    }
    return '';
  }

  function setIssueEnvelopeState(result) {
    const issues = Array.isArray(result?.issues) ? result.issues : [];
    issueLogs = issues;
    issuesRevision = Number(result?.revision || 0);
    issuesUpdatedAt = String(result?.updatedAt || '');
    issuesUpdatedBy = String(result?.updatedBy || '');
    setIssueActionMaps(issues);
  }

  async function resolveIssueApiContext(interactive = false) {
    let apiBase = getSavedApiBase();
    if (!apiBase && interactive) {
      apiBase = await ensureApiBaseInteractive();
    }
    if (!apiBase) {
      return null;
    }

    let secret = sessionStorage.getItem('publishApiSecret') || '';
    if (!secret && interactive) {
      secret = await ensureSecretInteractive();
    }
    if (!secret) {
      return null;
    }

    return { apiBase, secret };
  }

  async function loadIssueLogs(options = {}) {
    if (!$isAdmin) {
      return false;
    }

    const interactive = options.interactive === true;
    const silent = options.silent === true;
    if (issuesLoading) {
      return false;
    }

    const issueApiContext = await resolveIssueApiContext(interactive);
    if (!issueApiContext) {
      if (!silent) {
        issuesErrorMessage = 'Issue log endpoint or secret is not configured.';
      }
      return false;
    }

    issuesLoading = true;
    issuesErrorMessage = '';
    if (!silent) {
      issuesStatusMessage = 'Loading issue logs...';
    }

    try {
      const response = await fetch(endpointFromBase(issueApiContext.apiBase, '/issues/load'), {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify({ _secret: issueApiContext.secret })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        throw new Error(result?.error || `HTTP ${response.status}`);
      }

      setIssueEnvelopeState(result);
      issuesStatusMessage = `Issue logs loaded (${issueLogs.length}).`;
      issuesLoadedForSession = true;
      return true;
    } catch (error) {
      issuesErrorMessage = error instanceof Error ? error.message : 'Failed to load issue logs.';
      return false;
    } finally {
      issuesLoading = false;
    }
  }

  async function createIssueLog() {
    if (!$isAdmin) {
      return;
    }

    const title = newIssueTitle.trim();
    if (!title) {
      issuesErrorMessage = 'Issue title is required.';
      return;
    }

    const issueApiContext = await resolveIssueApiContext(true);
    if (!issueApiContext) {
      issuesErrorMessage = 'Issue log endpoint or secret is not configured.';
      return;
    }

    issuesLoading = true;
    issuesErrorMessage = '';
    try {
      const response = await fetch(endpointFromBase(issueApiContext.apiBase, '/issues/create'), {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify({
          _secret: issueApiContext.secret,
          actor: getPublisherName() || 'admin',
          issue: {
            title,
            description: newIssueDescription,
            status: 'open',
            entryRefs: parseEntryRefsInput(newIssueRefsInput)
          }
        })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        throw new Error(result?.error || `HTTP ${response.status}`);
      }

      applyIssueMutation(result, { prepend: true });
      newIssueTitle = '';
      newIssueDescription = '';
      newIssueRefsInput = '';
      issuesStatusMessage = 'Issue created.';
    } catch (error) {
      issuesErrorMessage = error instanceof Error ? error.message : 'Failed to create issue.';
    } finally {
      issuesLoading = false;
    }
  }

  async function submitIssueAction(issue, actionType) {
    const issueId = String(issue?.id || '');
    if (!issueId) {
      return;
    }

    if (issueIsTerminal(issue?.status) && actionType !== 'comment') {
      issuesErrorMessage = 'Only comment action is allowed for closed or resolved issues.';
      return;
    }

    const actionText = String(issueActionInputById[issueId] || '').trim();
    if (!actionText) {
      issuesErrorMessage = 'Action text is required.';
      return;
    }

    const issueApiContext = await resolveIssueApiContext(true);
    if (!issueApiContext) {
      issuesErrorMessage = 'Issue log endpoint or secret is not configured.';
      return;
    }

    issuesLoading = true;
    issuesErrorMessage = '';
    try {
      const response = await fetch(endpointFromBase(issueApiContext.apiBase, '/issues/add-action'), {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify({
          _secret: issueApiContext.secret,
          actor: getPublisherName() || 'admin',
          issueId,
          action: {
            text: `[${actionType}] ${actionText}`,
            status: 'done'
          }
        })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        throw new Error(result?.error || `HTTP ${response.status}`);
      }

      let latestResult = result;

      const nextStatus = getIssueStatusFromAction(actionType);
      if (nextStatus && nextStatus !== String(issue?.status || '').toLowerCase()) {
        const updateResponse = await fetch(endpointFromBase(issueApiContext.apiBase, '/issues/update'), {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain'
          },
          body: JSON.stringify({
            _secret: issueApiContext.secret,
            actor: getPublisherName() || 'admin',
            issueId,
            patch: {
              status: nextStatus
            }
          })
        });

        const updateResult = await updateResponse.json().catch(() => ({}));
        if (!updateResponse.ok || !updateResult.ok) {
          throw new Error(updateResult?.error || `HTTP ${updateResponse.status}`);
        }

        latestResult = updateResult;
      }

      applyIssueMutation(latestResult);
      updateIssueActionInput(issueId, '');
      updateIssueActionType(issueId, '');
      issuesStatusMessage = `Action ${actionType} added to ${issueId}.`;
    } catch (error) {
      issuesErrorMessage = error instanceof Error ? error.message : 'Failed to add action.';
    } finally {
      issuesLoading = false;
    }
  }

  let currentEntryIssues = $derived.by(() => {
    const context = getCurrentEntryContext();
    if (!context) {
      return [];
    }

    return issueLogs.filter((issue) => {
      const status = String(issue?.status || '').toLowerCase();
      if (!showResolvedClosedInPanel && (status === 'resolved' || status === 'closed')) {
        return false;
      }

      return (
        Array.isArray(issue?.entryRefs) &&
        issue.entryRefs.some((ref) => ref?.type === context.entryType && Number(ref?.id) === context.entryId)
      );
    });
  });

  let generalIssues = $derived.by(() => {
    return issueLogs.filter((issue) => {
      const status = String(issue?.status || '').toLowerCase();
      if (!showResolvedClosedInPanel && (status === 'resolved' || status === 'closed')) {
        return false;
      }

      return !Array.isArray(issue?.entryRefs) || issue.entryRefs.length === 0;
    });
  });

  async function beginRemoteEditSession() {
    if (!$isAdmin) {
      isEditMode.set(true);
      return;
    }

    if (draftLoadInProgress) {
      return;
    }

    const apiBase = await ensureApiBaseInteractive();
    if (!apiBase) {
      return;
    }

    const secret = await ensureSecretInteractive();
    if (!secret) {
      return;
    }

    draftLoadInProgress = true;
    draftStatusMessage = 'Loading remote draft...';

    try {
      const response = await fetch(endpointFromBase(apiBase, '/draft/load'), {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify({ _secret: secret })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        const details = result?.details ? `\n\nDetails: ${result.details}` : '';
        throw new Error((result?.error || `HTTP ${response.status}`) + details);
      }

      suppressDraftAutosave = true;
      if (result.exists && result.editedJSON) {
        editedJSON.set(deepCloneJSON(result.editedJSON));
        draftRevision = Number(result.revision || 0);
        draftLastUpdatedAt = result.updatedAt || '';
        draftLastUpdatedBy = result.updatedBy || '';
        draftStatusMessage = `Remote draft loaded (rev ${draftRevision}).`;
      } else {
        editedJSON.set(deepCloneJSON(initialJSON));
        draftRevision = 0;
        draftLastUpdatedAt = '';
        draftLastUpdatedBy = '';
        draftStatusMessage = 'No remote draft found. Started a new draft from published content.';
      }

      draftReady = true;
      isEditMode.set(true);
      queueMicrotask(() => {
        suppressDraftAutosave = false;
      });
    } catch (error) {
      draftStatusMessage = 'Failed to load remote draft.';
      alert(`Failed to load remote draft: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      draftLoadInProgress = false;
    }
  }

  function clearDraftAutosaveTimer() {
    if (draftAutosaveTimer) {
      clearTimeout(draftAutosaveTimer);
      draftAutosaveTimer = null;
    }
  }

  function scheduleDraftAutosave() {
    if (typeof window === 'undefined' || !$isAdmin || !$isEditMode || !draftReady || suppressDraftAutosave) {
      return;
    }

    clearDraftAutosaveTimer();
    draftAutosaveTimer = window.setTimeout(() => {
      void saveRemoteDraft('autosave', { interactive: false, showAlertOnError: false });
    }, draftEditSaveDelayMs);
  }

  async function saveRemoteDraft(reason = 'autosave', options = {}) {
    if (!$isAdmin || !$isEditMode || !draftReady) {
      return false;
    }

    if (draftSaveInProgress && reason === 'autosave') {
      pendingDraftAutosave = true;
      return false;
    }

    const interactive = options.interactive === true;
    const showAlertOnError = options.showAlertOnError === true;

    let saveEndpoint = getDraftSaveEndpoint();
    if (!saveEndpoint && interactive) {
      const apiBase = await ensureApiBaseInteractive();
      if (apiBase) {
        saveEndpoint = endpointFromBase(apiBase, '/draft/save');
      }
    }

    if (!saveEndpoint) {
      draftStatusMessage = 'Draft save skipped: publish API endpoint is not configured.';
      return false;
    }

    let secret = sessionStorage.getItem('publishApiSecret') || '';
    if (!secret && interactive) {
      secret = await ensureSecretInteractive();
    }

    if (!secret) {
      draftStatusMessage = 'Draft save skipped: publish API secret is not configured.';
      return false;
    }

    draftSaveInProgress = true;
    if (reason !== 'autosave') {
      draftStatusMessage = 'Saving remote draft...';
    }

    try {
      const editorId = getPublisherName() || 'admin-editor';
      const response = await fetch(saveEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify({
          _secret: secret,
          editedJSON: $editedJSON,
          expectedRevision: draftRevision,
          editorId
        })
      });

      const result = await response.json().catch(() => ({}));
      if (response.status === 409 || result?.code === 'REVISION_CONFLICT') {
        draftStatusMessage = `Remote draft conflict. Latest is rev ${result?.currentRevision ?? 'unknown'} by ${result?.updatedBy || 'another user'}. Reload edit mode to continue.`;
        return false;
      }

      if (!response.ok || !result.ok) {
        const details = result?.details ? `\n\nDetails: ${result.details}` : '';
        throw new Error((result?.error || `HTTP ${response.status}`) + details);
      }

      draftRevision = Number(result.revision || draftRevision);
      draftLastUpdatedAt = result.updatedAt || '';
      draftLastUpdatedBy = result.updatedBy || editorId;
      draftStatusMessage = `Remote draft saved (rev ${draftRevision}).`;
      return true;
    } catch (error) {
      draftStatusMessage = 'Remote draft save failed.';
      if (showAlertOnError) {
        alert(`Failed to save remote draft: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      return false;
    } finally {
      draftSaveInProgress = false;
      if (pendingDraftAutosave) {
        pendingDraftAutosave = false;
        scheduleDraftAutosave();
      }
    }
  }

  async function saveDraftNowListener() {
    await saveRemoteDraft('manual', { interactive: true, showAlertOnError: true });
  }

  async function publishChangesListener() {
    if (publishInProgress) {
      return;
    }

    if (!$isAdmin) {
      alert('Admin access is required to publish changes.');
      return;
    }

    const apiBase = await ensureApiBaseInteractive();
    if (!apiBase) {
      return;
    }

    const secretInput = await ensureSecretInteractive();
    if (!secretInput) {
      return;
    }

    const existingPublisherName = localStorage.getItem('publishAdminName') || '';
    const publisherNameInput = window.prompt(
      'Input your name (required for publish log):',
      existingPublisherName
    );

    if (publisherNameInput === null) {
      return;
    }

    const publisherName = publisherNameInput.trim();
    if (!publisherName) {
      alert('Your name is required to publish the site.');
      return;
    }

    localStorage.setItem('publishAdminName', publisherName);

    const publishSummaryInput = window.prompt('Describe this publish (optional, press Cancel to skip):', '');
    const publishSummary = publishSummaryInput !== null ? publishSummaryInput.trim() : '';

    if (!window.confirm('Publish the current remote draft to GitHub Actions?')) {
      return;
    }

    const manualSaveOk = await saveRemoteDraft('pre-publish', { interactive: false, showAlertOnError: true });
    if (!manualSaveOk) {
      alert('Publish stopped because the latest draft could not be saved to remote storage.');
      return;
    }

    publishInProgress = true;
    publishStatusMessage = 'Publishing...';

    try {
      const response = await fetch(endpointFromBase(apiBase, '/publish'), {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify({
          _secret: secretInput,
          adminId: publisherName,
          publishSummary,
          commitMessage: `chore: publish remote draft (${new Date().toISOString()})`
        })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.ok) {
        const details = result?.details ? `\n\nDetails: ${result.details}` : '';
        throw new Error((result?.error || `HTTP ${response.status}`) + details);
      }

      publishStatusMessage = 'Publish started.';
      publishActionsUrl = result.actionsUrl || '';
      await refreshSyncStatus();
    } catch (error) {
      publishStatusMessage = 'Publish failed.';
      publishActionsUrl = '';
      alert(`Publish failed: ${error instanceof Error ? error.message : 'Unknown error'}`); 
    } finally {
      publishInProgress = false;
    }
  }

  onMount(async () => {
    adminLoginName = localStorage.getItem('publishAdminName') || '';
    adminLoginSecret = sessionStorage.getItem('publishApiSecret') || '';
    adminLoginApiUrl = localStorage.getItem('publishApiUrl') || defaultPublishEndpoint;
    draftStoreUnsubscribe = editedJSON.subscribe(() => {
      if (!hasObservedInitialDraftValue) {
        hasObservedInitialDraftValue = true;
        return;
      }

      if (suppressDraftAutosave) {
        return;
      }

      scheduleDraftAutosave();
    });
    syncCheckEnabled = isSyncCheckHostEnabled();
    await refreshSyncStatus();
    startSyncPolling();
  });

  $effect(() => {
    if (!$isAdmin || issuesLoadedForSession) {
      return;
    }

    void loadIssueLogs({ silent: true, interactive: false });
  });

  onDestroy(() => {
    stopSyncPolling();
    clearDraftAutosaveTimer();
    if (draftStoreUnsubscribe) {
      draftStoreUnsubscribe();
      draftStoreUnsubscribe = null;
    }
  });

  let searchResultsDetails = $derived.by(() => {
    const keyword = (searchInput || '').trim();

    // If no keyword is provided, show all filtered entries in alphabetical order
    if (!keyword) {
      const allEntries = $isAdmin
        ? index_document($editedJSON, selectedType, selectedCategory)
        : public_index_document(selectedType, selectedCategory);

      const filteredEntries = $isAdmin
        ? allEntries.filter((entry) => matchesAdminFilters(entry))
        : allEntries;

      return [...filteredEntries].sort((a, b) =>
        (a.full_name || '').localeCompare((b.full_name || ''), undefined, { sensitivity: 'base' })
      );
    }

    const searchResults = idx.search(keyword);

    const mappedResults = searchResults.map(result => {
      const resultType = result.ref.split('/')[0]; 
      const foundItem = indexData[resultType+"s"].find(item => item.id === result.ref);
      if (!foundItem) {
        return null;
      }

      const synonymTokens = Object.keys(result.matchData.metadata).filter(
        token => 'synonyms' in result.matchData.metadata[token]
      );
      let matchedSynonym = null;
      if (synonymTokens.length > 0 && Array.isArray(foundItem.synonymsList) && foundItem.synonymsList.length > 0) {
        matchedSynonym = foundItem.synonymsList.find(syn =>
          synonymTokens.some(token => syn.toLowerCase().includes(token.toLowerCase()))
        ) || null;
      }

      return {
        ...foundItem,
        score: result.score,
        matchedSynonym
      };
    });

    const validResults = mappedResults.filter((result) => result !== null);

    return $isAdmin
      ? validResults.filter((entry) => matchesAdminFilters(entry))
      : validResults;
  });

  function flattenForCell(value) {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => flattenForCell(item))
        .filter((item) => item)
        .join('; ');
    }

    if (typeof value === 'object') {
      return Object.values(value)
        .map((item) => flattenForCell(item))
        .filter((item) => item)
        .join('; ');
    }

    return '';
  }

  function editorJsFieldToText(fieldValue) {
    if (!fieldValue) {
      return '';
    }

    if (Array.isArray(fieldValue.blocks)) {
      return fieldValue.blocks
        .map((block) => {
          const blockText = flattenForCell(block?.data);
          return blockText || block?.type || '';
        })
        .filter((item) => item)
        .join('\n');
    }

    return flattenForCell(fieldValue);
  }

  function buildEntrySheetRows(entries, preferredHeaders) {
    const headerSet = new Set(preferredHeaders);

    entries.forEach((entry) => {
      Object.keys(entry || {}).forEach((key) => headerSet.add(key));
    });

    const headers = [...headerSet];

    return entries.map((entry) => {
      const row = {};

      headers.forEach((header) => {
        const rawValue = entry?.[header];

        if (header === 'id' || header === 'refId') {
          row[header] = rawValue ?? '';
          return;
        }

        if (header === 'is_hidden') {
          row[header] = rawValue === true;
          return;
        }

        row[header] = editorJsFieldToText(rawValue);
      });

      return row;
    });
  }

  async function exportReviewExcelListener() {
    if (!$isAdmin) {
      return;
    }

    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();

      const testsRows = buildEntrySheetRows($editedJSON.testData || [], [
        'id',
        'refId',
        'is_hidden',
        'full_name',
        'GCRS_name',
        'label_name',
        'synonyms',
        'lab_and_category',
        'alert',
        'requirement',
        'container',
        'form',
        'indication',
        'turn_around_time',
        'test_handling'
      ]);

      const formsRows = buildEntrySheetRows($editedJSON.formData || [], [
        'id',
        'refId',
        'is_hidden',
        'form_name',
        'form_code',
        'remark',
        'form_link',
        'form_external_link',
        'lab_and_category'
      ]);

      const containersRows = buildEntrySheetRows($editedJSON.containerData || [], [
        'id',
        'refId',
        'is_hidden',
        'name',
        'code',
        'remark',
        'imageSrc',
        'synonyms'
      ]);

      const editTraceRows = ($editedJSON.config?.editTrace || []).map((trace) => ({
        timestamp: trace?.timestamp || '',
        dataType: trace?.dataType || '',
        dataId: trace?.dataId || '',
        refId: trace?.refId || '',
        editType: trace?.editType || '',
        field: trace?.field || '',
        originalValue: flattenForCell(trace?.originalValue),
        newValue: flattenForCell(trace?.newValue)
      }));

      const summaryRows = [
        { metric: 'Tests', count: ($editedJSON.testData || []).length },
        { metric: 'Forms', count: ($editedJSON.formData || []).length },
        { metric: 'Containers', count: ($editedJSON.containerData || []).length },
        { metric: 'Edit Trace Records', count: ($editedJSON.config?.editTrace || []).length },
        { metric: 'Generated At', count: new Date().toISOString() }
      ];

      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Summary');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(testsRows), 'Tests');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(formsRows), 'Forms');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(containersRows), 'Containers');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(editTraceRows), 'EditTrace');

      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      XLSX.writeFile(workbook, `review-export-${stamp}.xlsx`);
    } catch (error) {
      alert(`Failed to export review workbook: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }


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

    const exportReviewExcelButton = document.getElementById("exportReviewExcelButton");
    if (exportReviewExcelButton) {
      exportReviewExcelButton.addEventListener("click", exportReviewExcelListener);
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

  function hideEntryListener() {
    if (!$isEditMode) {
      return;
    }

    const pathSegments = page.url.pathname.split('/');
    const entryType = pathSegments[pathSegments.length - 2];
    const entryId = parseInt(pathSegments[pathSegments.length - 1]);

    if (entryType !== 'test' && entryType !== 'form' && entryType !== 'container') {
      alert('Hide failed. Please ensure you are on a valid test, form, or container page.');
      return;
    }

    const dataType = `${entryType}Data`;
    const dataTypeKey = `${entryType}Data`;

    const thisEntry = $editedJSON[dataTypeKey].find((entry) => entry.id === entryId);
    if (!thisEntry) {
      alert('Hide failed. Entry was not found in the current draft.');
      return;
    }

    const currentlyHidden = thisEntry.is_hidden === true;
    const willHide = !currentlyHidden;

    const isNewEntry = $editedJSON.config.editTrace.some((trace) =>
      trace.dataType === dataType &&
      trace.dataId === entryId &&
      trace.editType === 'add'
    );

    if (willHide && isNewEntry) {
      alert('New entries cannot be hidden before publish.');
      return;
    }

    if (!window.confirm(`${willHide ? 'Hide' : 'Unhide'} this ${entryType} entry (ID: ${entryId})?`)) {
      return;
    }

    editedJSON.update((draft) => {
      const target = draft[dataTypeKey].find((entry) => entry.id === entryId);
      if (target) {
        target.is_hidden = willHide;
      }
      return draft;
    });

    updateEditTrace(dataType, entryId, thisEntry.refId || null, willHide ? 'hide' : 'unhide', 'is_hidden', currentlyHidden, willHide);
  }

  function getCurrentEntryContext() {
    const pathSegments = page.url.pathname.split('/').filter(Boolean);
    const entryType = pathSegments[pathSegments.length - 2];
    const entryId = parseInt(pathSegments[pathSegments.length - 1], 10);

    if (
      Number.isNaN(entryId) ||
      (entryType !== 'test' && entryType !== 'form' && entryType !== 'container')
    ) {
      return null;
    }

    return { entryType, entryId };
  }

  function getEntryListByType(entryType) {
    if (entryType === 'test') {
      return Array.isArray($editedJSON.testData) ? $editedJSON.testData : [];
    }

    if (entryType === 'form') {
      return Array.isArray($editedJSON.formData) ? $editedJSON.formData : [];
    }

    if (entryType === 'container') {
      return Array.isArray($editedJSON.containerData) ? $editedJSON.containerData : [];
    }

    return [];
  }

  function findAdjacentExistingId(entryType, currentId, direction) {
    const entries = getEntryListByType(entryType);
    if (!entries.length) {
      return null;
    }

    const ids = entries
      .map((entry) => Number(entry?.id))
      .filter((id) => Number.isFinite(id))
      .sort((left, right) => left - right);

    if (!ids.length) {
      return null;
    }

    if (direction === 'next') {
      return ids.find((id) => id > currentId) ?? null;
    }

    for (let index = ids.length - 1; index >= 0; index -= 1) {
      if (ids[index] < currentId) {
        return ids[index];
      }
    }

    return null;
  }

  function goToAdjacentExistingEntry(direction) {
    const context = getCurrentEntryContext();
    if (!context) {
      return; // not on an entry page, silently do nothing
    }

    const targetId = findAdjacentExistingId(context.entryType, context.entryId, direction);
    if (targetId === null) {
      if ($isAdmin) {
        if (direction === 'next') {
          alert('No higher existing ID was found in the current edited JSON.');
        } else {
          alert('No lower existing ID was found in the current edited JSON.');
        }
      }
      return;
    }

    goto(`${base}/${context.entryType}/${targetId}`);
  }

  function goToNextEntryIdListener() {
    goToAdjacentExistingEntry('next');
  }

  function goToPreviousEntryIdListener() {
    goToAdjacentExistingEntry('previous');
  }

  function goToIdListener() {
    const id = parseInt(String(goToIdInput).trim(), 10);
    if (!Number.isFinite(id) || id <= 0) {
      return;
    }
    goToIdInput = '';
    goto(`${base}/test/${id}`);
  }

</script>

<!-- NavBar -->
<div class="container">
  <header class="d-flex flex-wrap justify-content-center py-3 mb-4 border-bottom">
    <a href="{base}/" class="d-flex align-items-center mb-3 mb-md-0 me-md-auto text-dark text-decoration-none">
      <svg class="bi me-2" width="40" height="32"><use xlink:href="#bootstrap"></use></svg>
      <span class="fs-4">CMC e-Lab manual</span>
    </a>

    <ul class="nav nav-pills">
      <li class="nav-item"><a href="{base}/" class="nav-link active" aria-current="page">Home</a></li>

      <li class="nav-item ms-2 d-flex align-items-center">
        <div class="input-group input-group-sm">
          <input
            type="number"
            class="form-control form-control-sm"
            style="width: 70px;"
            placeholder="ID"
            bind:value={goToIdInput}
            onkeydown={(e) => { if (e.key === 'Enter') goToIdListener(); }}
            aria-label="Go to test ID"
          />
          <button class="btn btn-outline-secondary btn-sm" type="button" onclick={goToIdListener}>Go</button>
        </div>
      </li>

      <li class="nav-item ms-1 d-flex align-items-center">
        <div class="btn-group btn-group-sm">
          <button type="button" class="btn btn-outline-secondary" onclick={goToPreviousEntryIdListener} title="Previous existing entry">&#8592; Prev</button>
          <button type="button" class="btn btn-outline-secondary" onclick={goToNextEntryIdListener} title="Next existing entry">Next &#8594;</button>
        </div>
      </li>

      {#if !$isAdmin && !$isStaff}
      <li class="nav-item ms-2 d-flex align-items-center">
        <button type="button" class="btn btn-outline-secondary btn-sm" onclick={openStaffLogin}>Staff login</button>
      </li>
      {/if}

      {#if $isStaff && !$isAdmin}
      <li class="nav-item ms-2 d-flex align-items-center">
        <button type="button" class="btn btn-outline-primary btn-sm" onclick={openAdminLogin}>Admin login</button>
      </li>
      {/if}

      {#if $isEditMode}
      <li class="nav-item ms-2 nav-tools-wrapper">
        <details class="nav-tools">
          <summary class="nav-link">Entry Tools</summary>
          <div class="nav-tools-menu">
            <button id="newTestButton" type="button" onclick={newTestListener} class="btn btn-outline-secondary btn-sm w-100 mb-1">New Test</button>
            <button id="newFormButton" type="button" onclick={newFormListener} class="btn btn-outline-secondary btn-sm w-100 mb-1">New Form</button>
            <button id="newContainerButton" type="button" onclick={newContainerListener} class="btn btn-outline-secondary btn-sm w-100 mb-1">New Container</button>
            <button id="hideEntryButton" type="button" onclick={hideEntryListener} class="btn btn-outline-secondary btn-sm w-100 mb-1">Hide/Unhide Current Entry</button>
            <button id="removeContainerButton" type="button" onclick={removeEntryListener} class="btn btn-outline-danger btn-sm w-100">Remove Current Entry</button>
          </div>
        </details>
      </li>
      {/if}
      
      {#if $isAdmin}
      <li class="nav-item ms-2 d-flex align-items-center">
        <span class="badge text-bg-primary">Admin: {getPublisherName() || 'signed in'}</span>
      </li>
      <li class="nav-item ms-2 d-flex align-items-center">
        <button type="button" class="btn btn-outline-info btn-sm" onclick={() => issuesPanelOpen = true}>Issues Panel</button>
      </li>
      <li class="nav-item"><a href="{base}/issues" class="nav-link active ms-2">Issues</a></li>
      <li class="nav-item ms-2 nav-tools-wrapper">
        <details class="nav-tools">
          <summary class="nav-link active">Admin Tools</summary>
          <div class="nav-tools-menu">
            <button id="exportButton" type="button" class="btn btn-outline-secondary btn-sm w-100 mb-1">Save Changes</button>
            <button id="exportReviewExcelButton" type="button" class="btn btn-outline-secondary btn-sm w-100 mb-1">Export Review Excel</button>
            <button type="button" class="btn btn-outline-secondary btn-sm w-100 mb-1" onclick={saveDraftNowListener} disabled={draftSaveInProgress || draftLoadInProgress || !$isEditMode}>{draftSaveInProgress ? 'Saving Draft...' : 'Save Remote Draft'}</button>
            <button type="button" class="btn btn-outline-secondary btn-sm w-100 mb-1" onclick={publishChangesListener} disabled={publishInProgress || draftLoadInProgress || !$isEditMode}>{publishInProgress ? 'Publishing...' : 'Publish Site'}</button>
            {#if syncCheckEnabled}
            <button type="button" class="btn btn-outline-secondary btn-sm w-100 mb-1" onclick={configurePredeployVersionUrl}>Set Pre-deploy URL</button>
            {/if}
            <button type="button" class="btn btn-outline-secondary btn-sm w-100 mb-1" onclick={goToPreviousEntryIdListener}>Previous ID</button>
            <button type="button" class="btn btn-outline-secondary btn-sm w-100" onclick={goToNextEntryIdListener}>Next ID</button>
          </div>
        </details>
      </li>
      {#if syncCheckEnabled}
      <li class="nav-item ms-2 d-flex align-items-center">
        {#if syncStatus === 'in-sync'}
          <span class="badge text-bg-success">insync</span>
        {:else if syncStatus === 'out-of-sync'}
          <span class="badge text-bg-danger">out of sync</span>
        {:else if syncStatus === 'checking'}
          <span class="badge text-bg-secondary">checking sync</span>
        {:else if syncStatus === 'unknown'}
          <span class="badge text-bg-warning">sync unknown</span>
        {/if}
      </li>
      {/if}
      <li class="nav-item"><a href="{base}/dashboard" class="nav-link active ms-2">Dashboard</a></li>
      {/if}
      {#if $isStaff && !$isAdmin}
      <li class="nav-item ms-2 d-flex align-items-center">
        <span class="badge text-bg-secondary">Staff mode</span>
      </li>
      {/if}
      {#if $isAdmin || $isStaff}
      <li class="nav-item ms-2 d-flex align-items-center">
        <button type="button" class="btn btn-outline-danger btn-sm" onclick={logoutUser}>Logout</button>
      </li>
      {/if}
      
    </ul>
  </header>
  {#if showAdminLogin}
  <div class="card border-primary mb-2">
    <div class="card-body py-3">
      <div class="row g-2 align-items-end">
        <div class="col-md-3">
          <label class="form-label form-label-sm mb-1" for="admin-display-name">Display name</label>
          <input id="admin-display-name" class="form-control form-control-sm" bind:value={adminLoginName} placeholder="Your name">
        </div>
        <div class="col-md-4">
          <label class="form-label form-label-sm mb-1" for="admin-shared-token">Shared token</label>
          <input id="admin-shared-token" class="form-control form-control-sm" bind:value={adminLoginSecret} type="password" placeholder="Worker shared token">
        </div>
        <div class="col-md-3">
          <label class="form-label form-label-sm mb-1" for="admin-api-url">Publish API URL</label>
          <input id="admin-api-url" class="form-control form-control-sm" bind:value={adminLoginApiUrl} placeholder={defaultPublishEndpoint}>
        </div>
        <div class="col-md-2 d-flex gap-2">
          <button type="button" class="btn btn-primary btn-sm w-100" onclick={submitAdminLogin} disabled={adminLoginInProgress}>{adminLoginInProgress ? 'Signing in...' : 'Sign in'}</button>
          <button type="button" class="btn btn-outline-secondary btn-sm" onclick={closeAdminLogin}>Cancel</button>
        </div>
      </div>
      {#if adminLoginError}
      <div class="small text-danger mt-2">{adminLoginError}</div>
      {/if}
    </div>
  </div>
  {/if}
  {#if showStaffLogin}
  <div class="card border-secondary mb-2">
    <div class="card-body py-3">
      <div class="row g-2 align-items-end">
        <div class="col-md-6">
          <label class="form-label form-label-sm mb-1" for="staff-passkey">Staff passkey</label>
          <input id="staff-passkey" class="form-control form-control-sm" bind:value={staffLoginPasskey} type="password" placeholder="Staff passkey">
        </div>
        <div class="col-md-3 d-flex gap-2">
          <button type="button" class="btn btn-secondary btn-sm w-100" onclick={submitStaffLogin} disabled={staffLoginInProgress}>{staffLoginInProgress ? 'Signing in...' : 'Sign in'}</button>
          <button type="button" class="btn btn-outline-secondary btn-sm" onclick={closeStaffLogin}>Cancel</button>
        </div>
      </div>
      {#if staffLoginError}
      <div class="small text-danger mt-2">{staffLoginError}</div>
      {/if}
    </div>
  </div>
  {/if}
  {#if draftStatusMessage}
  <div class="small text-muted mb-1">
    {draftStatusMessage}
    {#if draftLastUpdatedAt}
      ({draftLastUpdatedBy || 'unknown'} at {draftLastUpdatedAt})
    {/if}
  </div>
  {/if}
  {#if publishStatusMessage}
  <div class="small text-muted mb-2">
    {publishStatusMessage}
    {#if publishActionsUrl}
      — <a href={publishActionsUrl} target="_blank" rel="noopener noreferrer">View workflow run</a>
    {/if}
  </div>
  {/if}
  {#if $isAdmin && syncCheckEnabled && syncStatus === 'out-of-sync'}
  <div class="alert alert-warning py-2 px-3 mb-2 small d-flex justify-content-between align-items-center flex-wrap gap-2">
    <span>Please download and deploy latest build. Pre-deployment version {predeployVersion?.versionId || 'unknown'} does not match production {productionVersion?.versionId || 'unknown'}.</span>
    {#if predeployVersion?.buildRunUrl}
      <a class="btn btn-sm btn-outline-dark" href={predeployVersion.buildRunUrl} target="_blank" rel="noopener noreferrer">Download Latest Build</a>
    {/if}
  </div>
  {/if}

  {#if $isAdmin}
  {#if issuesPanelOpen}
  <button type="button" class="issues-drawer-backdrop" onclick={() => issuesPanelOpen = false} aria-label="Close issues panel"></button>
  {/if}
  <aside class="issues-drawer" class:open={issuesPanelOpen}>
    <div class="issues-drawer-header">
      <h6 class="mb-0">Issue Log</h6>
      <div class="d-flex gap-2">
        <button type="button" class="btn btn-outline-secondary btn-sm" onclick={() => loadIssueLogs({ interactive: true })} disabled={issuesLoading}>{issuesLoading ? 'Loading...' : 'Refresh'}</button>
        <button type="button" class="btn btn-outline-danger btn-sm" onclick={() => issuesPanelOpen = false}>Close</button>
      </div>
    </div>

    {#if issuesStatusMessage}
    <div class="small text-muted mb-1">{issuesStatusMessage}</div>
    {/if}
    {#if issuesUpdatedAt}
    <div class="small text-muted mb-1">Updated by {issuesUpdatedBy || 'unknown'} at {issuesUpdatedAt}</div>
    {/if}
    {#if issuesErrorMessage}
    <div class="small text-danger mb-2">{issuesErrorMessage}</div>
    {/if}

    <div class="border rounded p-2 mb-3 bg-light-subtle">
      <div class="fw-semibold mb-2">Create issue</div>
      <div class="row g-2">
        <div class="col-md-6">
          <input class="form-control form-control-sm" bind:value={newIssueTitle} placeholder="Issue title">
        </div>
        <div class="col-md-4">
          <input class="form-control form-control-sm" bind:value={newIssueRefsInput} placeholder="Refs: test/12, form/7">
        </div>
        <div class="col-md-2 d-grid">
          <button type="button" class="btn btn-sm btn-info" onclick={createIssueLog} disabled={issuesLoading}>Add</button>
        </div>
        <div class="col-12">
          <textarea class="form-control form-control-sm" bind:value={newIssueDescription} rows="2" placeholder="Issue description"></textarea>
        </div>
      </div>
    </div>

    <div class="form-check mb-2">
      <input id="panel-show-resolved-closed" class="form-check-input" type="checkbox" bind:checked={showResolvedClosedInPanel}>
      <label class="form-check-label small" for="panel-show-resolved-closed">Show resolved and closed issues</label>
    </div>

    {#if currentEntryIssues.length > 0}
    <div class="mb-3">
      <div class="fw-semibold mb-2">Current entry issues</div>
      {#each currentEntryIssues as issue}
        <div class="issue-card mb-3">
          <div class="issue-card-header">
            <div>
              <div class="issue-id">{issue.id}</div>
              <div class="fw-semibold mb-1">{issue.title || 'Untitled issue'}</div>
            </div>
            <span class="badge {getIssueStatusBadgeClass(issue.status)} issue-status-badge">{issue.status || 'open'}</span>
          </div>
          <div class="small mb-2">{issue.description || 'No description provided.'}</div>
          <div class="small text-muted mb-2">Refs: {stringifyEntryRefs(issue.entryRefs) || 'general'}</div>
          <div class="row g-2">
            <div class="col-12">
              <div class="small fw-semibold mb-1">Actions</div>
              <div class="d-flex flex-wrap gap-2 mb-2">
                <button type="button" class="btn btn-sm {getIssueActionButtonClass('comment')}" onclick={() => beginIssueAction(issue.id, 'comment', issue.status)} disabled={issuesLoading}>Comment</button>
                {#if !issueIsTerminal(issue.status)}
                <button type="button" class="btn btn-sm {getIssueActionButtonClass('follow-up')}" onclick={() => beginIssueAction(issue.id, 'follow-up', issue.status)} disabled={issuesLoading}>Follow-up</button>
                <button type="button" class="btn btn-sm {getIssueActionButtonClass('resolve')}" onclick={() => beginIssueAction(issue.id, 'resolve', issue.status)} disabled={issuesLoading}>Resolve</button>
                <button type="button" class="btn btn-sm {getIssueActionButtonClass('close')}" onclick={() => beginIssueAction(issue.id, 'close', issue.status)} disabled={issuesLoading}>Close</button>
                {/if}
              </div>

              {#if issueActionTypeById[issue.id]}
              <div class="issue-action-composer mb-2">
              <div class="small text-muted mb-1 text-capitalize">{issueActionTypeById[issue.id]} description</div>
              <textarea class="form-control form-control-sm mb-2" rows="2" value={issueActionInputById[issue.id] || ''} oninput={(e) => updateIssueActionInput(issue.id, e.currentTarget.value)} placeholder="Describe this action"></textarea>
              <div class="d-flex gap-2">
                <button type="button" class="btn btn-sm btn-primary" onclick={() => submitIssueAction(issue, issueActionTypeById[issue.id])} disabled={issuesLoading}>Submit Action</button>
                <button type="button" class="btn btn-sm btn-outline-secondary" onclick={() => updateIssueActionType(issue.id, '')} disabled={issuesLoading}>Cancel</button>
              </div>
              </div>
              {/if}

              {#if Array.isArray(issue.actions) && issue.actions.length > 0}
                <div class="issue-actions-list">
                {#each issue.actions.slice().reverse() as action}
                <div class="issue-action-row small">
                  <span class="issue-action-bullet"></span>
                  <span>{action.text}</span>
                </div>
                {/each}
                </div>
              {/if}
            </div>
            <div class="col-12">
              <div class="small fw-semibold mb-1">Timeline</div>
              <div class="issue-timeline">
                {#if Array.isArray(issue.timeline) && issue.timeline.length > 0}
                  {#each issue.timeline.slice().reverse() as event}
                  <div class="issue-timeline-event {getTimelineEventClass(event.eventType)}">
                    <div class="issue-timeline-meta">{event.actor || 'unknown'} · {event.timestamp}</div>
                    <div>{event.message || event.eventType}</div>
                  </div>
                  {/each}
                {:else}
                  <div class="small text-muted">No timeline events yet.</div>
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
    {/if}

    {#if generalIssues.length > 0}
    <div class="mb-3">
      <div class="fw-semibold mb-2">General issues</div>
      <div class="small text-muted">{generalIssues.length} general issue(s) not tied to specific entries.</div>
    </div>
    {/if}

    <div class="small text-muted">Total issues: {issueLogs.length}</div>
  </aside>
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

  {#if $isAdmin}
  <div class="input-group mb-1" style="width: 97%;">
    <span class="input-group-text" style="width: 10%;">E</span>
    <select bind:value={selectedEditType} class="form-select form-control" aria-label="Edit type filter">
      <option value="allEditTypesSelected">All Edit Types</option>
      <option value="add">New</option>
      <option value="modify">Modified</option>
      <option value="remove">Removed</option>
      <option value="hide">Hide</option>
      <option value="unhide">Unhide</option>
      <option value="noEditTypeSelected">No Edit Type</option>
    </select>
  </div>

  <div class="input-group mb-1" style="width: 97%;">
    <span class="input-group-text" style="width: 10%;">V</span>
    <select bind:value={selectedVisibility} class="form-select form-control" aria-label="Visibility filter">
      <option value="allVisibilitySelected">All Visibility</option>
      <option value="hiddenOnlySelected">Hidden Only</option>
      <option value="visibleOnlySelected">Visible Only</option>
    </select>
  </div>
  {/if}

    <!-- Search -->
    <div class="input-group" style="width: 97%;">
      <img class="input-group-text" src="{base}/search.svg" id="basic-addon1" style="width: 10%;" alt="search">
      <input bind:value={searchInput} id="search_sideBar" type="text" class="form-control" placeholder="Type in test / form name..." tabindex="0">
    </div>

    <!-- Search Results -->
    <div class="list-group list-group-flush border-bottom" style="height: calc(100vh - 230px); overflow-y: scroll">
        <!-- Display search results -->
        {#each searchResultsDetails as resultDetails}

          <a
            href="{base}/{resultDetails.id}"
            class="list-group-item list-group-item-action py-3 lh-tight"
            style="background-color: {resultDetails.hidden ? '#e2e3e5' : resultDetails.editType === 'add' ? '#d4edda' : resultDetails.editType === 'modify' ? '#fff3cd' : resultDetails.editType === 'remove' ? '#f8d7da' : resultDetails.editType === 'hide' ? '#e2e3e5' : resultDetails.editType === 'unhide' ? '#d1e7dd' : 'transparent'}"
          >
            <div 
              class="d-flex w-100 align-items-center justify-content-between">
              <strong class="mb-1">{resultDetails.id?.startsWith('test/') && resultDetails.GCRS_name ? resultDetails.GCRS_name : resultDetails.full_name}</strong>
              <div class="d-flex align-items-center gap-1">
                {#if resultDetails.editType === 'add'}
                <span class="badge text-bg-success">New</span>
                {/if}
                {#if resultDetails.editType === 'unhide'}
                <span class="badge text-bg-info">Unhide</span>
                {/if}
                {#if resultDetails.hidden}
                <span class="badge text-bg-secondary">Hidden</span>
                {/if}
              </div>
            </div>
            <div class="col-10 mb-1 small">{resultDetails.short_name}</div>
            {#if resultDetails.matchedSynonym}
            <div class="col-10 mb-1 small text-muted fst-italic">Synonym: <u>{resultDetails.matchedSynonym}</u></div>
            {/if}
          </a>
          
        {/each}
    </div>
  </div>

  <!-- Render Children -->
  {@render children()}
</div>

<style>
  .nav-tools {
    position: relative;
  }

  .nav-tools > summary {
    list-style: none;
    cursor: pointer;
  }

  .nav-tools > summary::-webkit-details-marker {
    display: none;
  }

  .nav-tools-menu {
    position: absolute;
    right: 0;
    top: calc(100% + 0.25rem);
    min-width: 230px;
    padding: 0.5rem;
    background: #fff;
    border: 1px solid #dee2e6;
    border-radius: 0.5rem;
    box-shadow: 0 0.4rem 1rem rgba(0, 0, 0, 0.12);
    z-index: 1060;
  }

  .nav-tools-wrapper {
    position: relative;
  }

  .issues-drawer-backdrop {
    position: fixed;
    inset: 0;
    border: 0;
    background: rgba(0, 0, 0, 0.25);
    z-index: 1055;
  }

  .issues-drawer {
    position: fixed;
    top: 0;
    right: 0;
    width: min(94vw, 860px);
    height: 100vh;
    padding: 1rem;
    background: #fff;
    border-left: 1px solid #dee2e6;
    box-shadow: -0.5rem 0 1.25rem rgba(0, 0, 0, 0.2);
    transform: translateX(100%);
    transition: transform 0.2s ease-in-out;
    overflow-y: auto;
    z-index: 1060;
  }

  .issues-drawer.open {
    transform: translateX(0);
  }

  .issues-drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .issue-card {
    border: 1px solid #dbe5f0;
    border-radius: 0.85rem;
    padding: 0.9rem;
    background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
    box-shadow: 0 0.35rem 1rem rgba(42, 72, 108, 0.08);
  }

  .issue-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 0.35rem;
  }

  .issue-id {
    font-size: 0.78rem;
    color: #6c757d;
    margin-bottom: 0.15rem;
  }

  .issue-status-badge {
    text-transform: capitalize;
    letter-spacing: 0.02em;
  }

  .issue-action-composer {
    padding: 0.75rem;
    border: 1px solid #d9e3f0;
    border-radius: 0.75rem;
    background: #f5f9ff;
  }

  .issue-actions-list {
    display: grid;
    gap: 0.45rem;
    margin-top: 0.75rem;
  }

  .issue-action-row {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.45rem 0.6rem;
    border-radius: 0.65rem;
    background: #f8f9fb;
    border: 1px solid #edf1f6;
  }

  .issue-action-bullet {
    width: 0.55rem;
    height: 0.55rem;
    margin-top: 0.28rem;
    border-radius: 999px;
    background: #0d6efd;
    flex: 0 0 auto;
  }

  .issue-timeline {
    display: grid;
    gap: 0.5rem;
    max-height: 14rem;
    overflow-y: auto;
    padding-right: 0.15rem;
  }

  .issue-timeline-event {
    padding: 0.55rem 0.7rem;
    border-left: 3px solid #adb5bd;
    border-radius: 0.55rem;
    background: #fafbfd;
    color: #495057;
  }

  .issue-timeline-event-created {
    border-left-color: #0d6efd;
    background: #f3f8ff;
  }

  .issue-timeline-event-updated {
    border-left-color: #fd7e14;
    background: #fff8f1;
  }

  .issue-timeline-event-action {
    border-left-color: #198754;
    background: #f3fcf6;
  }

  .issue-timeline-meta {
    font-size: 0.78rem;
    color: #6c757d;
    margin-bottom: 0.15rem;
  }
</style>