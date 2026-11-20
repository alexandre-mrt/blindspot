const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5";

export async function complete(
	system: string,
	prompt: string,
): Promise<string | null> {
	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) return null;
	const res = await fetch("https://api.anthropic.com/v1/messages", {
		method: "POST",
		headers: {
			"x-api-key": apiKey,
			"anthropic-version": "2023-06-01",
			"content-type": "application/json",
		},
		body: JSON.stringify({
			model: MODEL,
			max_tokens: 600,
			system,
			messages: [{ role: "user", content: prompt }],
		}),
	});
	if (!res.ok)
		throw new Error(`LLM call failed: ${res.status} ${await res.text()}`);
	const body = (await res.json()) as {
		content: { type: string; text?: string }[];
	};
	return body.content.find((c) => c.type === "text")?.text ?? null;
}
