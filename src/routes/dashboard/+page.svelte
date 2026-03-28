<script>
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { isAdmin } from '../stores';

  let logEntries = $state(/** @type {Array<any>} */ ([]));
  let isLoading = $state(true);
  let loadError = $state('');

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
  function toSummary(entry) {
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

  onMount(async () => {
    if (!$isAdmin) {
      isLoading = false;
      loadError = 'Admin access is required to view the edit log.';
      return;
    }

    try {
      const response = await fetch(`${base}/edit-trace.jsonl?ts=${Date.now()}`);

      if (!response.ok) {
        if (response.status === 404) {
          logEntries = [];
          return;
        }

        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

      logEntries = lines
        .map((line, index) => {
          try {
            const entry = JSON.parse(line);
            return {
              ...entry,
              summary: toSummary(entry),
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
              originalValueText: line,
              newValueText: '',
              parseError: true
            };
          }
        })
        .reverse();
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
      <p class="text-muted mb-0">Archived editTrace entries from publish runs.</p>
    </div>
    <a href="{base}/" class="btn btn-outline-secondary">Back to Manual</a>
  </div>

  {#if isLoading}
    <div class="alert alert-secondary">Loading edit log...</div>
  {:else if loadError}
    <div class="alert alert-danger">{loadError}</div>
  {:else if logEntries.length === 0}
    <div class="alert alert-info">No archived edit log entries are available yet.</div>
  {:else}
    <div class="d-grid gap-3">
      {#each logEntries as entry}
        <section class="card shadow-sm">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start gap-3 mb-2 flex-wrap">
              <div>
                <h2 class="h5 mb-1">{entry.summary}</h2>
                <div class="small text-muted">
                  Logged: {entry.loggedAt || 'Unknown'}
                </div>
              </div>
              <span class="badge text-bg-secondary">{entry.trace?.editType || 'unknown'}</span>
            </div>

            <div class="row g-3 small mb-3">
              <div class="col-md-3"><strong>Data Type:</strong> {entry.trace?.dataType || 'Unknown'}</div>
              <div class="col-md-3"><strong>Data ID:</strong> {entry.trace?.dataId || 'Unknown'}</div>
              <div class="col-md-3"><strong>Field:</strong> {entry.trace?.field || 'N/A'}</div>
              <div class="col-md-3"><strong>Trace Time:</strong> {entry.trace?.timestamp || 'Unknown'}</div>
              <div class="col-md-4"><strong>Request ID:</strong> {entry.requestId || 'Unknown'}</div>
              <div class="col-md-4"><strong>Published By:</strong> {entry.adminId || 'Unknown'}</div>
              <div class="col-md-4"><strong>Source Branch:</strong> {entry.sourceRef || 'Unknown'}</div>
            </div>

            {#if entry.parseError}
              <div class="alert alert-warning mb-0">
                This line could not be parsed as JSON. Raw content is shown below.
              </div>
              <pre class="bg-light border rounded p-3 mt-3 mb-0 small" style="white-space: pre-wrap;">{entry.originalValueText}</pre>
            {:else}
              <div class="row g-3">
                <div class="col-md-6">
                  <div class="form-label fw-semibold">Original Value</div>
                  <pre class="bg-light border rounded p-3 mb-0 small" style="white-space: pre-wrap;">{entry.originalValueText}</pre>
                </div>
                <div class="col-md-6">
                  <div class="form-label fw-semibold">New Value</div>
                  <pre class="bg-light border rounded p-3 mb-0 small" style="white-space: pre-wrap;">{entry.newValueText}</pre>
                </div>
              </div>
            {/if}
          </div>
        </section>
      {/each}
    </div>
  {/if}
</div>