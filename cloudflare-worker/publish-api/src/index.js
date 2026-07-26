/**
 * Cloudflare Worker: Publish endpoint for eManual
 *
 * POST /draft/load
 * Body: { _secret: string }
 *
 * POST /draft/save
 * Body: {
 *   _secret: string,
 *   editedJSON: object,
 *   expectedRevision?: number,
 *   editorId?: string
 * }
 *
 * POST /draft/discard
 * Body: { _secret: string, expectedRevision?: number, editorId?: string }
 *
 * POST /issues/load
 * Body: { _secret: string }
 *
 * POST /issues/create
 * Body: { _secret: string, actor?: string, issue: object }
 *
 * POST /issues/update
 * Body: { _secret: string, actor?: string, issueId: string, patch: object }
 *
 * POST /issues/add-action
 * Body: { _secret: string, actor?: string, issueId: string, action: object }
 *
 * POST /issues/update-action
 * Body: { _secret: string, actor?: string, issueId: string, actionId: string, patch: object }
 *
 * POST /publish
 * Body: {
 *   _secret: string,
 *   requestId?: string,
 *   adminId?: string,
 *   publishSummary?: string,
 *   commitMessage?: string
 * }
 *
 * POST /publish/status
 * Body: { _secret: string }
 *
 * POST /publish/update
 * Body: {
 *   _secret: string,
 *   requestId?: string,
 *   status?: 'pending' | 'running' | 'succeeded' | 'failed' | 'artifact-unavailable',
 *   message?: string,
 *   workflowRunId?: string,
 *   workflowRunUrl?: string,
 *   versionId?: string,
 *   contentSha256?: string,
 *   artifactId?: string,
 *   artifactName?: string,
 *   artifactArchiveUrl?: string,
 *   artifactUnavailable?: boolean
 * }
 *
 * POST /publish/artifact
 * Body: { _secret: string }
 * Header: Authorization: Bearer <PUBLISH_SHARED_SECRET>
 *
 * Required Worker Secrets:
 * - GH_TOKEN               (GitHub token with Actions write)
 * - PUBLISH_SHARED_SECRET  (shared secret for caller)
 *
 * Required Worker Vars:
 * - GH_OWNER               (e.g. hinjai2008)
 * - GH_REPO                (e.g. emanual)
 *
 * Optional Worker Vars:
 * - GH_WORKFLOW_FILE       (default: content-build-handoff.yml)
 * - GH_REF                 (default: gh-pages)
 * - ALLOWED_ORIGIN         (default: *)
 * - DRAFT_KEY              (default: drafts/shared/latest.json)
 * - ISSUES_KEY             (default: issues/shared/latest.json)
 */

