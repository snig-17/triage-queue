export interface Feedback {
	id: string;
	source: string | null;
	content: string;
	metadata_json: string | null;
	created_at: string;
}

export interface Analysis {
	id: string;
	feedback_id: string;
	status: string;
	priority: number;
	score: number | null;
	signals_json: string | null;
	queued_at: string;
	started_at: string | null;
	completed_at: string | null;
	result_json: string | null;
	error_text: string | null;
	updated_at: string;
	created_at: string;
}

export interface Override {
	id: string;
	analysis_id: string;
	actor: string | null;
	action: string;
	payload_json: string | null;
	created_at: string;
}

export interface QueueFilters {
	priority?: number;
	status?: string;
	statuses?: string[];
	source?: string;
	search?: string;
	sort?: string;
	limit?: number;
	offset?: number;
}

export interface ItemDetail {
	feedback: Feedback;
	analysis: Analysis[];
	overrides: Override[];
}

export async function insertFeedback(
	db: D1Database,
	params: { id: string; source?: string; content: string; metadata_json?: string },
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO feedback (id, source, content, metadata_json)
       VALUES (?1, ?2, ?3, ?4)`,
		)
		.bind(params.id, params.source ?? null, params.content, params.metadata_json ?? null)
		.run();
}

export async function upsertAnalysis(
	db: D1Database,
	params: {
		id: string;
		feedback_id: string;
		status: string;
		priority?: number;
		score?: number;
		signals_json?: string;
		queued_at?: string;
		started_at?: string;
		completed_at?: string;
		result_json?: string;
		error_text?: string;
	},
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO analysis (
         id, feedback_id, status, priority, score, signals_json, queued_at, started_at, completed_at, result_json, error_text, updated_at
       )
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status,
         priority = excluded.priority,
         score = excluded.score,
         signals_json = excluded.signals_json,
         started_at = excluded.started_at,
         completed_at = excluded.completed_at,
         result_json = excluded.result_json,
         error_text = excluded.error_text,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
		)
		.bind(
			params.id,
			params.feedback_id,
			params.status,
			params.priority ?? 0,
			params.score ?? null,
			params.signals_json ?? null,
			params.queued_at ?? new Date().toISOString(),
			params.started_at ?? null,
			params.completed_at ?? null,
			params.result_json ?? null,
			params.error_text ?? null,
		)
		.run();
}

export async function listQueue(db: D1Database, filters: QueueFilters = {}): Promise<Analysis[]> {
	const conditions: string[] = [];
	const bindings: unknown[] = [];
	let bindIndex = 1;

	if (filters.priority !== undefined) {
		conditions.push(`a.priority = ?${bindIndex++}`);
		bindings.push(filters.priority);
	}

	if (filters.statuses && filters.statuses.length > 0) {
		const placeholders = filters.statuses.map(() => `?${bindIndex++}`).join(',');
		conditions.push(`a.status IN (${placeholders})`);
		filters.statuses.forEach(s => bindings.push(s));
	} else if (filters.status) {
		conditions.push(`a.status = ?${bindIndex++}`);
		bindings.push(filters.status);
	}

	if (filters.source) {
		conditions.push(`f.source = ?${bindIndex++}`);
		bindings.push(filters.source);
	}

	if (filters.search) {
		conditions.push(`(f.content LIKE ?${bindIndex} OR f.metadata_json LIKE ?${bindIndex})`);
		bindings.push(`%${filters.search}%`);
		bindIndex++;
	}

	const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
	const limit = filters.limit ?? 100;
	const offset = filters.offset ?? 0;

	// Build ORDER BY clause based on sort parameter
	let orderBy = 'status_order ASC, a.priority DESC, a.queued_at ASC'; // default
	if (filters.sort) {
		const sortParts = filters.sort.split(',');
		const orderParts: string[] = [];
		for (const part of sortParts) {
			if (part === 'status') orderParts.push('status_order ASC');
			else if (part === 'priority') orderParts.push('a.priority DESC');
			else if (part === 'score') orderParts.push('a.score DESC');
			else if (part === 'time') orderParts.push('a.queued_at DESC');
			else if (part === 'time_asc') orderParts.push('a.queued_at ASC');
		}
		if (orderParts.length > 0) orderBy = orderParts.join(', ');
	}

	const sql = `
    SELECT a.*,
    CASE 
      WHEN a.status = 'pending' THEN 1
      WHEN a.status = 'assigned' THEN 2
      WHEN a.status = 'done' THEN 3
      ELSE 4
    END as status_order
    FROM analysis a
    INNER JOIN feedback f ON a.feedback_id = f.id
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ?${bindIndex++} OFFSET ?${bindIndex++}
  `;

	bindings.push(limit, offset);

	const result = await db.prepare(sql).bind(...bindings).all<Analysis>();
	return result.results ?? [];
}

export async function getItemDetail(db: D1Database, feedbackId: string): Promise<ItemDetail | null> {
	const feedbackResult = await db
		.prepare(`SELECT * FROM feedback WHERE id = ?1`)
		.bind(feedbackId)
		.first<Feedback>();

	if (!feedbackResult) return null;

	const analysisResult = await db
		.prepare(
			`SELECT * FROM analysis WHERE feedback_id = ?1 ORDER BY created_at DESC`,
		)
		.bind(feedbackId)
		.all<Analysis>();

	const analysisRecords = analysisResult.results ?? [];

	const analysisIds = analysisRecords.map((a) => a.id);
	let overridesRecords: Override[] = [];

	if (analysisIds.length > 0) {
		const placeholders = analysisIds.map((_, i) => `?${i + 1}`).join(',');
		const overridesResult = await db
			.prepare(`SELECT * FROM overrides WHERE analysis_id IN (${placeholders}) ORDER BY created_at DESC`)
			.bind(...analysisIds)
			.all<Override>();
		overridesRecords = overridesResult.results ?? [];
	}

	return {
		feedback: feedbackResult,
		analysis: analysisRecords,
		overrides: overridesRecords,
	};
}

export async function updateAnalysisStatus(db: D1Database, analysisId: string, status: string): Promise<void> {
	await db
		.prepare(`UPDATE analysis SET status = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?2`)
		.bind(status, analysisId)
		.run();
}

export async function insertOverride(
	db: D1Database,
	params: { id: string; analysis_id: string; actor?: string; action: string; payload_json?: string },
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO overrides (id, analysis_id, actor, action, payload_json)
       VALUES (?1, ?2, ?3, ?4, ?5)`,
		)
		.bind(params.id, params.analysis_id, params.actor ?? null, params.action, params.payload_json ?? null)
		.run();
}

export async function updateAnalysisPriority(
	db: D1Database,
	analysisId: string,
	priority: number,
): Promise<void> {
	await db
		.prepare(
			`UPDATE analysis
       SET priority = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?2`,
		)
		.bind(priority, analysisId)
		.run();
}
