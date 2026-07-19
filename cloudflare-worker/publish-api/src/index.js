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

    const actionsUrl = `https://github.com/${owner}/${repo}/actions/workflows/${workflowFile}`;

    return json(
      {
        ok: true,
        message: 'Content build workflow dispatched',
        workflow: workflowFile,
        requestId,
        draftRevision: draftEnvelope.revision,
        actionsUrl
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