export default {
  async fetch(request, env) {
    const corsHeaders = buildCorsHeaders(env.ALLOWED_ORIGIN || '*');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return json({ ok: true, service: 'publish-api' }, 200, corsHeaders);
    }

    const supportsBody = request.method === 'POST';
    const route = url.pathname;

    if (!supportsBody || !isSupportedRoute(route)) {
      return json({ ok: false, error: 'Not found' }, 404, corsHeaders);
    }

    // 2) Parse body — accept both application/json and text/plain (preflight-free)
    let body;
    try {
      const raw = await request.text();
      body = JSON.parse(raw);
    } catch {
      return json({ ok: false, error: 'Invalid JSON body' }, 400, corsHeaders);
    }

    // 1) Auth check — accept secret from Authorization header or body._secret
    const auth = request.headers.get('Authorization') || '';
    const headerToken = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const bodyToken = typeof body?._secret === 'string' ? body._secret.trim() : '';
    const token = headerToken || bodyToken;
    if (!token || token !== env.PUBLISH_SHARED_SECRET) {
      return json({ ok: false, error: 'Unauthorized' }, 401, corsHeaders);
    }

    if (!env.DRAFTS_BUCKET) {
      return json(
        {
          ok: false,
          error: 'Worker env missing DRAFTS_BUCKET R2 binding'
        },
        500,
        corsHeaders
      );
    }

    if (route === '/draft/load') {
      return handleDraftLoad(env, corsHeaders);
    }

    if (route === '/draft/save') {
      return handleDraftSave(body, env, corsHeaders);
    }

    if (route === '/draft/discard') {
      return handleDraftDiscard(body, env, corsHeaders);
    }

    if (route === '/issues/load') {
      return handleIssuesLoad(env, corsHeaders);
    }

    if (route === '/issues/create') {
      return handleIssueCreate(body, env, corsHeaders);
    }

    if (route === '/issues/update') {
      return handleIssueUpdate(body, env, corsHeaders);
    }

    if (route === '/issues/add-action') {
      return handleIssueAddAction(body, env, corsHeaders);
    }

    if (route === '/issues/update-action') {
      return handleIssueUpdateAction(body, env, corsHeaders);
    }

    if (route === '/publish/status') {
      return handlePublishStatus(env, corsHeaders);
    }

    if (route === '/publish/update') {
      return handlePublishUpdate(body, env, corsHeaders);
    }

    if (route === '/publish/artifact') {
      return handlePublishArtifact(env, corsHeaders);
    }

    const requestId = String(body?.requestId || `req-${Date.now()}`);
    const adminId = String(body?.adminId || 'ui-admin');
    const publishSummary = String(body?.publishSummary || '');
    const commitMessage = String(body?.commitMessage || `chore: update rawData.json (${requestId})`);

    const draftEnvelope = await readDraftEnvelope(env);
    if (!draftEnvelope.exists) {
      return json({ ok: false, error: 'No remote draft available to publish' }, 400, corsHeaders);
    }

    const editedJSON = draftEnvelope.editedJSON;

    const validationError = validateEditedJsonShape(editedJSON);
    if (validationError) {
      return json({ ok: false, error: validationError }, 400, corsHeaders);
    }

    // 3) Build workflow dispatch payload
    const owner = env.GH_OWNER;
    const repo = env.GH_REPO;
    const workflowFile = env.GH_WORKFLOW_FILE || 'content-build-handoff.yml';
    const ref = env.GH_REF || 'gh-pages';
    const workflowRunListUrl = `https://github.com/${owner}/${repo}/actions/workflows/${workflowFile}`;

    const previousPublishState = await readPublishState(env);
    const startedAt = new Date().toISOString();
    const publishStateOnStart = {
      ...createDefaultPublishState(),
      latestPublishedVersion: previousPublishState.latestPublishedVersion || '',
      latestPublishedSha: previousPublishState.latestPublishedSha || '',
      artifact: previousPublishState.artifact || createDefaultArtifactInfo(),
      requestId,
      adminId,
      workflow: workflowFile,
      workflowRef: ref,
      workflowRunUrl: workflowRunListUrl,
      status: 'pending',
      startedAt,
      completedAt: '',
      updatedAt: startedAt,
      message: 'Publish requested. Waiting for workflow execution status.'
    };

    await writePublishState(env, publishStateOnStart);

    if (!owner || !repo || !env.GH_TOKEN) {
      return json(
        {
          ok: false,
          error: 'Worker env missing GH_OWNER, GH_REPO, or GH_TOKEN'
        },
        500,
        corsHeaders
      );
    }

    const raw = JSON.stringify(editedJSON, null, '\t');
    const contentBase64 = bytesToBase64(new TextEncoder().encode(raw));

    // Avoid GitHub workflow input size limits by updating rawData.json in repo first.
    const updateRawDataResp = await upsertRawDataFile(
      env,
      owner,
      repo,
      ref,
      contentBase64,
      commitMessage
    );

    if (!updateRawDataResp.ok) {
      await writePublishState(env, {
        ...publishStateOnStart,
        status: 'failed',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        message: 'Failed to update src/routes/rawData.json before workflow dispatch.'
      });

      return json(
        {
          ok: false,
          error: 'Failed to update src/routes/rawData.json before workflow dispatch',
          status: updateRawDataResp.status,
          details: updateRawDataResp.text
        },
        502,
        corsHeaders
      );
    }

    const dispatchResp = await githubRequest(
      env,
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`,
      {
        method: 'POST',
        body: JSON.stringify({
          ref,
          inputs: {
            request_id: requestId,
            admin_id: adminId,
            publish_summary: publishSummary
          }
        })
      }
    );

    if (!dispatchResp.ok) {
      await writePublishState(env, {
        ...publishStateOnStart,
        status: 'failed',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        message: 'Failed to trigger GitHub workflow dispatch.'
      });

      return json(
        {
          ok: false,
          error: 'Failed to trigger GitHub workflow',
          status: dispatchResp.status,
          details: dispatchResp.text
        },
        502,
        corsHeaders
      );
    }

    const actionsUrl = workflowRunListUrl;

    const publishStateAfterDispatch = {
      ...publishStateOnStart,
      status: 'running',
      updatedAt: new Date().toISOString(),
      message: 'Workflow dispatched. Build is in progress.',
      workflowRunUrl: actionsUrl
    };

    await writePublishState(env, publishStateAfterDispatch);

    return json(
      {
        ok: true,
        message: 'Content build workflow dispatched',
        workflow: workflowFile,
        requestId,
        draftRevision: draftEnvelope.revision,
        actionsUrl,
        publishState: publishStateAfterDispatch
      },
      202,
      corsHeaders
    );
  }
};

function buildCorsHeaders(allowedOrigin) {
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'false'
  };
}

function isSupportedRoute(pathname) {
  return (
    pathname === '/publish' ||
    pathname === '/publish/status' ||
    pathname === '/publish/update' ||
    pathname === '/publish/artifact' ||
    pathname === '/draft/load' ||
    pathname === '/draft/save' ||
    pathname === '/draft/discard' ||
    pathname === '/issues/load' ||
    pathname === '/issues/create' ||
    pathname === '/issues/update' ||
    pathname === '/issues/add-action' ||
    pathname === '/issues/update-action'
  );
}

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders
    }
  });
}

async function githubRequest(env, url, init = {}) {
  const resp = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GH_TOKEN}`,
      'User-Agent': 'emanual-publish-api-worker',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {})
    }
  });

  return {
    ok: resp.ok,
    status: resp.status,
    text: await safeText(resp)
  };
}

