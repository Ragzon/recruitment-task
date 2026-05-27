import { Request, Response, Router } from "express";
import { Database } from "sqlite";
import { CandidateRequest } from "./candidate.types";
import { CandidateConflictError, CandidatesService, CandidateValidationError } from "./candidates.service";
import { HttpLegacyClient, LegacyApiError, LegacyClient } from "./legacy-api.client";

export class CandidatesController {
    readonly router = Router();
    private readonly service: CandidatesService;

    constructor(
        db: Database,
        legacyClient: LegacyClient = new HttpLegacyClient(),
    ) {
        this.service = new CandidatesService(db, legacyClient);
        this.router.get('/candidates', this.getAll.bind(this));
        this.router.post('/candidates', this.create.bind(this));
    }

    async getAll(req: Request, res: Response) {
        const page = this.parsePositiveInteger(req.query.page, 1);
        const limit = Math.min(this.parsePositiveInteger(req.query.limit, 20), 100);
        const jobOfferId = this.parseOptionalPositiveInteger(req.query.jobOfferId);

        if (jobOfferId === null) {
            res.status(400).json({ message: "jobOfferId must be a positive integer" });
            return;
        }

        const candidates = await this.service.list({ page, limit, jobOfferId });

        res.json(candidates);
    }

    async create(req: Request, res: Response) {
        const candidate = req.body as CandidateRequest;

        try {
            const createdCandidate = await this.service.create(candidate);

            res.status(201).json({
                message: "Candidate added successfully",
                candidate: createdCandidate,
            });
        } catch (error) {
            if (error instanceof CandidateValidationError) {
                res.status(400).json({ message: error.message, errors: error.errors });
                return;
            }

            if (error instanceof CandidateConflictError) {
                res.status(409).json({ message: error.message });
                return;
            }

            if (error instanceof LegacyApiError) {
                const status = [409, 504].includes(error.status) ? error.status : 502;
                res.status(status).json({ message: error.message });
                return;
            }

            res.status(500).json({ message: "Internal server error" });
        }
    }

    private parsePositiveInteger(value: unknown, defaultValue: number) {
        if (typeof value !== "string") {
            return defaultValue;
        }

        const parsed = Number(value);

        return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
    }

    private parseOptionalPositiveInteger(value: unknown) {
        if (value === undefined) {
            return undefined;
        }

        if (typeof value !== "string") {
            return null;
        }

        const parsed = Number(value);

        return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    }
}
