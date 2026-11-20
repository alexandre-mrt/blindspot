import { defineConfig } from "@argo-video/cli";

export default defineConfig({
	baseURL: "http://localhost:4021",
	demosDir: "demos",
	outputDir: "videos",
	tts: { defaultVoice: "af_heart", defaultSpeed: 1.0 },
	video: {
		width: 1920,
		height: 1080,
		fps: 30,
		browser: "chromium",
		captureMode: "jpeg-stitch",
		deviceScaleFactor: 2,
		cursorHighlight: true,
	},
	export: {
		preset: "slow",
		crf: 16,
		speedRamp: { gapSpeed: 2.0 },
	},
	overlays: { autoBackground: true },
});