async function upsertRawDataFile(env, owner, repo, ref, contentBase64, commitMessage) {
  const contentsUrl = `https://api.github.com/repos/${owner}/${repo}/contents/src/routes/rawData.json?ref=${encodeURIComponent(ref)}`;

  const currentFileResp = await githubRequest(env, contentsUrl);
  let currentSha;

  if (currentFileResp.ok) {
    try {
      const fileData = JSON.parse(currentFileResp.text);
      currentSha = fileData?.sha;
    } catch {
      return {
        ok: false,
        status: 502,
        text: 'Could not parse current src/routes/rawData.json metadata from GitHub API'
      };
    }
  } else if (currentFileResp.status !== 404) {
    return currentFileResp;
  }

  const payload = {
    message: commitMessage,
    content: contentBase64,
    branch: ref,
    ...(currentSha ? { sha: currentSha } : {})
  };

  return githubRequest(env, `https://api.github.com/repos/${owner}/${repo}/contents/src/routes/rawData.json`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

function publishStateObjectKey(env) {
  return env.PUBLISH_STATE_KEY || 'publish/shared/state.json';
}

function createDefaultArtifactInfo() {
  return {
    id: '',
    name: '',
    archiveUrl: '',
    unavailable: false
  };
}

function createDefaultPublishState() {
  return {
    requestId: '',
    adminId: '',
    workflow: '',
    workflowRef: '',
    workflowRunId: '',
    workflowRunUrl: '',
    status: 'idle',
    startedAt: '',
    completedAt: '',
    updatedAt: '',
    latestPublishedVersion: '',
    latestPublishedSha: '',
    artifact: createDefaultArtifactInfo(),
    message: ''
  };
}

function normalizePublishStatus(rawStatus) {
  const status = String(rawStatus || '').trim().toLowerCase();
  if (status === 'pending') {
    return 'pending';
  }
  if (status === 'running') {
    return 'running';
  }
  if (status === 'succeeded' || status === 'success') {
    return 'succeeded';
  }
  if (status === 'artifact-unavailable') {
    return 'artifact-unavailable';
  }
  if (status === 'failed' || status === 'failure') {
    return 'failed';
  }
  return '';
}

async function readPublishState(env) {
  const object = await env.DRAFTS_BUCKET.get(publishStateObjectKey(env));
  if (!object) {
    return createDefaultPublishState();
  }

  try {
    const payload = await object.json();
    const state = createDefaultPublishState();
    const artifact = payload?.artifact || {};

    return {
      ...state,
      requestId: String(payload?.requestId || ''),
      adminId: String(payload?.adminId || ''),
      workflow: String(payload?.workflow || ''),
      workflowRef: String(payload?.workflowRef || ''),
      workflowRunId: String(payload?.workflowRunId || ''),
      workflowRunUrl: String(payload?.workflowRunUrl || ''),
      status: normalizePublishStatus(payload?.status) || 'idle',
      startedAt: String(payload?.startedAt || ''),
      completedAt: String(payload?.completedAt || ''),
      updatedAt: String(payload?.updatedAt || ''),
      latestPublishedVersion: String(payload?.latestPublishedVersion || ''),
      latestPublishedSha: String(payload?.latestPublishedSha || ''),
      artifact: {
        id: String(artifact?.id || ''),
        name: String(artifact?.name || ''),
        archiveUrl: String(artifact?.archiveUrl || ''),
        unavailable: artifact?.unavailable === true
      },
      message: String(payload?.message || '')
    };
  } catch {
    return createDefaultPublishState();
  }
}

async function writePublishState(env, publishState) {
  const normalized = {
    ...createDefaultPublishState(),
    ...publishState,
    status: normalizePublishStatus(publishState?.status) || 'idle',
    artifact: {
      ...createDefaultArtifactInfo(),
      ...(publishState?.artifact || {})
    },
    updatedAt: publishState?.updatedAt || new Date().toISOString()
  };

  await env.DRAFTS_BUCKET.put(publishStateObjectKey(env), JSON.stringify(normalized), {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8'
    }
  });

  return normalized;
}

async function handlePublishStatus(env, corsHeaders) {
  let publishState = await readPublishState(env);

  if (!publishState.latestPublishedVersion && env.GH_OWNER && env.GH_REPO) {
    const marker = await readContentVersionMarkerFromRepo(env, env.GH_OWNER, env.GH_REPO, env.GH_REF || 'main');
    if (marker) {
      publishState = await writePublishState(env, {
        ...publishState,
        latestPublishedVersion: marker.versionId,
        latestPublishedSha: marker.contentSha256,
        message: publishState.message || 'Publish state synchronized from repository marker.'
      });
    }
  }

  return json(
    {
      ok: true,
      publishState
    },
    200,
    corsHeaders
  );
}

async function resolveLatestArtifactForRun(env, owner, repo, workflowRunId) {
  if (!workflowRunId) {
    return null;
  }

  const response = await githubRequest(
    env,
    `https://api.github.com/repos/${owner}/${repo}/actions/runs/${encodeURIComponent(workflowRunId)}/artifacts`
  );

  if (!response.ok) {
    return null;
  }

  try {
    const payload = JSON.parse(response.text);
    const artifacts = Array.isArray(payload?.artifacts) ? payload.artifacts : [];
    const candidate = artifacts.find((artifact) => artifact?.expired !== true) || artifacts[0];
    if (!candidate) {
      return null;
    }

    return {
      id: String(candidate.id || ''),
      name: String(candidate.name || ''),
      archiveUrl: String(candidate.archive_download_url || ''),
      unavailable: candidate.expired === true
    };
  } catch {
    return null;
  }
}

async function readContentVersionMarkerFromRepo(env, owner, repo, ref) {
  const response = await githubRequest(
    env,
    `https://api.github.com/repos/${owner}/${repo}/contents/static/content-version.json?ref=${encodeURIComponent(ref)}`
  );

  if (!response.ok) {
    return null;
  }

  try {
    const payload = JSON.parse(response.text);
    const encoded = String(payload?.content || '').replace(/\s+/g, '');
    if (!encoded) {
      return null;
    }

    const marker = JSON.parse(atob(encoded));
    const versionId = String(marker?.versionId || '').trim();
    const contentSha256 = String(marker?.contentSha256 || '').trim();
    if (!versionId) {
      return null;
    }

    return {
      versionId,
      contentSha256
    };
  } catch {
    return null;
  }
}

async function handlePublishUpdate(body, env, corsHeaders) {
  const previous = await readPublishState(env);
  const nextStatus = normalizePublishStatus(body?.status);
  if (!nextStatus) {
    return json({ ok: false, error: 'status is required' }, 400, corsHeaders);
  }

  const owner = env.GH_OWNER;
  const repo = env.GH_REPO;
  const now = new Date().toISOString();

  const next = {
    ...previous,
    requestId: String(body?.requestId || previous.requestId || ''),
    adminId: String(body?.adminId || previous.adminId || ''),
    workflowRunId: String(body?.workflowRunId || previous.workflowRunId || ''),
    workflowRunUrl: String(body?.workflowRunUrl || previous.workflowRunUrl || ''),
    status: nextStatus,
    updatedAt: now,
    message: String(body?.message || previous.message || '')
  };

  if (nextStatus === 'running' && !next.startedAt) {
    next.startedAt = now;
    next.completedAt = '';
  }

  if (nextStatus === 'pending') {
    next.startedAt = next.startedAt || now;
    next.completedAt = '';
  }

  if (nextStatus === 'succeeded' || nextStatus === 'failed' || nextStatus === 'artifact-unavailable') {
    next.completedAt = String(body?.completedAt || now);
  }

  if (nextStatus === 'succeeded') {
    next.latestPublishedVersion = String(body?.versionId || next.latestPublishedVersion || '');
    next.latestPublishedSha = String(body?.contentSha256 || next.latestPublishedSha || '');

    const callbackArtifact = {
      id: String(body?.artifactId || ''),
      name: String(body?.artifactName || ''),
      archiveUrl: String(body?.artifactArchiveUrl || ''),
      unavailable: body?.artifactUnavailable === true
    };

    let resolvedArtifact = callbackArtifact;
    if (!resolvedArtifact.id && owner && repo && next.workflowRunId) {
      const found = await resolveLatestArtifactForRun(env, owner, repo, next.workflowRunId);
      if (found) {
        resolvedArtifact = found;
      }
    }

    if (!resolvedArtifact.id && !resolvedArtifact.archiveUrl) {
      next.status = 'artifact-unavailable';
      next.message = next.message || 'Publish completed but artifact metadata is unavailable.';
      next.artifact = {
        ...createDefaultArtifactInfo(),
        unavailable: true
      };
    } else {
      next.artifact = {
        ...createDefaultArtifactInfo(),
        ...resolvedArtifact,
        unavailable: resolvedArtifact.unavailable === true
      };
      next.message = next.message || 'Publish completed and artifact is ready.';
    }
  }

  if (nextStatus === 'failed') {
    next.message = next.message || 'Publish workflow failed.';
  }

  if (nextStatus === 'artifact-unavailable') {
    next.artifact = {
      ...createDefaultArtifactInfo(),
      unavailable: true
    };
    next.message = next.message || 'Publish completed but artifact is unavailable.';
  }

  const persisted = await writePublishState(env, next);
  return json({ ok: true, publishState: persisted }, 200, corsHeaders);
}

async function handlePublishArtifact(env, corsHeaders) {
  const publishState = await readPublishState(env);
  const artifactId = publishState?.artifact?.id || '';
  const owner = env.GH_OWNER;
  const repo = env.GH_REPO;

  if (!owner || !repo || !env.GH_TOKEN) {
    return json(
      {
        ok: false,
        error: 'Worker env missing GH_OWNER, GH_REPO, or GH_TOKEN'
      },
      500,
      corsHeaders
    );
  }

  if (!artifactId) {
    return json(
      {
        ok: false,
        error: 'Latest artifact is unavailable. Please rerun publish.'
      },
      404,
      corsHeaders
    );
  }

  const artifactUrl = `https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${encodeURIComponent(artifactId)}/zip`;
  const artifactResponse = await fetch(artifactUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${env.GH_TOKEN}`,
      'User-Agent': 'emanual-publish-api-worker',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

  if (!artifactResponse.ok) {
    const details = await safeText(artifactResponse);
    return json(
      {
        ok: false,
        error: 'Unable to download latest artifact from GitHub.',
        status: artifactResponse.status,
        details
      },
      502,
      corsHeaders
    );
  }

  const safeName = String(publishState?.artifact?.name || `site-build-${artifactId}`)
    .replace(/[^a-zA-Z0-9._-]/g, '_');

  return new Response(artifactResponse.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${safeName}.zip"`
    }
  });
}

