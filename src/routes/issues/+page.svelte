<script>
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { isAdmin } from '../stores';

  let loading = $state(false);
  let statusMessage = $state('');
  let errorMessage = $state('');
  let issues = $state([]);
  let revision = $state(0);
  let updatedAt = $state('');
  let updatedBy = $state('');

  let searchText = $state('');
  let selectedStatus = $state('all');
  let selectedType = $state('all');
  let includeClosed = $state(false);
  let includeResolved = $state(false);

  const defaultPublishEndpoint = 'https://emanual-publish-api.rayyt2020.workers.dev/publish';

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

  function normalizeIssue(item) {
    return {
      id: String(item?.id || ''),
      title: String(item?.title || ''),
      description: String(item?.description || ''),
      status: String(item?.status || 'open'),
      entryRefs: Array.isArray(item?.entryRefs)
        ? item.entryRefs
            .map((ref) => ({ type: String(ref?.type || ''), id: Number(ref?.id || 0) }))
            .filter((ref) => ['test', 'form', 'container'].includes(ref.type) && Number.isFinite(ref.id) && ref.id > 0)
        : [],
      actions: Array.isArray(item?.actions) ? item.actions : [],
      timeline: Array.isArray(item?.timeline) ? item.timeline : [],
      createdAt: String(item?.createdAt || ''),
      updatedAt: String(item?.updatedAt || '')
    };
  }

  async function loadIssues(interactive = false) {
    if (!$isAdmin) {
      return;
    }

    const apiBase = getSavedApiBase();
    if (!apiBase) {
      errorMessage = 'Publish API endpoint is not configured.';
      return;
    }

    let secret = sessionStorage.getItem('publishApiSecret') || '';
    if (!secret && interactive) {
      const typedSecret = window.prompt('Enter publish API secret to load issues:', '');
      if (typedSecret) {
        sessionStorage.setItem('publishApiSecret', typedSecret);
        secret = typedSecret;
      }
    }

    if (!secret) {
      errorMessage = 'Missing API secret. Sign in as admin first, or click Refresh and enter it.';
      return;
    }

    loading = true;
    errorMessage = '';
    statusMessage = 'Loading issues...';

    try {
      const response = await fetch(endpointFromBase(apiBase, '/issues/load'), {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify({ _secret: secret })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        throw new Error(result?.error || `HTTP ${response.status}`);
      }

      issues = Array.isArray(result?.issues) ? result.issues.map((item) => normalizeIssue(item)) : [];
      revision = Number(result?.revision || 0);
      updatedAt = String(result?.updatedAt || '');
      updatedBy = String(result?.updatedBy || '');
      statusMessage = `Loaded ${issues.length} issue(s).`;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Failed to load issues.';
      statusMessage = '';
    } finally {
      loading = false;
    }
  }

  function statusAllowedByDefault(issueStatus) {
    if (!includeClosed && issueStatus === 'closed') {
      return false;
    }

    if (!includeResolved && issueStatus === 'resolved') {
      return false;
    }

    return true;
  }

  let filteredIssues = $derived.by(() => {
    const needle = searchText.trim().toLowerCase();

    return issues.filter((issue) => {
      const status = String(issue?.status || '').toLowerCase();
      if (!statusAllowedByDefault(status)) {
        return false;
      }

      if (selectedStatus !== 'all' && status !== selectedStatus) {
        return false;
      }

      if (selectedType !== 'all') {
        const refs = Array.isArray(issue?.entryRefs) ? issue.entryRefs : [];
        if (!refs.some((ref) => ref?.type === selectedType)) {
          return false;
        }
      }

      if (!needle) {
        return true;
      }

      const searchable = [
        issue.id,
        issue.title,
        issue.description,
        issue.status,
        stringifyEntryRefs(issue.entryRefs)
      ]
        .join(' ')
        .toLowerCase();

      return searchable.includes(needle);
    });
  });

  onMount(async () => {
    await loadIssues(false);
  });
</script>

<div class="container py-3">
  <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
    <h4 class="mb-0">All Issues</h4>
    <div class="d-flex gap-2">
      <a class="btn btn-outline-secondary btn-sm" href="{base}/">Back to Home</a>
      {#if $isAdmin}
      <button type="button" class="btn btn-outline-primary btn-sm" onclick={() => loadIssues(true)} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</button>
      {/if}
    </div>
  </div>

  {#if !$isAdmin}
    <div class="alert alert-warning small mb-3">
      Admin login is required to view issue logs.
    </div>
  {:else}
    <div class="card mb-3">
      <div class="card-body py-2">
        <div class="row g-2 align-items-end">
          <div class="col-md-4">
            <label class="form-label form-label-sm mb-1">Search</label>
            <input class="form-control form-control-sm" bind:value={searchText} placeholder="Issue ID, title, text, ref">
          </div>
          <div class="col-md-2">
            <label class="form-label form-label-sm mb-1">Status</label>
            <select class="form-select form-select-sm" bind:value={selectedStatus}>
              <option value="all">All</option>
              <option value="open">open</option>
              <option value="in-progress">in-progress</option>
              <option value="resolved">resolved</option>
              <option value="closed">closed</option>
            </select>
          </div>
          <div class="col-md-2">
            <label class="form-label form-label-sm mb-1">Entry Type</label>
            <select class="form-select form-select-sm" bind:value={selectedType}>
              <option value="all">All</option>
              <option value="test">Test</option>
              <option value="form">Form</option>
              <option value="container">Container</option>
            </select>
          </div>
          <div class="col-md-2 form-check mt-4">
            <input id="include-closed" class="form-check-input" type="checkbox" bind:checked={includeClosed}>
            <label class="form-check-label small" for="include-closed">Show closed</label>
          </div>
          <div class="col-md-2 form-check mt-4">
            <input id="include-resolved" class="form-check-input" type="checkbox" bind:checked={includeResolved}>
            <label class="form-check-label small" for="include-resolved">Show resolved</label>
          </div>
        </div>
      </div>
    </div>

    {#if statusMessage}
      <div class="small text-muted mb-1">{statusMessage}</div>
    {/if}
    {#if updatedAt}
      <div class="small text-muted mb-1">Revision {revision} updated by {updatedBy || 'unknown'} at {updatedAt}</div>
    {/if}
    {#if errorMessage}
      <div class="small text-danger mb-2">{errorMessage}</div>
    {/if}

    <div class="d-flex justify-content-between align-items-center mb-2 small text-muted">
      <span>Showing {filteredIssues.length} of {issues.length} issue(s)</span>
      <span>Closed and resolved are hidden by default</span>
    </div>

    {#if filteredIssues.length === 0}
      <div class="alert alert-light border small">No issues matched the current filters.</div>
    {/if}

    {#each filteredIssues as issue}
      <article class="card mb-2">
        <div class="card-body py-2">
          <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
            <div>
              <div class="small text-muted">{issue.id}</div>
              <div class="fw-semibold">{issue.title || 'Untitled issue'}</div>
            </div>
            <span class="badge text-bg-secondary">{issue.status || 'open'}</span>
          </div>

          {#if issue.description}
            <div class="small mt-2">{issue.description}</div>
          {/if}

          <div class="small text-muted mt-2">
            Refs: {stringifyEntryRefs(issue.entryRefs) || 'general'}
          </div>

          <div class="small text-muted">Actions: {issue.actions.length} | Timeline: {issue.timeline.length}</div>

          {#if issue.entryRefs.length > 0}
            <div class="d-flex flex-wrap gap-2 mt-2">
              {#each issue.entryRefs as ref}
                <a class="btn btn-outline-secondary btn-sm" href="{base}/{ref.type}/{ref.id}">{ref.type}/{ref.id}</a>
              {/each}
            </div>
          {/if}
        </div>
      </article>
    {/each}
  {/if}
</div>
