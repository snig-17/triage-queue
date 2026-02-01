/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const method = request.method.toUpperCase();

		const json = (data: unknown, init: ResponseInit = {}) => {
			const headers = new Headers(init.headers);
			headers.set('content-type', 'application/json; charset=utf-8');
			return new Response(JSON.stringify(data), { ...init, headers });
		};

		const text = (body: string, init: ResponseInit = {}) => {
			const headers = new Headers(init.headers);
			if (!headers.has('content-type')) {
				headers.set('content-type', 'text/plain; charset=utf-8');
			}
			return new Response(body, { ...init, headers });
		};

		const notFound = () => text('Not found', { status: 404 });
		const methodNotAllowed = () => text('Method not allowed', { status: 405 });

		const match = (pattern: string, pathname: string): null | Record<string, string> => {
			const p = pattern.split('/').filter(Boolean);
			const a = pathname.split('/').filter(Boolean);
			if (p.length !== a.length) return null;
			const params: Record<string, string> = {};
			for (let i = 0; i < p.length; i++) {
				const part = p[i];
				const actual = a[i];
				if (part.startsWith(':')) {
					params[part.slice(1)] = decodeURIComponent(actual);
					continue;
				}
				if (part !== actual) return null;
			}
			return params;
		};

		const readJson = async <T = unknown>(): Promise<T | null> => {
			const ct = request.headers.get('content-type') ?? '';
			if (!ct.includes('application/json')) return null;
			try {
				return (await request.json()) as T;
			} catch {
				return null;
			}
		};

		if (url.pathname === '/app') {
			if (method !== 'GET') return methodNotAllowed();
			return new Response(
				'<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Triage Queue</title><style>body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:24px;max-width:900px}h1{font-size:20px}section{border:1px solid #ddd;border-radius:10px;padding:14px;margin:12px 0}label{display:block;margin:8px 0 4px}input,textarea{width:100%;padding:8px;border:1px solid #ccc;border-radius:8px}button{padding:8px 12px;border:1px solid #111;border-radius:10px;background:#111;color:#fff;cursor:pointer}pre{background:#0b1020;color:#e7e9ee;padding:12px;border-radius:10px;overflow:auto}</style></head><body><h1>Triage Queue</h1><p>Minimal stub UI for the Worker endpoints.</p><section><h2>Queue</h2><button id="refreshQueue">GET /queue</button></section><section><h2>Item</h2><label for="itemId">ID</label><input id="itemId" placeholder="123" /><button id="getItem">GET /item/:id</button></section><section><h2>Ingest</h2><label for="ingestPayload">JSON payload</label><textarea id="ingestPayload" rows="4">{"example":true}</textarea><button id="ingest">POST /ingest</button></section><section><h2>Analyze</h2><label for="analyzeId">ID</label><input id="analyzeId" placeholder="123" /><button id="analyze">POST /analyze/:id</button></section><section><h2>Override</h2><label for="overrideId">ID</label><input id="overrideId" placeholder="123" /><label for="overridePayload">JSON payload</label><textarea id="overridePayload" rows="4">{"status":"approved"}</textarea><button id="override">POST /override/:id</button></section><h2>Response</h2><pre id="out">(run a request)</pre><script>const out=document.getElementById("out");const show=async (res)=>{const ct=res.headers.get("content-type")||"";let body;try{body=ct.includes("application/json")?await res.json():await res.text();}catch(e){body=String(e);}out.textContent=JSON.stringify({status:res.status,body},null,2);};document.getElementById("refreshQueue").onclick=()=>show(fetch("/queue"));document.getElementById("getItem").onclick=()=>{const id=document.getElementById("itemId").value||"";return show(fetch(`/item/${encodeURIComponent(id)}`));};document.getElementById("ingest").onclick=()=>{let payload={};try{payload=JSON.parse(document.getElementById("ingestPayload").value||"{}");}catch(e){return out.textContent=`Invalid JSON: ${e}`;}return show(fetch("/ingest",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)}));};document.getElementById("analyze").onclick=()=>{const id=document.getElementById("analyzeId").value||"";return show(fetch(`/analyze/${encodeURIComponent(id)}`,{method:"POST"}));};document.getElementById("override").onclick=()=>{const id=document.getElementById("overrideId").value||"";let payload={};try{payload=JSON.parse(document.getElementById("overridePayload").value||"{}");}catch(e){return out.textContent=`Invalid JSON: ${e}`;}return show(fetch(`/override/${encodeURIComponent(id)}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)}));};</script></body></html>',
				{ headers: { 'content-type': 'text/html; charset=utf-8' } },
			);
		}

		if (url.pathname === '/queue') {
			if (method !== 'GET') return methodNotAllowed();
			return json({ ok: true, items: [] });
		}

		{
			const params = match('/item/:id', url.pathname);
			if (params) {
				if (method !== 'GET') return methodNotAllowed();
				return json({ ok: true, id: params.id, item: null });
			}
		}

		if (url.pathname === '/ingest') {
			if (method !== 'POST') return methodNotAllowed();
			const payload = await readJson<Record<string, unknown>>();
			return json({ ok: true, received: payload });
		}

		{
			const params = match('/analyze/:id', url.pathname);
			if (params) {
				if (method !== 'POST') return methodNotAllowed();
				return json({ ok: true, id: params.id, status: 'queued' }, { status: 202 });
			}
		}

		{
			const params = match('/override/:id', url.pathname);
			if (params) {
				if (method !== 'POST') return methodNotAllowed();
				const payload = await readJson<Record<string, unknown>>();
				return json({ ok: true, id: params.id, override: payload });
			}
		}

		return notFound();
	},
} satisfies ExportedHandler<Env>;