function draftObjectKey(env) {
  return env.DRAFT_KEY || 'drafts/shared/latest.json';
}

async function readDraftEnvelope(env) {
  const key = draftObjectKey(env);
  const object = await env.DRAFTS_BUCKET.get(key);
  if (!object) {
    return { exists: false };
  }

  let payload;
  try {
    payload = await object.json();
  } catch {
    return { exists: false, invalid: true };
  }

  const revision = Number(payload?.revision || 0);
  return {
    exists: true,
    revision,
    updatedAt: payload?.updatedAt || null,
    updatedBy: payload?.updatedBy || null,
    editedJSON: payload?.editedJSON || null
  };
}

function validateEditedJsonShape(editedJSON) {
  if (!editedJSON || typeof editedJSON !== 'object') {
    return 'editedJSON is required';
  }

  const requiredKeys = ['config', 'testData', 'formData', 'containerData'];
  for (const key of requiredKeys) {
    if (!(key in editedJSON)) {
      return `editedJSON missing key: ${key}`;
    }
  }

  return '';
}

async function handleDraftLoad(env, corsHeaders) {
  const current = await readDraftEnvelope(env);
  if (!current.exists) {
    return json({ ok: true, exists: false }, 200, corsHeaders);
  }

  if (current.invalid) {
    return json({ ok: false, error: 'Stored draft is invalid JSON' }, 500, corsHeaders);
  }

  return json(
    {
      ok: true,
      exists: true,
      revision: current.revision,
      updatedAt: current.updatedAt,
      updatedBy: current.updatedBy,
      editedJSON: current.editedJSON
    },
    200,
    corsHeaders
  );
}

