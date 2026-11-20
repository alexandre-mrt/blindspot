import { resetCamera, showOverlay, test, zoomTo } from "@argo-video/cli";

const AGENT_TIMEOUT_MS = 90_000;

test("odds", async ({ page, narration }) => {
	test.setTimeout(240_000);
	await page.goto("/");
	await page.locator("#private").check();
	await narration.startRecording(page);

	narration.mark("hook");
	await showOverlay(page, "hook", narration.durationFor("hook"));

	narration.mark("problem");
	zoomTo(page, "header", { narration, scale: 1.4 });
	await showOverlay(page, "problem", narration.durationFor("problem"));
	await resetCamera(page);

	narration.mark("run");
	await page.locator("#run").click();
	await showOverlay(page, "run", narration.durationFor("run"));

	narration.mark("guardrail");
	const denied = page.locator("#log li", { hasText: "not on allowlist" });
	await denied.waitFor({ timeout: AGENT_TIMEOUT_MS });
	zoomTo(page, "#log", { narration, scale: 1.3 });
	await showOverlay(page, "guardrail", narration.durationFor("guardrail"));
	await resetCamera(page);

	narration.mark("approve");
	const approve = page.locator(".approval .yes");
	await approve.waitFor({ timeout: AGENT_TIMEOUT_MS });
	zoomTo(page, "#approvals", { narration, scale: 1.5 });
	await page.waitForTimeout(
		Math.max(0, narration.durationFor("approve") - 1500),
	);
	await approve.click();
	await page.waitForTimeout(1500);
	await resetCamera(page);

	narration.mark("blind");
	await page
		.locator("#log li", { hasText: "payer = anonymous" })
		.first()
		.waitFor({ timeout: AGENT_TIMEOUT_MS });
	zoomTo(page, "#log", { narration, scale: 1.3 });
	await showOverlay(page, "blind", narration.durationFor("blind"));
	await resetCamera(page);

	narration.mark("call");
	await page
		.locator("#briefing:not(.empty)")
		.waitFor({ timeout: AGENT_TIMEOUT_MS });
	zoomTo(page, "#briefing", { narration, scale: 1.5 });
	await showOverlay(page, "call", narration.durationFor("call"));
	await resetCamera(page);

	narration.mark("close");
	await showOverlay(page, "close", narration.durationFor("close"));
});
