import { VOICE } from "./config";

export async function synthesize(
	text: string,
	outPath: string,
): Promise<boolean> {
	const apiKey = process.env.ELEVENLABS_API_KEY;
	if (!apiKey) return false;
	const res = await fetch(
		`https://api.elevenlabs.io/v1/text-to-speech/${VOICE.voiceId}`,
		{
			method: "POST",
			headers: {
				"xi-api-key": apiKey,
				"content-type": "application/json",
				accept: "audio/mpeg",
			},
			body: JSON.stringify({ text, model_id: VOICE.modelId }),
		},
	);
	if (!res.ok)
		throw new Error(`ElevenLabs TTS failed: ${res.status} ${await res.text()}`);
	await Bun.write(outPath, await res.arrayBuffer());
	return true;
}