async function handleDraftSave(body, env, corsHeaders) {
  const editedJSON = body?.editedJSON;
  const expectedRevision = Number(body?.expectedRevision ?? 0);
  const editorId = String(body?.editorId || 'unknown-editor');

  const validationError = validateEditedJsonShape(editedJSON);
  if (validationError) {
    return json({ ok: false, error: validationError }, 400, corsHeaders);
  }

  const current = await readDraftEnvelope(env);
  const currentRevision = current.exists ? Number(current.revision || 0) : 0;

  if (expectedRevision !== currentRevision) {
    return json(
      {
        ok: false,
        error: 'Revision conflict',
        code: 'REVISION_CONFLICT',
        currentRevision,
        updatedAt: current.updatedAt || null,
        updatedBy: current.updatedBy || null
      },
      409,
      corsHeaders
    );
  }

  const nextRevision = currentRevision + 1;
  const updatedAt = new Date().toISOString();
  const payload = {
    revision: nextRevision,
    updatedAt,
    updatedBy: editorId,
    editedJSON
  };

  await env.DRAFTS_BUCKET.put(draftObjectKey(env), JSON.stringify(payload), {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8'
    }
  });

  return json(
    {
      ok: true,
      revision: nextRevision,
      updatedAt,
      updatedBy: editorId
    },
    200,
    corsHeaders
  );
}

