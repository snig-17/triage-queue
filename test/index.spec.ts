import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('Triage Queue worker', () => {
	it('redirects root to /app', async () => {
		const request = new IncomingRequest('http://example.com/');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		
		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('http://example.com/app');
	});

	it('serves the app HTML at /app', async () => {
		const request = new IncomingRequest('http://example.com/app');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		
		const text = await response.text();
		expect(text).toContain('<title>Triage Queue');
		expect(text).toContain('<!DOCTYPE html>');
	});

	it('integration: serves the app HTML at /app', async () => {
		const response = await SELF.fetch('https://example.com/app');
		expect(response.status).toBe(200);
		const text = await response.text();
		expect(text).toContain('<title>Triage Queue');
	});
});
