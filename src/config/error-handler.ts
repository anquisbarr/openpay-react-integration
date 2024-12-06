const ErrorCodes = {
	SCRIPT_LOAD_FAILED: 1000,
	INITIALIZATION_FAILED: 1001,
	VALIDATION_FAILED: 1002,
} as const;

export const createError = (_type: keyof typeof ErrorCodes, message: string, details?: unknown) => {
	return new Error(`${message}: ${details instanceof Error ? details.message : String(details)}`);
};

export class OpenPayErrorBuilder extends Error {
	constructor(
		message: string,
		public code: number,
	) {
		super(message);
	}
}