async function handleDraftDiscard(body, env, corsHeaders) {
  const expectedRevision = body?.expectedRevision;
  const editorId = String(body?.editorId || 'unknown-editor');
  const current = await readDraftEnvelope(env);

  if (!current.exists) {
    return json({ ok: true, discarded: false, message: 'No draft to discard' }, 200, corsHeaders);
  }

  if (expectedRevision !== undefined && Number(expectedRevision) !== Number(current.revision || 0)) {
    return json(
      {
        ok: false,
        error: 'Revision conflict',
        code: 'REVISION_CONFLICT',
        currentRevision: Number(current.revision || 0),
        updatedAt: current.updatedAt || null,
        updatedBy: current.updatedBy || null
      },
      409,
      corsHeaders
    );
  }

  await env.DRAFTS_BUCKET.delete(draftObjectKey(env));
  return json(
    {
      ok: true,
      discarded: true,
      discardedBy: editorId,
      discardedAt: new Date().toISOString()
    },
    200,
    corsHeaders
  );
}

function issuesObjectKey(env) {
  return env.ISSUES_KEY || 'issues/shared/latest.json';
}

async function readIssuesEnvelope(env) {
  const key = issuesObjectKey(env);
  const object = await env.DRAFTS_BUCKET.get(key);
  if (!object) {
    return {
      exists: false,
      revision: 0,
      issues: [],
      updatedAt: null,
      updatedBy: null
    };
  }

  try {
    const payload = await object.json();
    const issues = Array.isArray(payload?.issues) ? payload.issues : [];
    return {
      exists: true,
      revision: Number(payload?.revision || 0),
      issues,
      updatedAt: payload?.updatedAt || null,
      updatedBy: payload?.updatedBy || null
    };
  } catch {
    return {
      exists: false,
      invalid: true,
      revision: 0,
      issues: [],
      updatedAt: null,
      updatedBy: null
    };
  }
}

async function writeIssuesEnvelope(env, revision, updatedBy, issues) {
  const payload = {
    revision,
    updatedAt: new Date().toISOString(),
    updatedBy,
    issues
  };

  await env.DRAFTS_BUCKET.put(issuesObjectKey(env), JSON.stringify(payload), {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8'
    }
  });

  return payload;
}

function normalizeIssueStatus(input) {
  const value = String(input || '').trim().toLowerCase();
  if (['open', 'in-progress', 'blocked', 'resolved', 'closed'].includes(value)) {
    return value;
  }
  return 'open';
}

