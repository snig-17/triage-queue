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

		if (url.pathname === '/' || url.pathname === '') {
			return Response.redirect(new URL('/app', url.origin).toString(), 302);
		}

		if (url.pathname === '/app') {
			if (method !== 'GET') return methodNotAllowed();
			return new Response(
				`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Triage Queue</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;background:#f9fafb;color:#111827;line-height:1.5}
.container{display:flex;height:100vh;gap:1px;background:#e5e7eb}
.left{flex:1;background:#fff;overflow:auto;display:flex;flex-direction:column}
.right{flex:1;background:#fff;overflow:auto;display:flex;flex-direction:column}
.header{padding:16px 20px;border-bottom:1px solid #e5e7eb;background:#fff;position:sticky;top:0;z-index:10}
.header h1{font-size:18px;font-weight:600}
.content{padding:20px;flex:1}
table{width:100%;border-collapse:collapse}
thead{position:sticky;top:57px;background:#f9fafb;z-index:5}
th{text-align:left;padding:10px 12px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e5e7eb}
td{padding:12px;border-bottom:1px solid #f3f4f6}
tr:hover{background:#f9fafb;cursor:pointer}
tr.selected{background:#eff6ff}
.priority-chip{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;text-transform:uppercase}
.priority-5{background:#fef2f2;color:#991b1b}
.priority-4{background:#fef3c7;color:#92400e}
.priority-3{background:#dbeafe;color:#1e40af}
.priority-2{background:#e0e7ff;color:#3730a3}
.priority-1{background:#f3f4f6;color:#6b7280}
.source-badge{display:inline-block;padding:2px 6px;border-radius:4px;font-size:11px;background:#f3f4f6;color:#4b5563}
.score{font-weight:600;color:#059669}
.empty{text-align:center;padding:40px;color:#9ca3af}
.detail-section{margin-bottom:24px}
.detail-section h2{font-size:14px;font-weight:600;margin-bottom:8px;color:#374151}
.detail-section p{font-size:14px;color:#6b7280;margin-bottom:8px}
.breakdown{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px}
.breakdown-item{padding:12px;background:#f9fafb;border-radius:8px}
.breakdown-item label{font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:600;display:block;margin-bottom:4px}
.breakdown-item .value{font-size:16px;font-weight:600;color:#111827}
.keywords{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.keyword{padding:4px 10px;background:#eff6ff;color:#1e40af;border-radius:12px;font-size:12px}
.form-group{margin-bottom:12px}
.form-group label{display:block;font-size:13px;font-weight:500;margin-bottom:4px;color:#374151}
.form-group input,.form-group textarea{width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;font-family:inherit}
.form-group input:focus,.form-group textarea:focus{outline:none;border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,0.1)}
.btn{padding:8px 16px;background:#111827;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:500;cursor:pointer}
.btn:hover{background:#1f2937}
.btn:disabled{background:#d1d5db;cursor:not-allowed}
.override-list{margin-top:12px}
.override-item{padding:12px;background:#f9fafb;border-radius:8px;margin-bottom:8px;font-size:13px}
.override-item .meta{color:#6b7280;font-size:11px;margin-bottom:4px}
.override-item .action{font-weight:600;color:#111827}
.loading{text-align:center;padding:20px;color:#9ca3af}
.error{padding:12px;background:#fef2f2;color:#991b1b;border-radius:6px;margin-bottom:12px;font-size:13px}
</style>
</head>
<body>
<div class="container">
<div class="left">
<div class="header"><h1>Queue</h1></div>
<div class="content">
<table id="queueTable">
<thead><tr><th>Priority</th><th>Feedback</th><th>Source</th><th>Score</th></tr></thead>
<tbody id="queueBody"><tr><td colspan="4" class="empty">Loading...</td></tr></tbody>
</table>
</div>
</div>
<div class="right">
<div class="header"><h1>Detail</h1></div>
<div class="content" id="detailContent">
<div class="empty">Select an item from the queue</div>
</div>
</div>
</div>
<script>
let selectedId=null;
async function loadQueue(){const tbody=document.getElementById('queueBody');try{const res=await fetch('/queue');const data=await res.json();if(!data.ok||!data.items||data.items.length===0){tbody.innerHTML='<tr><td colspan="4" class="empty">No items in queue</td></tr>';return}tbody.innerHTML=data.items.map(item=>{const priorityClass='priority-'+(item.priority||1);const priorityLabel=['','minimal','low','medium','high','critical'][item.priority||1]||'unknown';return \`<tr onclick="selectItem('\${item.feedback_id}')" class="\${selectedId===item.feedback_id?'selected':''}"><td><span class="priority-chip \${priorityClass}">\${priorityLabel}</span></td><td>\${escapeHtml((item.content||'').substring(0,60))}\${(item.content||'').length>60?'...':''}</td><td>\${item.source?'<span class="source-badge">'+escapeHtml(item.source)+'</span>':'-'}</td><td class="score">\${item.score||'-'}</td></tr>\`}).join('')}catch(e){console.error('Queue load error:',e);tbody.innerHTML='<tr><td colspan="4" class="error">Failed to load queue: '+e.message+'</td></tr>'}}
async function selectItem(id){selectedId=id;loadQueue();const detail=document.getElementById('detailContent');detail.innerHTML='<div class="loading">Loading...</div>';try{const res=await fetch('/item/'+encodeURIComponent(id));const data=await res.json();if(!data.ok||!data.feedback){detail.innerHTML='<div class="error">Item not found</div>';return}const fb=data.feedback;const analysis=data.analysis&&data.analysis.length>0?data.analysis[0]:null;const overrides=data.overrides||[];let html='<div class="detail-section"><h2>Feedback</h2><p>'+escapeHtml(fb.content)+'</p>';if(fb.source)html+='<p><span class="source-badge">'+escapeHtml(fb.source)+'</span></p>';html+='</div>';if(analysis&&analysis.signals_json){const signals=JSON.parse(analysis.signals_json);html+='<div class="detail-section"><h2>Analysis</h2><p>'+escapeHtml(signals.explanation||'')+'</p></div>';html+='<div class="detail-section"><h2>Factor Breakdown</h2><div class="breakdown">';html+='<div class="breakdown-item"><label>Sentiment</label><div class="value">'+escapeHtml(signals.sentiment||'-')+'</div></div>';html+='<div class="breakdown-item"><label>Severity</label><div class="value">'+signals.severity_signal+'/5</div></div>';html+='<div class="breakdown-item"><label>Business Risk</label><div class="value">'+signals.business_risk_signal+'/5</div></div>';html+='<div class="breakdown-item"><label>Confidence</label><div class="value">'+(signals.confidence*100).toFixed(0)+'%</div></div>';html+='</div></div>';if(signals.keywords&&signals.keywords.length>0){html+='<div class="detail-section"><h2>Keywords</h2><div class="keywords">'+signals.keywords.map(k=>'<span class="keyword">'+escapeHtml(k)+'</span>').join('')+'</div></div>'}}
if(analysis){html+='<div class="detail-section"><h2>Override Priority</h2><form id="overrideForm" onsubmit="submitOverride(event,\''+analysis.id+'\')"><div class="form-group"><label>New Priority (1-5)</label><input type="number" id="newPriority" min="1" max="5" required></div><div class="form-group"><label>Reason</label><textarea id="overrideReason" rows="2" required></textarea></div><button type="submit" class="btn">Submit Override</button></form></div>'}
if(overrides.length>0){html+='<div class="detail-section"><h2>Override History</h2><div class="override-list">'+overrides.map(o=>'<div class="override-item"><div class="meta">'+(o.created_at||'')+(o.actor?' by '+escapeHtml(o.actor):'')+'</div><div class="action">'+escapeHtml(o.action||'')+'</div>'+(o.payload_json?'<div>'+escapeHtml(o.payload_json)+'</div>':'')+'</div>').join('')+'</div></div>'}
detail.innerHTML=html}catch(e){detail.innerHTML='<div class="error">Failed to load item details</div>'}}
async function submitOverride(e,analysisId){e.preventDefault();const priority=parseInt(document.getElementById('newPriority').value);const reason=document.getElementById('overrideReason').value;const btn=e.target.querySelector('button');btn.disabled=true;btn.textContent='Submitting...';try{const overrideId='override-'+Date.now();const res=await fetch('/override/'+encodeURIComponent(analysisId),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:overrideId,priority,reason})});if(res.ok){await loadQueue();await selectItem(selectedId)}else{alert('Failed to submit override')}}catch(e){alert('Error: '+e.message)}finally{btn.disabled=false;btn.textContent='Submit Override'}}
function escapeHtml(str){const div=document.createElement('div');div.textContent=str;return div.innerHTML}
loadQueue();setInterval(loadQueue,10000);
</script>
</body>
</html>`,
				{ headers: { 'content-type': 'text/html; charset=utf-8' } },
			);
		}

		if (url.pathname === '/queue') {
			if (method !== 'GET') return methodNotAllowed();
			try {
				if (!env.DB) {
					return json({ ok: true, items: [] });
				}
				const { listQueue } = await import('./db');
				const items = await listQueue(env.DB, { limit: 100 });
				const enrichedItems = await Promise.all(
					items.map(async (item) => {
						const feedbackResult = await env.DB
							.prepare('SELECT content, source FROM feedback WHERE id = ?1')
							.bind(item.feedback_id)
							.first<{ content: string; source: string | null }>();
						return {
							...item,
							content: feedbackResult?.content || '',
							source: feedbackResult?.source || null,
						};
					}),
				);
				return json({ ok: true, items: enrichedItems });
			} catch (error) {
				return json(
					{ ok: false, error: 'Failed to load queue', details: error instanceof Error ? error.message : String(error) },
					{ status: 500 },
				);
			}
		}

		{
			const params = match('/item/:id', url.pathname);
			if (params) {
				if (method !== 'GET') return methodNotAllowed();
				try {
					if (!env.DB) {
						return json({ ok: false, error: 'Database not configured' }, { status: 500 });
					}
					const { getItemDetail } = await import('./db');
					const itemDetail = await getItemDetail(env.DB, params.id);
					if (!itemDetail) {
						return json({ ok: false, error: 'Item not found' }, { status: 404 });
					}
					return json({ ok: true, ...itemDetail });
				} catch (error) {
					return json(
						{ ok: false, error: 'Failed to load item', details: error instanceof Error ? error.message : String(error) },
						{ status: 500 },
					);
				}
			}
		}

		if (url.pathname === '/seed') {
			if (method !== 'POST') return methodNotAllowed();
			try {
				if (!env.DB) {
					return json({ ok: false, error: 'Database not configured' }, { status: 500 });
				}
				const { insertFeedback } = await import('./db');
				
				const seedData = [
					{ source: 'support', content: 'Complete outage - cannot access dashboard at all. Getting 503 errors for the past 30 minutes. This is blocking our entire team from working. URGENT!', priority: 'critical' },
					{ source: 'support', content: 'Login broken after password reset. Tried multiple times, keeps saying invalid credentials even with the new password. Cannot access my account.', priority: 'critical' },
					{ source: 'support', content: 'Billing issue - charged twice this month. Invoice #4521 and #4522 both processed for the same subscription period. Need immediate refund.', priority: 'critical' },
					{ source: 'github', content: 'API returning 500 errors on /api/users endpoint. Started happening after the 2.1.0 deploy. Affecting production traffic.', priority: 'high' },
					{ source: 'support', content: 'Data export feature timing out for datasets over 10k rows. Need this working ASAP for compliance reporting due next week.', priority: 'high' },
					{ source: 'x', content: '@yourapp why is the mobile app crashing every time I try to upload an image? iPhone 14, iOS 17. Literally unusable right now.', priority: 'high' },
					{ source: 'github', content: 'Memory leak in the background sync worker. Server RAM usage grows unbounded over 24-48 hours until restart required.', priority: 'high' },
					{ source: 'support', content: 'Cannot delete old projects. Delete button does nothing when clicked. Tried on Chrome and Firefox, same issue.', priority: 'medium' },
					{ source: 'github', content: 'Dark mode toggle not persisting after page refresh. Have to re-enable it every time I visit the site.', priority: 'medium' },
					{ source: 'x', content: 'Love the new dashboard redesign but the search is noticeably slower now. Takes 3-4 seconds vs instant before.', priority: 'medium' },
					{ source: 'support', content: 'Email notifications are delayed by 15-20 minutes. Not critical but makes real-time collaboration difficult.', priority: 'medium' },
					{ source: 'github', content: 'Feature request: Add keyboard shortcuts for common actions. Would really speed up my workflow.', priority: 'low' },
					{ source: 'support', content: 'Would be nice to have a CSV import option instead of just JSON. Not urgent but would be convenient.', priority: 'low' },
					{ source: 'x', content: 'Any plans to add a calendar view? Current list view is fine but calendar would be helpful for planning.', priority: 'low' },
					{ source: 'github', content: 'Documentation could use more examples for the webhooks API. Current docs are a bit sparse.', priority: 'low' },
					{ source: 'support', content: 'Minor UI bug: tooltip text is cut off on narrow screens. Not blocking anything but looks unprofessional.', priority: 'low' },
					{ source: 'x', content: 'The new color scheme is nice but could you add a high contrast mode for accessibility?', priority: 'low' },
					{ source: 'github', content: 'Feature idea: bulk actions for managing multiple items at once. Would save a lot of clicking.', priority: 'low' },
					{ source: 'support', content: 'Is there a way to customize the dashboard widgets? Would love to rearrange them to fit my workflow.', priority: 'low' },
					{ source: 'github', content: 'Small typo in the settings page: "Prefences" should be "Preferences". Just noticed it today.', priority: 'low' },
				];
				
				const inserted = [];
				for (let i = 0; i < seedData.length; i++) {
					const item = seedData[i];
					const id = `feedback-${Date.now()}-${i}`;
					await insertFeedback(env.DB, {
						id,
						source: item.source,
						content: item.content,
						metadata_json: JSON.stringify({ priority_hint: item.priority }),
					});
					inserted.push({ id, source: item.source });
				}
				
				return json({ ok: true, inserted: inserted.length, items: inserted });
			} catch (error) {
				return json(
					{ ok: false, error: 'Failed to seed data', details: error instanceof Error ? error.message : String(error) },
					{ status: 500 },
				);
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
				
				const feedbackId = params.id;
				
				try {
					const { analyzeFeedback } = await import('./ai');
					const { computeScoreAndPriority } = await import('./scoring');
					const { getItemDetail, upsertAnalysis } = await import('./db');
					
					if (!env.DB) {
						return json({ ok: false, error: 'Database binding not configured' }, { status: 500 });
					}
					
					if (!env.AI) {
						return json({ ok: false, error: 'AI binding not configured' }, { status: 500 });
					}
					
					const itemDetail = await getItemDetail(env.DB, feedbackId);
					if (!itemDetail) {
						return json({ ok: false, error: 'Feedback not found' }, { status: 404 });
					}
					
					const analysisId = `analysis-${feedbackId}-${Date.now()}`;
					
					await upsertAnalysis(env.DB, {
						id: analysisId,
						feedback_id: feedbackId,
						status: 'running',
						priority: 0,
					});
					
					const aiResult = await analyzeFeedback(env.AI, itemDetail.feedback.content);
					
					if (!aiResult.success) {
						await upsertAnalysis(env.DB, {
							id: analysisId,
							feedback_id: feedbackId,
							status: 'failed',
							priority: 0,
							error_text: aiResult.error,
							completed_at: new Date().toISOString(),
						});
						
						return json(
							{
								ok: false,
								error: 'AI analysis failed',
								details: aiResult.error,
								rawResponse: aiResult.rawResponse,
							},
							{ status: 500 },
						);
					}
					
					const scoringResult = computeScoreAndPriority(aiResult.signals);
					
					await upsertAnalysis(env.DB, {
						id: analysisId,
						feedback_id: feedbackId,
						status: 'done',
						priority: scoringResult.priority,
						score: scoringResult.score,
						signals_json: JSON.stringify(aiResult.signals),
						result_json: JSON.stringify(scoringResult),
						completed_at: new Date().toISOString(),
					});
					
					return json(
						{
							ok: true,
							analysis_id: analysisId,
							feedback_id: feedbackId,
							signals: aiResult.signals,
							scoring: scoringResult,
						},
						{ status: 200 },
					);
				} catch (error) {
					return json(
						{
							ok: false,
							error: 'Internal server error',
							details: error instanceof Error ? error.message : String(error),
						},
						{ status: 500 },
					);
				}
			}
		}

		{
			const params = match('/override/:id', url.pathname);
			if (params) {
				if (method !== 'POST') return methodNotAllowed();
				try {
					if (!env.DB) {
						return json({ ok: false, error: 'Database not configured' }, { status: 500 });
					}
					const payload = await readJson<{ id?: string; priority?: number; reason?: string }>();
					if (!payload || typeof payload.priority !== 'number') {
						return json({ ok: false, error: 'Invalid payload: priority required' }, { status: 400 });
					}
					const analysisId = params.id;
					const overrideId = payload.id || `override-${Date.now()}`;
					const { insertOverride, updateAnalysisPriority } = await import('./db');
					await insertOverride(env.DB, {
						id: overrideId,
						analysis_id: analysisId,
						action: 'set_priority',
						payload_json: JSON.stringify({ priority: payload.priority, reason: payload.reason }),
					});
					await updateAnalysisPriority(env.DB, analysisId, payload.priority);
					return json({ ok: true, override_id: overrideId, analysis_id: analysisId });
				} catch (error) {
					return json(
						{ ok: false, error: 'Failed to submit override', details: error instanceof Error ? error.message : String(error) },
						{ status: 500 },
					);
				}
			}
		}

		return notFound();
	},
} satisfies ExportedHandler<Env>;
