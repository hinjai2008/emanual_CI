<script>
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { isAdmin } from '../stores';

  /**
   * @typedef {Object} ContentVersionMarker
   * @property {string=} versionId
   * @property {string=} requestId
   * @property {string=} publishedAt
   * @property {string=} publishedBy
   * @property {string=} sourceRef
   * @property {string=} summary
   * @property {number=} editTraceCount
   * @property {string=} snapshotPath
   * @property {string=} contentSha256
   * @property {string=} buildRunUrl
   * @property {string=} environment
   */

  let requestGroups = $state(/** @type {Array<any>} */ ([]));
  let selectedRequestId = $state('');
  let expandedEntryKeys = $state(new Set());
  let isLoading = $state(true);
  let loadError = $state('');
  let productionVersionUrl = $state('');
  let predeployVersion = $state(/** @type {ContentVersionMarker | null} */ (null));
  let productionVersion = $state(/** @type {ContentVersionMarker | null} */ (null));
  let syncStatus = $state('idle');
  let syncStatusMessage = $state('');

  /**
   * @param {any} value
   */
  function toPrettyValue(value) {
    if (value === null || value === undefined) {
      return 'None';
    }

    if (typeof value === 'string') {
      return value.trim() === '' ? 'Empty string' : value;
    }

    return JSON.stringify(value, null, 2);
  }

  /**
   * @param {any} entry
   */
  function toEntrySummary(entry) {
    const trace = entry.trace;

    if (trace.editType === 'add') {
      return `Added ${trace.dataType} #${trace.dataId}`;
    }

    if (trace.editType === 'remove') {
      return `Removed ${trace.dataType} #${trace.dataId}`;
    }

    const fieldLabel = trace.field || 'unknown field';
    return `Modified ${trace.dataType} #${trace.dataId} field ${fieldLabel}`;
  }

  /**
   * @param {Array<any>} entries
   * @param {any} manifestRecord
   */
  function toRequestSummary(entries, manifestRecord) {
    const manifestSummary = manifestRecord?.summary?.trim();
    if (manifestSummary) {
      return manifestSummary;
    }

    /** @type {Record<string, number>} */
    const counts = {
      add: 0,
      modify: 0,
      remove: 0,
      other: 0
    };
    const touchedItems = new Set();

    for (const entry of entries) {
      if (entry.parseError) {
        counts.other += 1;
        continue;
      }

      const editType = entry.trace?.editType || 'other';
      if (editType === 'add') {
        counts.add += 1;
      } else if (editType === 'modify') {
        counts.modify += 1;
      } else if (editType === 'remove') {
        counts.remove += 1;
      } else {
        counts.other += 1;
      }

      const dataType = entry.trace?.dataType || 'unknown';
      const dataId = entry.trace?.dataId || 'unknown';
      touchedItems.add(`${dataType} #${dataId}`);
    }

    const parts = [];
    if (counts.add > 0) parts.push(`${counts.add} added`);
    if (counts.modify > 0) parts.push(`${counts.modify} modified`);
    if (counts.remove > 0) parts.push(`${counts.remove} removed`);
    if (counts.other > 0) parts.push(`${counts.other} other`);

    if (parts.length === 0) {
      return 'No change summary available';
    }

    return `${entries.length} changes across ${touchedItems.size} records: ${parts.join(', ')}`;
  }

  /**
   * @param {any} left
   * @param {any} right
   */
  function compareEntryTimes(left, right) {
    const leftTime = new Date(left.trace?.timestamp || left.loggedAt || 0).getTime();
    const rightTime = new Date(right.trace?.timestamp || right.loggedAt || 0).getTime();
    return rightTime - leftTime;
  }

  /**
   * @param {Array<any>} entries
   */
  function toPreviewItems(entries) {
    return entries.filter((entry) => !entry.parseError).slice(0, 3).map((entry) => entry.summary);
  }

  /**
   * @param {string} entryKey
   */
  function toggleEntry(entryKey) {
    const nextKeys = new Set(expandedEntryKeys);

    if (nextKeys.has(entryKey)) {
      nextKeys.delete(entryKey);
    } else {
      nextKeys.add(entryKey);
    }

    expandedEntryKeys = nextKeys;
  }

  /**
   * @param {Array<any>} entries
   */
  function expandEntries(entries) {
    expandedEntryKeys = new Set(entries.map((entry) => entry.entryKey));
  }

  function collapseEntries() {
    expandedEntryKeys = new Set();
  }

  /**
   * @param {string} input
   */
  function normalizeVersionUrl(input) {
    return input.trim();
  }

  /**
   * @param {string} url
   */
  function withCacheBuster(url) {
    const parsedUrl = new URL(url, window.location.href);
    parsedUrl.searchParams.set('ts', String(Date.now()));
    return parsedUrl.toString();
  }

  /**
   * @param {string} url
   */
  async function fetchVersionMarker(url) {
    try {
      const response = await fetch(withCacheBuster(url));
      if (!response.ok) {
        return {
          ok: false,
          error: `HTTP ${response.status}`
        };
      }

      return {
        ok: true,
        data: await response.json()
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown network error'
      };
    }
  }

  function persistProductionVersionUrl() {
    if (typeof window === 'undefined') {
      return;
    }

    const normalizedUrl = normalizeVersionUrl(productionVersionUrl);
    productionVersionUrl = normalizedUrl;
    localStorage.setItem('productionContentVersionUrl', normalizedUrl);
  }

  function clearSyncStatus() {
    syncStatus = 'idle';
    syncStatusMessage = '';
    productionVersion = null;
  }

  /**
   * @param {ContentVersionMarker | null} marker
   * @param {'versionId' | 'publishedAt' | 'contentSha256'} key
   * @param {string} fallback
   */
  function markerText(marker, key, fallback) {
    const value = marker?.[key];
    return typeof value === 'string' && value.trim() !== '' ? value : fallback;
  }

  async function checkProductionSync() {
    const normalizedUrl = normalizeVersionUrl(productionVersionUrl);
    productionVersionUrl = normalizedUrl;

    if (!normalizedUrl) {
      clearSyncStatus();
      return;
    }

    syncStatus = 'checking';
    syncStatusMessage = 'Checking production sync status...';

    const [predeployResp, productionResp] = await Promise.all([
      fetchVersionMarker(`${base}/content-version.json`),
      fetchVersionMarker(normalizedUrl)
    ]);

    if (!predeployResp.ok) {
      syncStatus = 'unknown';
      syncStatusMessage = `Could not read pre-deployment version marker: ${predeployResp.error}`;
      return;
    }

    predeployVersion = predeployResp.data;

    if (!productionResp.ok) {
      syncStatus = 'unknown';
      syncStatusMessage = `Could not read production version marker: ${productionResp.error}`;
      productionVersion = null;
      return;
    }

    productionVersion = productionResp.data;

    const preSha = predeployResp.data?.contentSha256;
    const prodSha = productionResp.data?.contentSha256;

    if (!preSha || !prodSha) {
      syncStatus = 'unknown';
      syncStatusMessage = 'Version markers are missing contentSha256, so sync cannot be confirmed.';
      return;
    }

    if (preSha === prodSha) {
      syncStatus = 'in-sync';
      syncStatusMessage = `Production is in sync with pre-deployment (${predeployResp.data?.versionId || 'unknown version'}).`;
    } else {
      syncStatus = 'out-of-sync';
      syncStatusMessage = `Production is out of sync. Pre-deployment=${predeployResp.data?.versionId || 'unknown'} Production=${productionResp.data?.versionId || 'unknown'}.`;
    }
  }

  /**
   * @param {Array<any>} entries
   * @param {Map<string, any>} manifestByRequestId
   */
  function toRequestGroups(entries, manifestByRequestId) {
    const grouped = new Map();

    for (const entry of entries) {
      const requestId = entry.requestId || 'unknown-request';

      if (!grouped.has(requestId)) {
        grouped.set(requestId, []);
      }

      grouped.get(requestId).push(entry);
    }

    return Array.from(grouped.entries())
      .map(([requestId, groupEntries]) => {
        const manifestRecord = manifestByRequestId.get(requestId);
        /** @type {Array<any>} */
        const sortedEntries = groupEntries.slice();

        sortedEntries.sort(compareEntryTimes);

        return {
          requestId,
          entries: sortedEntries,
          summary: toRequestSummary(sortedEntries, manifestRecord),
          previewItems: toPreviewItems(sortedEntries),
          lastLoggedAt: sortedEntries[0]?.loggedAt || manifestRecord?.publishedAt || '',
          adminId: sortedEntries[0]?.adminId || manifestRecord?.publishedBy || 'Unknown',
          sourceRef: sortedEntries[0]?.sourceRef || manifestRecord?.sourceRef || 'Unknown',
          editCount: sortedEntries.length,
          buildRunUrl: manifestRecord?.buildRunUrl || ''
        };
      })
      .sort((/** @type {any} */ left, /** @type {any} */ right) => new Date(right.lastLoggedAt || 0).getTime() - new Date(left.lastLoggedAt || 0).getTime());
  }

  let selectedGroup = $derived.by(() => requestGroups.find((group) => group.requestId === selectedRequestId) || null);

  $effect(() => {
    if (!selectedGroup) {
      expandedEntryKeys = new Set();
      return;
    }

    expandedEntryKeys = new Set(selectedGroup.entries.slice(0, 3).map((/** @type {any} */ entry) => entry.entryKey));
  });

  onMount(async () => {
    if (!$isAdmin) {
      isLoading = false;
      loadError = 'Admin access is required to view the edit log.';
      return;
    }

    if (typeof window !== 'undefined') {
      productionVersionUrl = localStorage.getItem('productionContentVersionUrl') || '';
    }

    try {
      const [logResponse, manifestResponse, predeployVersionResponse] = await Promise.all([
        fetch(`${base}/edit-trace.jsonl?ts=${Date.now()}`),
        fetch(`${base}/content-versions/manifest.json?ts=${Date.now()}`),
        fetch(`${base}/content-version.json?ts=${Date.now()}`)
      ]);

      if (!logResponse.ok) {
        if (logResponse.status === 404) {
          requestGroups = [];
          return;
        }

        throw new Error(`HTTP ${logResponse.status}`);
      }

      const manifestByRequestId = new Map();
      if (manifestResponse.ok) {
        const manifestRecords = await manifestResponse.json();
        if (Array.isArray(manifestRecords)) {
          for (const record of manifestRecords) {
            if (record?.requestId) {
              manifestByRequestId.set(record.requestId, record);
            }
          }
        }
      }

      if (predeployVersionResponse.ok) {
        predeployVersion = await predeployVersionResponse.json();
      }

      const text = await logResponse.text();
      const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

      const entries = lines.map((line, index) => {
        try {
          const entry = JSON.parse(line);
          return {
            ...entry,
            entryKey: `${entry.requestId || 'unknown-request'}-${index}`,
            summary: toEntrySummary(entry),
            originalValueText: toPrettyValue(entry.trace?.originalValue),
            newValueText: toPrettyValue(entry.trace?.newValue)
          };
        } catch {
          return {
            loggedAt: '',
            requestId: '',
            adminId: '',
            sourceRef: '',
            trace: {
              dataType: 'unknown',
              dataId: String(index + 1),
              editType: 'unknown',
              field: null,
              timestamp: ''
            },
            summary: 'Unparseable log entry',
            entryKey: `unparseable-${index}`,
            originalValueText: line,
            newValueText: '',
            parseError: true
          };
        }
      });

      requestGroups = toRequestGroups(entries, manifestByRequestId);
      selectedRequestId = requestGroups[0]?.requestId || '';

      if (productionVersionUrl.trim()) {
        await checkProductionSync();
      }
    } catch (error) {
      loadError = `Failed to load edit log: ${error instanceof Error ? error.message : 'Unknown error'}`;
    } finally {
      isLoading = false;
    }
  });
