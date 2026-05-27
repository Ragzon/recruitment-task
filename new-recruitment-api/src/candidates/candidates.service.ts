import { Database } from "sqlite";
import { Candidate, CandidateRequest, CandidatesListParams, RecruitmentStatus } from "./candidate.types";
import { LegacyClient } from "./legacy-api.client";

type CandidateRow = Omit<Candidate, "jobOfferIds">;

const recruitmentStatuses: RecruitmentStatus[] = [
    "nowy",
    "w trakcie rozmów",
    "zaakceptowany",
    "odrzucony",
];

const emailRegex = /\S+@\S+\.\S+/;

export class CandidateValidationError extends Error {
    constructor(readonly errors: string[]) {
        super("Validation failed");
    }
}

export class CandidateConflictError extends Error {
    constructor(message = "Candidate with this email already exists.") {
        super(message);
    }
}

export class CandidatesService {
    constructor(
        private readonly db: Database,
        private readonly legacyClient: LegacyClient,
    ) {}

    async list(params: CandidatesListParams) {
        const offset = (params.page - 1) * params.limit;
        const where = params.jobOfferId
            ? "WHERE EXISTS (SELECT 1 FROM CandidateJobOffer cjo WHERE cjo.candidate_id = c.id AND cjo.job_offer_id = ?)"
            : "";
        const queryParams = params.jobOfferId ? [params.jobOfferId] : [];

        const totalRow = await this.db.get<{ total: number }>(
            `SELECT COUNT(*) as total FROM Candidate c ${where}`,
            queryParams,
        );

        const candidates = await this.db.all<CandidateRow[]>(
            `SELECT
                c.id,
                c.first_name as firstName,
                c.last_name as lastName,
                c.email,
                c.phone,
                c.years_of_experience as yearsOfExperience,
                c.recruiter_notes as recruiterNotes,
                c.recruitment_status as recruitmentStatus,
                c.consent_date as consentDate,
                c.created_at as createdAt
            FROM Candidate c
            ${where}
            ORDER BY c.created_at DESC, c.id DESC
            LIMIT ? OFFSET ?`,
            [...queryParams, params.limit, offset],
        );

        const candidateIds = candidates.map((candidate) => candidate.id);
        const jobOfferIdsByCandidateId = await this.findJobOfferIdsByCandidateId(candidateIds);

        return {
            data: candidates.map((candidate) => ({
                ...candidate,
                jobOfferIds: jobOfferIdsByCandidateId.get(candidate.id) ?? [],
            })),
            pagination: {
                page: params.page,
                limit: params.limit,
                total: totalRow?.total ?? 0,
            },
        };
    }

