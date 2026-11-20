type AgentEvent = { type: string; at: string; [key: string]: unknown };

type Listener = (event: AgentEvent) => void;
const listeners = new Set<Listener>();
const history: AgentEvent[] = [];

export function emit(type: string, data: Record<string, unknown> = {}): void {
	const event: AgentEvent = { type, at: new Date().toISOString(), ...data };
	history.push(event);
	for (const listener of listeners) listener(event);
}

export function subscribe(listener: Listener): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export const replay = (): readonly AgentEvent[] => history;
export const clearHistory = (): void => {
	history.length = 0;
};