function normalizeIssueRefs(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  const refs = [];
  const seen = new Set();
  for (const rawRef of input) {
    const type = String(rawRef?.type || '').trim().toLowerCase();
    const id = Number(rawRef?.id);
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

function normalizeIssue(input, actor, now) {
  const title = String(input?.title || '').trim();
  const description = String(input?.description || '').trim();
  if (!title) {
    return { ok: false, error: 'Issue title is required' };
  }

  const issue = {
    id: String(input?.id || `ISSUE-${Date.now()}`),
    title,
    description,
    status: normalizeIssueStatus(input?.status),
    targetDate: input?.targetDate ? String(input.targetDate) : '',
    closureDate: input?.closureDate ? String(input.closureDate) : '',
    entryRefs: normalizeIssueRefs(input?.entryRefs),
    actions: Array.isArray(input?.actions) ? input.actions : [],
    timeline: Array.isArray(input?.timeline) ? input.timeline : [],
    createdAt: input?.createdAt ? String(input.createdAt) : now,
    createdBy: input?.createdBy ? String(input.createdBy) : actor,
    updatedAt: now,
    updatedBy: actor
  };

  return { ok: true, issue };
}

function issueTimelineEvent(actor, eventType, message, details = {}) {
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    actor,
    eventType,
    message,
    details
  };
}

function normalizeIssueAction(input, actor, now) {
  const text = String(input?.text || '').trim();
  if (!text) {
    return { ok: false, error: 'Action text is required' };
  }

  const status = String(input?.status || 'todo').trim().toLowerCase() === 'done' ? 'done' : 'todo';
  return {
    ok: true,
    action: {
      id: String(input?.id || `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      text,
      status,
      dueDate: input?.dueDate ? String(input.dueDate) : '',
      completedAt: status === 'done' ? now : '',
      createdAt: input?.createdAt ? String(input.createdAt) : now,
      createdBy: input?.createdBy ? String(input.createdBy) : actor,
      updatedAt: now,
      updatedBy: actor
    }
  };
}

async function handleIssuesLoad(env, corsHeaders) {
  const envelope = await readIssuesEnvelope(env);
  if (envelope.invalid) {
    return json({ ok: false, error: 'Stored issues payload is invalid' }, 500, corsHeaders);
  }

  return json(
    {
      ok: true,
      revision: envelope.revision,
      updatedAt: envelope.updatedAt,
      updatedBy: envelope.updatedBy,
      issues: envelope.issues
    },
    200,
    corsHeaders
  );
}

async function handleIssueCreate(body, env, corsHeaders) {
  const actor = String(body?.actor || 'admin');
  const now = new Date().toISOString();
  const normalized = normalizeIssue(body?.issue, actor, now);
  if (!normalized.ok) {
    return json({ ok: false, error: normalized.error }, 400, corsHeaders);
  }

  const envelope = await readIssuesEnvelope(env);
  const issue = normalized.issue;
  issue.timeline.push(issueTimelineEvent(actor, 'created', 'Issue created'));
  const nextIssues = [...envelope.issues, issue];
  const nextRevision = envelope.revision + 1;
  const payload = await writeIssuesEnvelope(env, nextRevision, actor, nextIssues);

  return json(
    {
      ok: true,
      revision: payload.revision,
      updatedAt: payload.updatedAt,
      updatedBy: payload.updatedBy,
      issue
    },
    200,
    corsHeaders
  );
}

async function handleIssueUpdate(body, env, corsHeaders) {
  const issueId = String(body?.issueId || '').trim();
  const patch = body?.patch;
  const actor = String(body?.actor || 'admin');
  if (!issueId) {
    return json({ ok: false, error: 'issueId is required' }, 400, corsHeaders);
  }
  if (!patch || typeof patch !== 'object') {
    return json({ ok: false, error: 'patch is required' }, 400, corsHeaders);
  }

  const envelope = await readIssuesEnvelope(env);
  const index = envelope.issues.findIndex((item) => String(item?.id) === issueId);
  if (index === -1) {
    return json({ ok: false, error: 'Issue not found' }, 404, corsHeaders);
  }

  const now = new Date().toISOString();
  const issue = { ...envelope.issues[index] };
  const changes = {};

  if ('title' in patch) {
    const value = String(patch.title || '').trim();
    if (!value) {
      return json({ ok: false, error: 'title cannot be empty' }, 400, corsHeaders);
    }
    issue.title = value;
    changes.title = value;
  }

  if ('description' in patch) {
    const value = String(patch.description || '');
    issue.description = value;
    changes.description = value;
  }

  if ('status' in patch) {
    const value = normalizeIssueStatus(patch.status);
    issue.status = value;
    changes.status = value;
  }

  if ('targetDate' in patch) {
    const value = patch.targetDate ? String(patch.targetDate) : '';
    issue.targetDate = value;
    changes.targetDate = value;
  }

  if ('closureDate' in patch) {
    const value = patch.closureDate ? String(patch.closureDate) : '';
    issue.closureDate = value;
    changes.closureDate = value;
  }

  if ('entryRefs' in patch) {
    const value = normalizeIssueRefs(patch.entryRefs);
    issue.entryRefs = value;
    changes.entryRefs = value;
  }

  issue.updatedAt = now;
  issue.updatedBy = actor;
  issue.timeline = Array.isArray(issue.timeline) ? issue.timeline : [];
  issue.timeline.push(issueTimelineEvent(actor, 'updated', 'Issue updated', changes));

  const nextIssues = [...envelope.issues];
  nextIssues[index] = issue;
  const nextRevision = envelope.revision + 1;
  const payload = await writeIssuesEnvelope(env, nextRevision, actor, nextIssues);

  return json(
    {
      ok: true,
      revision: payload.revision,
      updatedAt: payload.updatedAt,
      updatedBy: payload.updatedBy,
      issue
    },
    200,
    corsHeaders
  );
}

async function handleIssueAddAction(body, env, corsHeaders) {
  const issueId = String(body?.issueId || '').trim();
  const actor = String(body?.actor || 'admin');
  if (!issueId) {
    return json({ ok: false, error: 'issueId is required' }, 400, corsHeaders);
  }

  const envelope = await readIssuesEnvelope(env);
  const index = envelope.issues.findIndex((item) => String(item?.id) === issueId);
  if (index === -1) {
    return json({ ok: false, error: 'Issue not found' }, 404, corsHeaders);
  }

  const now = new Date().toISOString();
  const normalized = normalizeIssueAction(body?.action, actor, now);
  if (!normalized.ok) {
    return json({ ok: false, error: normalized.error }, 400, corsHeaders);
  }

  const issue = { ...envelope.issues[index] };
  issue.actions = Array.isArray(issue.actions) ? issue.actions : [];
  issue.actions.push(normalized.action);
  issue.updatedAt = now;
  issue.updatedBy = actor;
  issue.timeline = Array.isArray(issue.timeline) ? issue.timeline : [];
  issue.timeline.push(
    issueTimelineEvent(actor, 'action-added', 'Follow-up action added', {
      actionId: normalized.action.id,
      text: normalized.action.text
    })
  );

  const nextIssues = [...envelope.issues];
  nextIssues[index] = issue;
  const nextRevision = envelope.revision + 1;
  const payload = await writeIssuesEnvelope(env, nextRevision, actor, nextIssues);

  return json(
    {
      ok: true,
      revision: payload.revision,
      updatedAt: payload.updatedAt,
      updatedBy: payload.updatedBy,
      issue
    },
    200,
    corsHeaders
  );
}

async function handleIssueUpdateAction(body, env, corsHeaders) {
  const issueId = String(body?.issueId || '').trim();
  const actionId = String(body?.actionId || '').trim();
  const patch = body?.patch;
  const actor = String(body?.actor || 'admin');
  if (!issueId || !actionId) {
    return json({ ok: false, error: 'issueId and actionId are required' }, 400, corsHeaders);
  }
  if (!patch || typeof patch !== 'object') {
    return json({ ok: false, error: 'patch is required' }, 400, corsHeaders);
  }

  const envelope = await readIssuesEnvelope(env);
  const index = envelope.issues.findIndex((item) => String(item?.id) === issueId);
  if (index === -1) {
    return json({ ok: false, error: 'Issue not found' }, 404, corsHeaders);
  }

  const now = new Date().toISOString();
  const issue = { ...envelope.issues[index] };
  issue.actions = Array.isArray(issue.actions) ? issue.actions : [];
  const actionIndex = issue.actions.findIndex((item) => String(item?.id) === actionId);
  if (actionIndex === -1) {
    return json({ ok: false, error: 'Action not found' }, 404, corsHeaders);
  }

  const action = { ...issue.actions[actionIndex] };
  const actionChanges = {};

  if ('text' in patch) {
    const value = String(patch.text || '').trim();
    if (!value) {
      return json({ ok: false, error: 'Action text cannot be empty' }, 400, corsHeaders);
    }
    action.text = value;
    actionChanges.text = value;
  }

  if ('status' in patch) {
    const status = String(patch.status || 'todo').trim().toLowerCase() === 'done' ? 'done' : 'todo';
    action.status = status;
    action.completedAt = status === 'done' ? now : '';
    actionChanges.status = status;
  }

  if ('dueDate' in patch) {
    const value = patch.dueDate ? String(patch.dueDate) : '';
    action.dueDate = value;
    actionChanges.dueDate = value;
  }

  action.updatedAt = now;
  action.updatedBy = actor;
  issue.actions[actionIndex] = action;
  issue.updatedAt = now;
  issue.updatedBy = actor;
  issue.timeline = Array.isArray(issue.timeline) ? issue.timeline : [];
  issue.timeline.push(
    issueTimelineEvent(actor, 'action-updated', 'Follow-up action updated', {
      actionId,
      changes: actionChanges
    })
  );

  const nextIssues = [...envelope.issues];
  nextIssues[index] = issue;
  const nextRevision = envelope.revision + 1;
  const payload = await writeIssuesEnvelope(env, nextRevision, actor, nextIssues);

  return json(
    {
      ok: true,
      revision: payload.revision,
      updatedAt: payload.updatedAt,
      updatedBy: payload.updatedBy,
      issue
    },
    200,
    corsHeaders
  );
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function safeText(resp) {
  try {
    return await resp.text();
  } catch {
    return '';
  }
}
