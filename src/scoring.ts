import type { AnalysisSignals } from './ai';

export interface ScoringResult {
	score: number;
	priority: number;
	breakdown: {
		sentiment_weight: number;
		severity_weight: number;
		business_risk_weight: number;
		confidence_multiplier: number;
	};
}

/**
 * SCORING RUBRIC (visible for transparency and tuning)
 *
 * Score calculation (0-100):
 * - Base score = (severity_signal * 20) + (business_risk_signal * 15) + sentiment_weight
 * - sentiment_weight: negative=15, neutral=5, positive=0
 * - Multiplied by confidence (0.0-1.0)
 * - Clamped to 0-100
 *
 * Priority tiers (for queue sorting):
 * - score >= 70: priority = 5 (critical)
 * - score >= 50: priority = 4 (high)
 * - score >= 30: priority = 3 (medium)
 * - score >= 15: priority = 2 (low)
 * - score < 15:  priority = 1 (minimal)
 *
 * Rationale:
 * - severity_signal (1-5) weighted at 20 points max → captures urgency
 * - business_risk_signal (1-5) weighted at 15 points max → captures impact
 * - sentiment adds up to 15 points for negative feedback → captures customer dissatisfaction
 * - confidence acts as a multiplier → reduces score if AI is uncertain
 */
export function computeScoreAndPriority(signals: AnalysisSignals): ScoringResult {
	let sentiment_weight = 0;
	if (signals.sentiment === 'negative') {
		sentiment_weight = 15;
	} else if (signals.sentiment === 'neutral') {
		sentiment_weight = 5;
	}

	const severity_weight = signals.severity_signal * 20;
	const business_risk_weight = signals.business_risk_signal * 15;

	const base_score = severity_weight + business_risk_weight + sentiment_weight;

	const confidence_multiplier = Math.max(0, Math.min(1, signals.confidence));

	let score = base_score * confidence_multiplier;
	score = Math.max(0, Math.min(100, Math.round(score)));

	let priority = 1;
	if (score >= 70) {
		priority = 5;
	} else if (score >= 50) {
		priority = 4;
	} else if (score >= 30) {
		priority = 3;
	} else if (score >= 15) {
		priority = 2;
	}

	return {
		score,
		priority,
		breakdown: {
			sentiment_weight,
			severity_weight,
			business_risk_weight,
			confidence_multiplier,
		},
	};
}