    async create(candidate: CandidateRequest) {
        const validationErrors = this.validateCandidate(candidate);

        if (validationErrors.length > 0) {
            throw new CandidateValidationError(validationErrors);
        }

        const existingCandidate = await this.db.get(
            "SELECT id FROM Candidate WHERE email = ?",
            candidate.email,
        );

        if (existingCandidate) {
            throw new CandidateConflictError();
        }

        const existingJobOffers = await this.db.all<{ id: number }[]>(
            `SELECT id FROM JobOffer WHERE id IN (${candidate.jobOfferIds!.map(() => "?").join(",")})`,
            candidate.jobOfferIds,
        );

        if (existingJobOffers.length !== candidate.jobOfferIds!.length) {
            throw new CandidateValidationError(["Every job offer must exist"]);
        }

        await this.legacyClient.createCandidate({
            firstName: candidate.firstName!,
            lastName: candidate.lastName!,
            email: candidate.email!,
        });

        try {
            await this.db.exec("BEGIN");

            const result = await this.db.run(
                `INSERT INTO Candidate (
                    first_name,
                    last_name,
                    email,
                    phone,
                    years_of_experience,
                    recruiter_notes,
                    recruitment_status,
                    consent_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                candidate.firstName,
                candidate.lastName,
                candidate.email,
                candidate.phone,
                candidate.yearsOfExperience,
                candidate.recruiterNotes,
                candidate.recruitmentStatus,
                candidate.consentDate,
            );

            const candidateId = result.lastID!;

            for (const jobOfferId of candidate.jobOfferIds!) {
                await this.db.run(
                    "INSERT INTO CandidateJobOffer (candidate_id, job_offer_id) VALUES (?, ?)",
                    candidateId,
                    jobOfferId,
                );
            }

            await this.db.exec("COMMIT");

            return this.findCandidate(candidateId);
        } catch (error) {
            await this.rollbackIfNeeded();
            throw error;
        }
    }

    private validateCandidate(candidate: CandidateRequest) {
        const errors: string[] = [];

        if (!candidate.firstName) {
            errors.push("First name is required");
        }

        if (!candidate.lastName) {
            errors.push("Last name is required");
        }

        if (!candidate.email) {
            errors.push("Email is required");
        } else if (!emailRegex.test(candidate.email)) {
            errors.push("Invalid email format");
        }

        if (!candidate.phone) {
            errors.push("Phone is required");
        }

        if (!Number.isInteger(candidate.yearsOfExperience) || candidate.yearsOfExperience! < 0) {
            errors.push("Years of experience must be a non-negative integer");
        }

        if (!candidate.recruiterNotes) {
            errors.push("Recruiter notes are required");
        }

        if (!candidate.recruitmentStatus || !recruitmentStatuses.includes(candidate.recruitmentStatus)) {
            errors.push("Recruitment status is invalid");
        }

        if (!candidate.consentDate || Number.isNaN(Date.parse(candidate.consentDate))) {
            errors.push("Consent date is required and must be a valid date");
        }

        if (!Array.isArray(candidate.jobOfferIds) || candidate.jobOfferIds.length === 0) {
            errors.push("At least one job offer is required");
        } else if (!candidate.jobOfferIds.every((id) => Number.isInteger(id) && id > 0)) {
            errors.push("Job offer ids must be positive integers");
        } else if (new Set(candidate.jobOfferIds).size !== candidate.jobOfferIds.length) {
            errors.push("Job offer ids must be unique");
        }

        return errors;
    }

    private async findCandidate(candidateId: number) {
        const candidate = await this.db.get<CandidateRow>(
            `SELECT
                c.id,
                c.first_name as firstName,
                c.last_name as lastName,
                c.email,
                c.phone,
                c.years_of_experience as yearsOfExperience,
                c.recruiter_notes as recruiterNotes,
                c.recruitment_status as recruitmentStatus,
                c.consent_date as consentDate,
                c.created_at as createdAt
            FROM Candidate c
            WHERE c.id = ?`,
            candidateId,
        );

        const jobOfferIdsByCandidateId = await this.findJobOfferIdsByCandidateId([candidateId]);

        return {
            ...candidate,
            jobOfferIds: jobOfferIdsByCandidateId.get(candidateId) ?? [],
        };
    }

    private async findJobOfferIdsByCandidateId(candidateIds: number[]) {
        const jobOfferIdsByCandidateId = new Map<number, number[]>();

        if (candidateIds.length === 0) {
            return jobOfferIdsByCandidateId;
        }

        const rows = await this.db.all<{ candidateId: number; jobOfferId: number }[]>(
            `SELECT candidate_id as candidateId, job_offer_id as jobOfferId
            FROM CandidateJobOffer
            WHERE candidate_id IN (${candidateIds.map(() => "?").join(",")})
            ORDER BY job_offer_id ASC`,
            candidateIds,
        );

        for (const row of rows) {
            const values = jobOfferIdsByCandidateId.get(row.candidateId) ?? [];
            values.push(row.jobOfferId);
            jobOfferIdsByCandidateId.set(row.candidateId, values);
        }

        return jobOfferIdsByCandidateId;
    }

    private async rollbackIfNeeded() {
        try {
            await this.db.exec("ROLLBACK");
        } catch {
            return;
        }
    }
}