</script>

<svelte:head>
  <title>Edit Log Dashboard</title>
</svelte:head>

<div class="container py-3">
  <div class="d-flex justify-content-between align-items-center mb-3">
    <div>
      <h1 class="h3 mb-1">Edit Log Dashboard</h1>
      <p class="text-muted mb-0">Archived editTrace entries grouped by publish request.</p>
    </div>
    <a href="{base}/" class="btn btn-outline-secondary">Back to Manual</a>
  </div>

  <section class="card shadow-sm mb-3">
    <div class="card-body">
      <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-2">
        <div>
          <h2 class="h5 mb-1">Production Sync Check</h2>
          <p class="small text-muted mb-0">Compare production against pre-deployment using content-version markers.</p>
        </div>
      </div>

      <div class="row g-2 align-items-end">
        <div class="col-lg-9">
          <label class="form-label small mb-1" for="production-version-url">Production content-version URL</label>
          <input
            id="production-version-url"
            type="url"
            class="form-control"
            placeholder="https://corporate-server.example.com/content-version.json"
            value={productionVersionUrl}
            oninput={(event) => {
              productionVersionUrl = event.currentTarget.value;
            }}
            onblur={persistProductionVersionUrl}
          />
        </div>
        <div class="col-lg-3 d-grid d-lg-flex gap-2">
          <button type="button" class="btn btn-primary flex-fill" onclick={checkProductionSync} disabled={isLoading || syncStatus === 'checking'}>
            {syncStatus === 'checking' ? 'Checking...' : 'Check Sync'}
          </button>
          <button
            type="button"
            class="btn btn-outline-secondary"
            onclick={() => {
              productionVersionUrl = '';
              persistProductionVersionUrl();
              clearSyncStatus();
            }}
            disabled={syncStatus === 'checking'}
          >
            Clear
          </button>
        </div>
      </div>

      {#if syncStatusMessage}
        <div class="mt-3">
          {#if syncStatus === 'in-sync'}
            <div class="alert alert-success mb-0">{syncStatusMessage}</div>
          {:else if syncStatus === 'out-of-sync'}
            <div class="alert alert-danger mb-0">{syncStatusMessage}</div>
          {:else if syncStatus === 'unknown'}
            <div class="alert alert-warning mb-0">{syncStatusMessage}</div>
          {:else}
            <div class="alert alert-secondary mb-0">{syncStatusMessage}</div>
          {/if}
        </div>
      {/if}

      {#if (predeployVersion || productionVersion) && syncStatus !== 'checking'}
        <div class="row g-3 small mt-1">
          <div class="col-md-6">
            <div class="border rounded p-2 bg-light-subtle">
              <div class="fw-semibold mb-1">Pre-deployment</div>
              <div><strong>Version:</strong> {markerText(predeployVersion, 'versionId', 'Unknown')}</div>
              <div><strong>Published:</strong> {markerText(predeployVersion, 'publishedAt', 'Unknown')}</div>
              <div><strong>Hash:</strong> <span class="text-break">{markerText(predeployVersion, 'contentSha256', 'Unknown')}</span></div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="border rounded p-2 bg-light-subtle">
              <div class="fw-semibold mb-1">Production</div>
              <div><strong>Version:</strong> {markerText(productionVersion, 'versionId', 'Not loaded')}</div>
              <div><strong>Published:</strong> {markerText(productionVersion, 'publishedAt', 'Not loaded')}</div>
              <div><strong>Hash:</strong> <span class="text-break">{markerText(productionVersion, 'contentSha256', 'Not loaded')}</span></div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </section>

  {#if isLoading}
    <div class="alert alert-secondary">Loading edit log...</div>
  {:else if loadError}
    <div class="alert alert-danger">{loadError}</div>
  {:else if requestGroups.length === 0}
    <div class="alert alert-info">No archived edit log entries are available yet.</div>
  {:else}
    <div class="row g-3 align-items-start">
      <div class="col-lg-4">
        <div class="card shadow-sm sticky-lg-top dashboard-pane" style="top: 1rem;">
          <div class="card-body p-0">
            <div class="border-bottom px-3 py-2">
              <h2 class="h5 mb-1">Publish Requests</h2>
              <div class="small text-muted">Select a request to inspect detailed modifications.</div>
            </div>

            <div class="list-group list-group-flush dashboard-scroll-region">
              {#each requestGroups as group}
                <button
                  type="button"
                  class:selected-request={group.requestId === selectedRequestId}
                  class="list-group-item list-group-item-action text-start border-0 border-bottom"
                  onclick={() => {
                    selectedRequestId = group.requestId;
                  }}
                >
                  <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
                    <div class="fw-semibold text-break">{group.requestId}</div>
                    <span class="badge text-bg-secondary">{group.editCount}</span>
                  </div>
                  <div class="small text-muted mb-2">{group.lastLoggedAt || 'Unknown time'}</div>
                  <div class="small mb-2">{group.summary}</div>
                  {#if group.previewItems.length > 0}
                    <div class="small text-muted">{group.previewItems.join(' · ')}</div>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        </div>
      </div>

      <div class="col-lg-8">
        {#if selectedGroup}
          <div class="dashboard-detail-scroll pe-lg-1">
            <section class="card shadow-sm mb-3">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3">
                  <div>
                    <h2 class="h4 mb-1">Request {selectedGroup.requestId}</h2>
                    <div class="text-muted">{selectedGroup.summary}</div>
                  </div>
                  <div class="d-flex gap-2 flex-wrap">
                    <span class="badge text-bg-dark">{selectedGroup.editCount} changes</span>
                    <button class="btn btn-sm btn-outline-secondary" type="button" onclick={() => expandEntries(selectedGroup.entries)}>Expand All</button>
                    <button class="btn btn-sm btn-outline-secondary" type="button" onclick={collapseEntries}>Collapse All</button>
                    {#if selectedGroup.buildRunUrl}
                      <a class="btn btn-sm btn-outline-primary" href={selectedGroup.buildRunUrl} target="_blank" rel="noreferrer">Workflow Run</a>
                    {/if}
                  </div>
                </div>

                <div class="row g-3 small">
                  <div class="col-md-4"><strong>Published By:</strong> {selectedGroup.adminId || 'Unknown'}</div>
                  <div class="col-md-4"><strong>Source Branch:</strong> {selectedGroup.sourceRef || 'Unknown'}</div>
                  <div class="col-md-4"><strong>Logged At:</strong> {selectedGroup.lastLoggedAt || 'Unknown'}</div>
                </div>
              </div>
            </section>

            <div class="d-grid gap-3">
              {#each selectedGroup.entries as entry}
                <section class="card shadow-sm">
                  <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start gap-3 mb-0 flex-wrap">
                      <button
                        type="button"
                        class="btn btn-link text-decoration-none text-start p-0 flex-grow-1 entry-toggle"
                        onclick={() => toggleEntry(entry.entryKey)}
                      >
                        <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                          <div>
                            <h3 class="h5 mb-1">{entry.summary}</h3>
                            <div class="small text-muted">Logged: {entry.loggedAt || 'Unknown'}</div>
                          </div>
                          <div class="d-flex align-items-center gap-2">
                            <span class="badge text-bg-secondary">{entry.trace?.editType || 'unknown'}</span>
                            <span class="entry-chevron" aria-hidden="true">{expandedEntryKeys.has(entry.entryKey) ? '−' : '+'}</span>
                          </div>
                        </div>
                      </button>
                    </div>

                    {#if expandedEntryKeys.has(entry.entryKey)}
                      <div class="mt-3">
                        <div class="row g-3 small mb-3">
                          <div class="col-md-3"><strong>Data Type:</strong> {entry.trace?.dataType || 'Unknown'}</div>
                          <div class="col-md-3"><strong>Data ID:</strong> {entry.trace?.dataId || 'Unknown'}</div>
                          <div class="col-md-3"><strong>Field:</strong> {entry.trace?.field || 'N/A'}</div>
                          <div class="col-md-3"><strong>Trace Time:</strong> {entry.trace?.timestamp || 'Unknown'}</div>
                        </div>

                        {#if entry.parseError}
                          <div class="alert alert-warning mb-0">This line could not be parsed as JSON. Raw content is shown below.</div>
                          <pre class="bg-light border rounded p-3 mt-3 mb-0 small detail-value-block" style="white-space: pre-wrap;">{entry.originalValueText}</pre>
                        {:else}
                          <div class="row g-3">
                            <div class="col-md-6">
                              <div class="form-label fw-semibold">Original Value</div>
                              <pre class="bg-light border rounded p-3 mb-0 small detail-value-block" style="white-space: pre-wrap;">{entry.originalValueText}</pre>
                            </div>
                            <div class="col-md-6">
                              <div class="form-label fw-semibold">New Value</div>
                              <pre class="bg-light border rounded p-3 mb-0 small detail-value-block" style="white-space: pre-wrap;">{entry.newValueText}</pre>
                            </div>
                          </div>
                        {/if}
                      </div>
                    {/if}
                  </div>
                </section>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .dashboard-pane {
    overflow: hidden;
  }

  .dashboard-scroll-region {
    overflow-y: auto;
  }

  .dashboard-detail-scroll {
    overflow-y: auto;
  }

  .detail-value-block {
    max-height: 18rem;
    overflow: auto;
  }

  .selected-request {
    background-color: rgba(13, 110, 253, 0.08);
    box-shadow: inset 0 0 0 1px rgba(13, 110, 253, 0.25);
  }

  .entry-toggle {
    color: inherit;
  }

  .entry-toggle:hover {
    color: inherit;
  }

  .entry-chevron {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-radius: 999px;
    font-size: 1rem;
    line-height: 1;
  }

  @media (min-width: 992px) {
    .dashboard-pane,
    .dashboard-detail-scroll {
      max-height: calc(100vh - 8rem);
    }
  }
</style>