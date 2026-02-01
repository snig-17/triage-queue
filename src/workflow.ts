import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { analyzeFeedback } from './ai';
import { computeScoreAndPriority } from './scoring';
import { upsertAnalysis } from './db';

type Params = {
	feedbackId: string;
	analysisId: string;
};

export class AnalyzeFeedbackWorkflow extends WorkflowEntrypoint<Env, Params> {
	async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
		const { feedbackId, analysisId } = event.payload;

		// Step 1: Fetch feedback from D1
		const feedback = await step.do('fetch-feedback', async () => {
			const result = await this.env.DB.prepare('SELECT * FROM feedback WHERE id = ?1').bind(feedbackId).first<{
				id: string;
				content: string;
				source: string | null;
			}>();

			if (!result) {
				throw new Error(`Feedback not found: ${feedbackId}`);
			}

			return result;
		});

		// Step 2: Call Workers AI for analysis
		const aiResult = await step.do(
			'ai-analysis',
			{
				retries: {
					limit: 3,
					delay: '5 seconds',
					backoff: 'exponential',
				},
				timeout: '2 minutes',
			},
			async () => {
				const result = await analyzeFeedback(this.env.AI, feedback.content);

				if (!result.success) {
					throw new Error(result.error || 'AI analysis failed');
				}

				return result;
			},
		);

		// Step 3: Compute score and priority
		const scoringResult = await step.do('compute-score', async () => {
			return computeScoreAndPriority(aiResult.signals);
		});

		// Step 4: Update analysis in D1 with results
		await step.do('save-results', async () => {
			await upsertAnalysis(this.env.DB, {
				id: analysisId,
				feedback_id: feedbackId,
				status: 'pending', // Set to pending so it appears in active queue
				priority: scoringResult.priority,
				score: scoringResult.score,
				signals_json: JSON.stringify(aiResult.signals),
				result_json: JSON.stringify(scoringResult),
				completed_at: new Date().toISOString(),
			});
		});

		return {
			success: true,
			analysisId,
			feedbackId,
			priority: scoringResult.priority,
			score: scoringResult.score,
		};
	}
}
