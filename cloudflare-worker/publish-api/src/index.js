/**
 * Cloudflare Worker: Publish endpoint for eManual
 *
 * POST /publish
 * Body: { editedJSON: object, commitMessage?: string }
 * Header: Authorization: Bearer <PUBLISH_SHARED_SECRET>
 *
 * Required Worker Secrets:
 * - GH_TOKEN               (GitHub token with Actions write and Contents write)
 * - PUBLISH_SHARED_SECRET  (shared secret for caller)
 *
 * Required Worker Vars:
 * - GH_OWNER               (e.g. hinjai2008)
 * - GH_REPO                (e.g. emanual)
 *
 * Optional Worker Vars:
 * - GH_WORKFLOW_FILE       (default: deploy-pages.yml)
 * - GH_REF                 (default: main)
 * - ALLOWED_ORIGIN         (default: *)
 * - GH_RAWDATA_PATH        (default: src/routes/rawData.json)
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

    // 1) Auth check
    const auth = request.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token || token !== env.PUBLISH_SHARED_SECRET) {
      return json({ ok: false, error: 'Unauthorized' }, 401, corsHeaders);
    }

    // 2) Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'Invalid JSON body' }, 400, corsHeaders);
    }

    const editedJSON = body?.editedJSON;
    const commitMessage = String(
      body?.commitMessage || 'chore: update rawData.json from publish API'
    );

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
    const workflowFile = env.GH_WORKFLOW_FILE || 'deploy-pages.yml';
    const ref = env.GH_REF || 'main';
    const rawDataPath = env.GH_RAWDATA_PATH || 'src/routes/rawData.json';

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

    const fileShaResult = await githubRequest(
      env,
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodePath(rawDataPath)}?ref=${encodeURIComponent(ref)}`,
      { method: 'GET' }
    );

    if (!fileShaResult.ok) {
      return json(
        {
          ok: false,
          error: 'Failed to read current rawData.json SHA from GitHub',
          status: fileShaResult.status,
          details: fileShaResult.text
        },
        502,
        corsHeaders
      );
    }

    let currentSha = '';
    try {
      const fileMeta = JSON.parse(fileShaResult.text || '{}');
      currentSha = fileMeta.sha || '';
    } catch {
      currentSha = '';
    }

    if (!currentSha) {
      return json(
        {
          ok: false,
          error: 'Could not determine rawData.json SHA from GitHub response',
          details: fileShaResult.text
        },
        502,
        corsHeaders
      );
    }

    const updateResp = await githubRequest(
      env,
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodePath(rawDataPath)}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          message: commitMessage,
          content: contentBase64,
          sha: currentSha,
          branch: ref
        })
      }
    );

    if (!updateResp.ok) {
      return json(
        {
          ok: false,
          error: 'Failed to commit rawData.json to GitHub',
          status: updateResp.status,
          details: updateResp.text
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
            commit_message: commitMessage
          }
        })
      }
    );

    if (!dispatchResp.ok) {
      return json(
        {
          ok: false,
          error: 'rawData.json committed, but failed to trigger GitHub workflow',
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
        message: 'Publish workflow dispatched',
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
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

function encodePath(path) {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
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
