import { LegacyCandidatePayload } from "./candidate.types";

export type LegacyClient = {
    createCandidate(candidate: LegacyCandidatePayload): Promise<void>;
};

export class LegacyApiError extends Error {
    constructor(readonly status: number, message: string) {
        super(message);
    }
}

export class HttpLegacyClient implements LegacyClient {
    private readonly apiUrl = process.env.LEGACY_API_URL ?? "http://localhost:4040";
    private readonly apiKey = process.env.LEGACY_API_KEY ?? "0194ec39-4437-7c7f-b720-7cd7b2c8d7f4";

    async createCandidate(candidate: LegacyCandidatePayload) {
        let response: globalThis.Response;

        try {
            response = await fetch(`${this.apiUrl}/candidates`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-api-key": this.apiKey,
                },
                body: JSON.stringify(candidate),
            });
        } catch {
            throw new LegacyApiError(504, "Service unavailable");
        }

        if (!response.ok) {
            let message = "Legacy API request failed";

            try {
                const body = await response.json() as { message?: string };
                message = body.message ?? message;
            } catch {
                message = response.statusText || message;
            }

            throw new LegacyApiError(response.status, message);
        }
    }
}
