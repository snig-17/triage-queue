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

// Export Workflow class for Cloudflare Workers runtime
export { AnalyzeFeedbackWorkflow } from './workflow';

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
			const html = `<!doctype html>
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
.status-badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;text-transform:uppercase}
.status-pending{background:#fef3c7;color:#92400e}
.status-assigned{background:#dbeafe;color:#1e40af}
.status-done{background:#d1fae5;color:#065f46}
.status-running{background:#e0e7ff;color:#3730a3;animation:pulse 2s ease-in-out infinite}
.status-failed{background:#fee2e2;color:#991b1b}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
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
.filters{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.filters select{padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;background:#fff;cursor:pointer}
.filters select:focus{outline:none;border-color:#3b82f6}
.btn-secondary{padding:6px 12px;background:#fff;color:#111827;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer}
.btn-secondary:hover{background:#f9fafb;border-color:#9ca3af}
.scoring-info{background:#eff6ff;border:1px solid #3b82f6;border-radius:8px;padding:16px;margin-bottom:16px}
.scoring-info h3{font-size:16px;font-weight:600;margin-bottom:8px;color:#1e40af}
.scoring-info p{font-size:14px;color:#1e40af;margin-bottom:12px}
.scoring-info ul{margin:12px 0;padding-left:20px}
.scoring-info li{font-size:13px;color:#1e40af;margin-bottom:6px}
.scoring-formula{background:#dbeafe;padding:10px;border-radius:6px;margin:10px 0;font-size:13px;color:#1e3a8a;font-family:ui-monospace,monospace}
</style>
</head>
<body>
<div class="container">
<div class="left">
<div class="header">
<div style="display:flex;justify-content:space-between;align-items:center">
<h1>Queue</h1>
<button class="btn-secondary" onclick="toggleScoringInfo()">ℹ️ Scoring Info</button>
</div>
<div class="filters">
<select id="priorityFilter" onchange="applyFilters()">
<option value="">All Priorities</option>
<option value="5">Critical (5)</option>
<option value="4">High (4)</option>
<option value="3">Medium (3)</option>
<option value="2">Low (2)</option>
<option value="1">Minimal (1)</option>
</select>
<select id="sourceFilter" onchange="applyFilters()">
<option value="">All Sources</option>
<option value="support">Support</option>
<option value="github">GitHub</option>
<option value="x">X (Twitter)</option>
</select>
<select id="statusFilter" onchange="applyFilters()">
<option value="pending,assigned">Active (Pending + Assigned)</option>
<option value="">All Statuses</option>
<option value="pending">Pending Only</option>
<option value="assigned">Assigned Only</option>
<option value="done">Done Only</option>
</select>
<select id="sortBy" onchange="applyFilters()">
<option value="time">Newest</option>
<option value="time_asc">Oldest</option>
<option value="score,time">Score</option>
</select>
<button class="btn-secondary" onclick="clearFilters()">Clear</button>
</div>
</div>
<div class="content">
<div id="scoringInfo" class="scoring-info" style="display:none">
<h3>How Scoring Works</h3>
<p>Each feedback item is analyzed by AI and assigned a score (0-100) and priority (1-5) based on:</p>
<div class="scoring-formula">
<strong>Score Formula:</strong><br>
Base = (Severity × 20) + (Business Risk × 15) + Sentiment Weight<br>
Final Score = Base × Confidence (0.0-1.0)
</div>
<ul>
<li><strong>Severity Signal (1-5):</strong> How serious is the issue? Weight: ×20</li>
<li><strong>Business Risk (1-5):</strong> Impact on business operations. Weight: ×15</li>
<li><strong>Sentiment:</strong> Negative=+15, Neutral=+5, Positive=+0</li>
<li><strong>Confidence (0.0-1.0):</strong> AI's certainty in the analysis</li>
</ul>
<div class="scoring-formula">
<strong>Priority Tiers:</strong><br>
Score ≥70 → Priority 5 (Critical)<br>
Score ≥50 → Priority 4 (High)<br>
Score ≥30 → Priority 3 (Medium)<br>
Score ≥15 → Priority 2 (Low)<br>
Score <15 → Priority 1 (Minimal)
</div>
<p style="margin-top:12px;font-size:13px"><strong>Status & Queue Ordering:</strong> Items are sorted by status first, then priority, then time. Pending items appear at the top (most urgent), followed by Assigned, then Done items at the bottom. The default view shows only Active items (Pending + Assigned) to focus on actionable work.</p>
<button class="btn-secondary" onclick="toggleScoringInfo()">Close</button>
</div>
<table id="queueTable">
<thead><tr><th>Priority</th><th>Feedback</th><th>Source</th><th>Status</th><th>Score</th></tr></thead>
<tbody id="queueBody"><tr><td colspan="5" class="empty">Loading...</td></tr></tbody>
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
function escapeHtml(str){const div=document.createElement('div');div.textContent=str;return div.innerHTML}
function toggleScoringInfo(){
const info=document.getElementById('scoringInfo');
info.style.display=info.style.display==='none'?'block':'none';
}
function applyFilters(){
loadQueue();
}
function clearFilters(){
document.getElementById('priorityFilter').value='';
document.getElementById('sourceFilter').value='';
document.getElementById('statusFilter').value='';
document.getElementById('sortBy').value='time';
loadQueue();
}
async function loadQueue(){
const tbody=document.getElementById('queueBody');
try{
const priority=document.getElementById('priorityFilter').value;
const source=document.getElementById('sourceFilter').value;
const status=document.getElementById('statusFilter').value;
const sortBy=document.getElementById('sortBy').value;
const params=new URLSearchParams();
if(priority)params.append('priority',priority);
if(source)params.append('source',source);
if(status){
const statuses=status.split(',');
statuses.forEach(s=>params.append('status',s.trim()));
}
if(sortBy)params.append('sort',sortBy);
const queryString=params.toString();
const url='/queue'+(queryString?'?'+queryString:'');
const res=await fetch(url);
const data=await res.json();
if(!data.ok||!data.items||data.items.length===0){
tbody.innerHTML='<tr><td colspan="5" class="empty">No items in queue</td></tr>';
return;
}
const rows=data.items.map(item=>{
const priorityClass='priority-'+(item.priority||1);
const labels={1:'minimal',2:'low',3:'medium',4:'high',5:'critical'};
const priorityLabel=labels[item.priority]||'unknown';
const selected=selectedId===item.feedback_id?'selected':'';
const content=(item.content||'').substring(0,60);
const contentPreview=escapeHtml(content)+(item.content&&item.content.length>60?'...':'');
const sourceBadge=item.source?'<span class="source-badge">'+escapeHtml(item.source)+'</span>':'-';
const statusClass='status-'+item.status;
let statusBadge='<span class="status-badge '+statusClass+'">'+item.status+'</span>';
if(item.status==='running'){
statusBadge='<span class="status-badge '+statusClass+'">analyzing...</span>';
}
const score=item.score||'-';
return '<tr data-id="'+escapeHtml(item.feedback_id)+'" class="queue-row '+selected+'"><td><span class="priority-chip '+priorityClass+'">'+priorityLabel+'</span></td><td>'+contentPreview+'</td><td>'+sourceBadge+'</td><td>'+statusBadge+'</td><td class="score">'+score+'</td></tr>';
});
tbody.innerHTML=rows.join('');
document.querySelectorAll('.queue-row').forEach(row=>{
row.onclick=()=>selectItem(row.getAttribute('data-id'));
});
}catch(e){
console.error('Queue load error:',e);
tbody.innerHTML='<tr><td colspan="5" class="error">Failed to load queue: '+e.message+'</td></tr>';
}
}
async function selectItem(id){
selectedId=id;
loadQueue();
const detail=document.getElementById('detailContent');
detail.innerHTML='<div class="loading">Loading...</div>';
try{
const res=await fetch('/item/'+encodeURIComponent(id));
const data=await res.json();
if(!data.ok||!data.feedback){
detail.innerHTML='<div class="error">Item not found</div>';
return;
}
const fb=data.feedback;
const analysis=data.analysis&&data.analysis.length>0?data.analysis[0]:null;
const overrides=data.overrides||[];
let html='<div class="detail-section"><h2>Feedback</h2><p>'+escapeHtml(fb.content)+'</p>';
if(fb.source)html+='<p><span class="source-badge">'+escapeHtml(fb.source)+'</span></p>';
html+='</div>';
if(analysis&&analysis.status==='running'){
html+='<div class="detail-section"><div style="padding:20px;background:#eff6ff;border-radius:8px;text-align:center"><div style="font-size:16px;font-weight:600;color:#1e40af;margin-bottom:8px">🔄 Analyzing...</div><div style="font-size:13px;color:#3730a3">Workflow is processing this feedback. Results will appear shortly.</div></div></div>';
}
if(analysis&&analysis.status==='failed'){
html+='<div class="detail-section"><div style="padding:16px;background:#fee2e2;border-radius:8px"><div style="font-size:14px;font-weight:600;color:#991b1b;margin-bottom:8px">⚠️ Analysis Failed</div>';
if(analysis.error_text)html+='<div style="font-size:13px;color:#991b1b;margin-bottom:12px">'+escapeHtml(analysis.error_text)+'</div>';
html+='<button class="btn" onclick="retryAnalysis(\''+fb.id+'\')">Retry Analysis</button></div></div>';
}
if(analysis&&analysis.signals_json){
const signals=JSON.parse(analysis.signals_json);
html+='<div class="detail-section"><h2>Analysis</h2><p>'+escapeHtml(signals.explanation||'')+'</p></div>';
html+='<div class="detail-section"><h2>Factor Breakdown</h2><div class="breakdown">';
html+='<div class="breakdown-item"><label>Sentiment</label><div class="value">'+escapeHtml(signals.sentiment||'-')+'</div></div>';
html+='<div class="breakdown-item"><label>Severity</label><div class="value">'+signals.severity_signal+'/5</div></div>';
html+='<div class="breakdown-item"><label>Business Risk</label><div class="value">'+signals.business_risk_signal+'/5</div></div>';
html+='<div class="breakdown-item"><label>Confidence</label><div class="value">'+(signals.confidence*100).toFixed(0)+'%</div></div>';
html+='</div></div>';
if(signals.keywords&&signals.keywords.length>0){
html+='<div class="detail-section"><h2>Keywords</h2><div class="keywords">'+signals.keywords.map(k=>'<span class="keyword">'+escapeHtml(k)+'</span>').join('')+'</div></div>';
}
}
if(analysis){
html+='<div class="detail-section"><h2>Change Status</h2><form id="statusForm" data-analysis-id="'+escapeHtml(analysis.id)+'"><div class="form-group"><label>Status</label><select id="newStatus" required><option value="pending">Pending</option><option value="assigned">Assigned</option><option value="done">Done</option></select></div><button type="submit" class="btn">Update Status</button></form></div>';
html+='<div class="detail-section"><h2>Override Priority</h2><form id="overrideForm" data-analysis-id="'+escapeHtml(analysis.id)+'"><div class="form-group"><label>New Priority (1-5)</label><input type="number" id="newPriority" min="1" max="5" required></div><div class="form-group"><label>Reason</label><textarea id="overrideReason" rows="2" required></textarea></div><button type="submit" class="btn">Submit Override</button></form></div>';
}
if(overrides.length>0){
html+='<div class="detail-section"><h2>Override History</h2><div class="override-list">'+overrides.map(o=>'<div class="override-item"><div class="meta">'+(o.created_at||'')+(o.actor?' by '+escapeHtml(o.actor):'')+'</div><div class="action">'+escapeHtml(o.action||'')+'</div>'+(o.payload_json?'<div>'+escapeHtml(o.payload_json)+'</div>':'')+'</div>').join('')+'</div></div>';
}
detail.innerHTML=html;
const statusForm=document.getElementById('statusForm');
if(statusForm){
statusForm.onsubmit=(e)=>{
e.preventDefault();
const analysisId=statusForm.getAttribute('data-analysis-id');
const newStatus=document.getElementById('newStatus').value;
updateStatus(analysisId,newStatus);
};
}
const form=document.getElementById('overrideForm');
if(form){
form.onsubmit=(e)=>{
e.preventDefault();
const analysisId=form.getAttribute('data-analysis-id');
submitOverride(analysisId);
};
}
if(analysis&&analysis.status==='running'){
setTimeout(()=>selectItem(id),3000);
}
}catch(e){
detail.innerHTML='<div class="error">Failed to load item details</div>';
}
}
async function retryAnalysis(feedbackId){
try{
const res=await fetch('/analyze/'+encodeURIComponent(feedbackId),{method:'POST'});
if(res.ok){
await loadQueue();
await selectItem(feedbackId);
alert('Analysis restarted successfully');
}else{
alert('Failed to retry analysis');
}
}catch(e){
alert('Error: '+e.message);
}
}
async function updateStatus(analysisId,newStatus){
const form=document.getElementById('statusForm');
const btn=form.querySelector('button');
btn.disabled=true;
btn.textContent='Updating...';
try{
const res=await fetch('/status/'+encodeURIComponent(analysisId),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({status:newStatus})});
if(res.ok){
await loadQueue();
await selectItem(selectedId);
}else{
alert('Failed to update status');
}
}catch(e){
alert('Error: '+e.message);
}finally{
btn.disabled=false;
btn.textContent='Update Status';
}
}
async function submitOverride(analysisId){
const priority=parseInt(document.getElementById('newPriority').value);
const reason=document.getElementById('overrideReason').value;
const form=document.getElementById('overrideForm');
const btn=form.querySelector('button');
btn.disabled=true;
btn.textContent='Submitting...';
try{
const overrideId='override-'+Date.now();
const res=await fetch('/override/'+encodeURIComponent(analysisId),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:overrideId,priority,reason})});
if(res.ok){
await loadQueue();
await selectItem(selectedId);
}else{
alert('Failed to submit override');
}
}catch(e){
alert('Error: '+e.message);
}finally{
btn.disabled=false;
btn.textContent='Submit Override';
}
}
loadQueue();
setInterval(loadQueue,10000);
</script>
</body>
</html>`;
			return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
		}

		if (url.pathname === '/queue') {
			if (method !== 'GET') return methodNotAllowed();
			try {
				if (!env.DB) {
					return json({ ok: true, items: [] });
				}
				const { listQueue } = await import('./db');
				const priority = url.searchParams.get('priority');
				const source = url.searchParams.get('source');
				const statuses = url.searchParams.getAll('status');
				const sort = url.searchParams.get('sort');
				const filters: { limit: number; priority?: number; source?: string; status?: string; statuses?: string[]; sort?: string } = { limit: 100 };
				if (priority) filters.priority = parseInt(priority);
				if (source) filters.source = source;
				if (statuses.length > 0) filters.statuses = statuses;
				if (sort) filters.sort = sort;
				const items = await listQueue(env.DB, filters);
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
					// Critical P0 issues
					{ source: 'support', content: 'Complete outage - cannot access dashboard at all. Getting 503 errors for the past 30 minutes. This is blocking our entire team from working. URGENT!', priority: 'critical' },
					{ source: 'support', content: 'Login broken after password reset. Tried multiple times, keeps saying invalid credentials even with the new password. Cannot access my account.', priority: 'critical' },
					{ source: 'support', content: 'Billing issue - charged twice this month. Invoice #4521 and #4522 both processed for the same subscription period. Need immediate refund.', priority: 'critical' },
					{ source: 'support', content: 'Payment processing completely down. Customers cannot complete purchases. Losing revenue every minute this is broken!', priority: 'critical' },
					{ source: 'github', content: 'Database connection pool exhausted. All API requests timing out after 30 seconds. Production is effectively down.', priority: 'critical' },
					{ source: 'x', content: '@yourapp URGENT: Our entire company is locked out. SSO authentication failing with "invalid token" error. 200+ users affected.', priority: 'critical' },
					{ source: 'support', content: 'Data loss incident - uploaded files from the past 2 hours are missing. Need immediate investigation and recovery.', priority: 'critical' },
					
					// High priority issues
					{ source: 'github', content: 'API returning 500 errors on /api/users endpoint. Started happening after the 2.1.0 deploy. Affecting production traffic.', priority: 'high' },
					{ source: 'support', content: 'Data export feature timing out for datasets over 10k rows. Need this working ASAP for compliance reporting due next week.', priority: 'high' },
					{ source: 'x', content: '@yourapp why is the mobile app crashing every time I try to upload an image? iPhone 14, iOS 17. Literally unusable right now.', priority: 'high' },
					{ source: 'github', content: 'Memory leak in the background sync worker. Server RAM usage grows unbounded over 24-48 hours until restart required.', priority: 'high' },
					{ source: 'support', content: 'Webhook deliveries failing intermittently. About 30% of webhooks are not being sent. Critical for our integrations.', priority: 'high' },
					{ source: 'github', content: 'Search indexing broken after Elasticsearch upgrade. New content not appearing in search results for 2+ hours.', priority: 'high' },
					{ source: 'support', content: 'File uploads over 50MB failing with cryptic error. This worked fine last week. Multiple customers reporting same issue.', priority: 'high' },
					{ source: 'x', content: '@yourapp the password reset emails are not being delivered. Tried 5 times over the past hour. Check your email service!', priority: 'high' },
					{ source: 'github', content: 'Rate limiting too aggressive after recent update. Legitimate API calls getting 429 errors. Breaking customer integrations.', priority: 'high' },
					{ source: 'support', content: 'Reports generation taking 10+ minutes when it used to take seconds. Database query performance degraded significantly.', priority: 'high' },
					
					// Medium priority issues
					{ source: 'support', content: 'Cannot delete old projects. Delete button does nothing when clicked. Tried on Chrome and Firefox, same issue.', priority: 'medium' },
					{ source: 'github', content: 'Dark mode toggle not persisting after page refresh. Have to re-enable it every time I visit the site.', priority: 'medium' },
					{ source: 'x', content: 'Love the new dashboard redesign but the search is noticeably slower now. Takes 3-4 seconds vs instant before.', priority: 'medium' },
					{ source: 'support', content: 'Email notifications are delayed by 15-20 minutes. Not critical but makes real-time collaboration difficult.', priority: 'medium' },
					{ source: 'github', content: 'Pagination broken on the activity feed. Clicking "next page" shows duplicate items from previous page.', priority: 'medium' },
					{ source: 'support', content: 'Profile picture upload not working on Safari. Works fine on Chrome. Getting "unsupported format" error for valid JPEGs.', priority: 'medium' },
					{ source: 'x', content: 'The mobile app keeps logging me out every few hours. Super annoying to have to re-authenticate constantly.', priority: 'medium' },
					{ source: 'github', content: 'Markdown rendering broken for code blocks with certain languages. Python and Ruby display fine but Go and Rust are broken.', priority: 'medium' },
					{ source: 'support', content: 'Team invitation emails sometimes go to spam. Can you add SPF/DKIM records to improve deliverability?', priority: 'medium' },
					{ source: 'github', content: 'Drag and drop file upload not working on Firefox. Have to use the file picker dialog instead.', priority: 'medium' },
					{ source: 'support', content: 'Timezone display incorrect for users in Asia/Pacific region. Shows UTC instead of local time.', priority: 'medium' },
					{ source: 'x', content: 'Why does the app request camera permissions? I just want to upload existing photos, not take new ones.', priority: 'medium' },
					{ source: 'github', content: 'API response times increased by 200ms on average after the CDN change. Not critical but noticeable.', priority: 'medium' },
					
					// Low priority / feature requests
					{ source: 'github', content: 'Feature request: Add keyboard shortcuts for common actions. Would really speed up my workflow.', priority: 'low' },
					{ source: 'support', content: 'Would be nice to have a CSV import option instead of just JSON. Not urgent but would be convenient.', priority: 'low' },
					{ source: 'x', content: 'Any plans to add a calendar view? Current list view is fine but calendar would be helpful for planning.', priority: 'low' },
					{ source: 'github', content: 'Documentation could use more examples for the webhooks API. Current docs are a bit sparse.', priority: 'low' },
					{ source: 'support', content: 'Minor UI bug: tooltip text is cut off on narrow screens. Not blocking anything but looks unprofessional.', priority: 'low' },
					{ source: 'x', content: 'The new color scheme is nice but could you add a high contrast mode for accessibility?', priority: 'low' },
					{ source: 'github', content: 'Feature idea: bulk actions for managing multiple items at once. Would save a lot of clicking.', priority: 'low' },
					{ source: 'support', content: 'Is there a way to customize the dashboard widgets? Would love to rearrange them to fit my workflow.', priority: 'low' },
					{ source: 'github', content: 'Small typo in the settings page: "Prefences" should be "Preferences". Just noticed it today.', priority: 'low' },
					{ source: 'support', content: 'Feature request: Add a "recently viewed" section to quickly access items I was working on.', priority: 'low' },
					{ source: 'x', content: 'Would be cool to have animated transitions between pages. Current navigation feels a bit abrupt.', priority: 'low' },
					{ source: 'github', content: 'Request: Add syntax highlighting for YAML files in the code editor. Currently only supports JSON.', priority: 'low' },
					{ source: 'support', content: 'Can you add a print-friendly view for reports? Current layout breaks across pages awkwardly.', priority: 'low' },
					{ source: 'github', content: 'Enhancement: Show relative timestamps (e.g., "2 hours ago") in addition to absolute dates.', priority: 'low' },
					{ source: 'x', content: 'The loading spinner is cute but maybe add a progress bar for long operations so we know how long to wait?', priority: 'low' },
					{ source: 'support', content: 'Minor suggestion: Add a confirmation dialog when deleting items. I accidentally deleted something yesterday.', priority: 'low' },
					{ source: 'github', content: 'Feature: Export data in multiple formats (CSV, JSON, XML). Currently only supports JSON.', priority: 'low' },
					{ source: 'support', content: 'The help documentation is great but could use a search function to find topics more easily.', priority: 'low' },
					{ source: 'x', content: 'Love the product! One small thing: can you add emoji reactions to comments? Would make communication more fun 😊', priority: 'low' },
					{ source: 'github', content: 'Nice to have: Add a "compact view" option for the list to show more items on screen at once.', priority: 'low' },
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
			try {
				if (!env.DB || !env.ANALYZE_WORKFLOW) {
					return json({ ok: false, error: 'Database or Workflow not configured' }, { status: 500 });
				}

				const payload = await readJson<{ source?: string; content?: string; metadata?: Record<string, unknown> }>();
				if (!payload || !payload.content) {
					return json({ ok: false, error: 'Invalid payload: content required' }, { status: 400 });
				}

				const { insertFeedback, upsertAnalysis } = await import('./db');

				// Insert feedback into D1
				const feedbackId = `feedback-${Date.now()}`;
				await insertFeedback(env.DB, {
					id: feedbackId,
					source: payload.source || 'api',
					content: payload.content,
					metadata_json: payload.metadata ? JSON.stringify(payload.metadata) : undefined,
				});

				// Create analysis record with 'running' status
				const analysisId = `analysis-${feedbackId}-${Date.now()}`;
				await upsertAnalysis(env.DB, {
					id: analysisId,
					feedback_id: feedbackId,
					status: 'running', // Workflow is processing
					priority: 0,
				});

				// Trigger workflow for async analysis
				const instance = await env.ANALYZE_WORKFLOW.create({
					id: analysisId,
					params: {
						feedbackId,
						analysisId,
					},
				});

				return json({
					ok: true,
					feedback_id: feedbackId,
					analysis_id: analysisId,
					workflow_id: instance.id,
					message: 'Feedback ingested, analysis workflow started',
				});
			} catch (error) {
				return json(
					{
						ok: false,
						error: 'Failed to ingest feedback',
						details: error instanceof Error ? error.message : String(error),
					},
					{ status: 500 },
				);
			}
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
						status: 'pending',
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
			const params = match('/status/:id', url.pathname);
			if (params) {
				if (method !== 'POST') return methodNotAllowed();
				try {
					if (!env.DB) {
						return json({ ok: false, error: 'Database not configured' }, { status: 500 });
					}
					const payload = await readJson<{ status?: string }>();
					if (!payload || !payload.status) {
						return json({ ok: false, error: 'Invalid payload: status required' }, { status: 400 });
					}
					const analysisId = params.id;
					const { updateAnalysisStatus } = await import('./db');
					await updateAnalysisStatus(env.DB, analysisId, payload.status);
					return json({ ok: true, analysis_id: analysisId, status: payload.status });
				} catch (error) {
					return json(
						{ ok: false, error: 'Failed to update status', details: error instanceof Error ? error.message : String(error) },
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
