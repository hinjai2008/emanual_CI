/**
 * Cloudflare Worker: Publish endpoint for eManual
 *
 * POST /publish
 * Body: {
 *   editedJSON: object,
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

    if (url.pathname !== '/publish' || request.method !== 'POST') {
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

    const editedJSON = body?.editedJSON;
    const requestId = String(body?.requestId || `req-${Date.now()}`);
    const adminId = String(body?.adminId || 'ui-admin');
    const publishSummary = String(body?.publishSummary || '');
    const commitMessage = String(body?.commitMessage || `chore: update rawData.json (${requestId})`);  

    if (!editedJSON || typeof editedJSON !== 'object') {
      return json({ ok: false, error: 'editedJSON is required' }, 400, corsHeaders);
    }

    // Basic shape validation
    const requiredKeys = ['config', 'testData', 'formData', 'containerData'];
    for (const key of requiredKeys) {
      if (!(key in editedJSON)) {
        return json({ ok: false, error: `editedJSON missing key: ${key}` }, 400, corsHeaders);
      }
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
