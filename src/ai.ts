export interface AnalysisSignals {
	sentiment: string;
	severity_signal: number;
	business_risk_signal: number;
	keywords: string[];
	confidence: number;
	explanation: string;
}

export interface AnalysisResult {
	success: true;
	signals: AnalysisSignals;
}

export interface AnalysisError {
	success: false;
	error: string;
	rawResponse?: unknown;
}

export async function analyzeFeedback(
	ai: Ai,
	content: string,
): Promise<AnalysisResult | AnalysisError> {
	const prompt = `You are a feedback analysis system. Analyze the following customer feedback and respond with ONLY valid JSON matching this exact schema:

{
  "sentiment": "positive" | "neutral" | "negative",
  "severity_signal": 1-5 (1=minor, 5=critical),
  "business_risk_signal": 1-5 (1=low risk, 5=high risk),
  "keywords": ["keyword1", "keyword2", ...],
  "confidence": 0.0-1.0,
  "explanation": "2-3 sentence summary"
}

Feedback to analyze:
${content}

Respond with ONLY the JSON object, no markdown, no code blocks, no additional text.`;

	try {
		const response = await ai.run('@cf/meta/llama-3.1-8b-instruct' as any, {
			prompt,
			max_tokens: 512,
		});

		if (!response || typeof response !== 'object') {
			return {
				success: false,
				error: 'AI returned non-object response',
				rawResponse: response,
			};
		}

		const aiResponse = response as { response?: string };
		const rawText = aiResponse.response?.trim() ?? '';

		if (!rawText) {
			return {
				success: false,
				error: 'AI returned empty response',
				rawResponse: response,
			};
		}

		let cleaned = rawText;
		if (cleaned.startsWith('```json')) {
			cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
		} else if (cleaned.startsWith('```')) {
			cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(cleaned);
		} catch (parseError) {
			return {
				success: false,
				error: `Failed to parse AI JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
				rawResponse: rawText,
			};
		}

		if (!parsed || typeof parsed !== 'object') {
			return {
				success: false,
				error: 'Parsed AI response is not an object',
				rawResponse: parsed,
			};
		}

		const signals = parsed as Record<string, unknown>;

		const validationErrors: string[] = [];

		if (typeof signals.sentiment !== 'string' || !['positive', 'neutral', 'negative'].includes(signals.sentiment)) {
			validationErrors.push('sentiment must be "positive", "neutral", or "negative"');
		}

		if (typeof signals.severity_signal !== 'number' || signals.severity_signal < 1 || signals.severity_signal > 5) {
			validationErrors.push('severity_signal must be a number between 1 and 5');
		}

		if (typeof signals.business_risk_signal !== 'number' || signals.business_risk_signal < 1 || signals.business_risk_signal > 5) {
			validationErrors.push('business_risk_signal must be a number between 1 and 5');
		}

		if (!Array.isArray(signals.keywords) || !signals.keywords.every((k) => typeof k === 'string')) {
			validationErrors.push('keywords must be an array of strings');
		}

		if (typeof signals.confidence !== 'number' || signals.confidence < 0 || signals.confidence > 1) {
			validationErrors.push('confidence must be a number between 0 and 1');
		}

		if (typeof signals.explanation !== 'string' || signals.explanation.length < 10) {
			validationErrors.push('explanation must be a string with at least 10 characters');
		}

		if (validationErrors.length > 0) {
			return {
				success: false,
				error: `AI response validation failed: ${validationErrors.join('; ')}`,
				rawResponse: parsed,
			};
		}

		return {
			success: true,
			signals: signals as unknown as AnalysisSignals,
		};
	} catch (error) {
		return {
			success: false,
			error: `AI request failed: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}
