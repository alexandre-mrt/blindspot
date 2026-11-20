import { POLICY } from "../config";
import { emit } from "../events";

const pending = new Map<string, (approved: boolean) => void>();

export function requestApproval(
	details: Record<string, unknown>,
): Promise<boolean> {
	const id = crypto.randomUUID();
	emit("approval_required", { id, ...details });
	return new Promise((resolve) => {
		const timer = setTimeout(() => {
			pending.delete(id);
			emit("approval_timeout", { id });
			resolve(false);
		}, POLICY.approvalTimeoutMs);
		pending.set(id, (approved) => {
			clearTimeout(timer);
			pending.delete(id);
			emit("approval_decision", { id, approved });
			resolve(approved);
		});
	});
}

export function resolveApproval(id: string, approved: boolean): boolean {
	const resolver = pending.get(id);
	if (!resolver) return false;
	resolver(approved);
	return true;
}
