export type RecruitmentStatus = "nowy" | "w trakcie rozmów" | "zaakceptowany" | "odrzucony";

export type CandidateRequest = {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    yearsOfExperience?: number;
    recruiterNotes?: string;
    recruitmentStatus?: RecruitmentStatus;
    consentDate?: string;
    jobOfferIds?: number[];
};

export type Candidate = {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    yearsOfExperience: number;
    recruiterNotes: string;
    recruitmentStatus: RecruitmentStatus;
    consentDate: string;
    createdAt: string;
    jobOfferIds: number[];
};

export type LegacyCandidatePayload = {
    firstName: string;
    lastName: string;
    email: string;
};

export type CandidatesListParams = {
    page: number;
    limit: number;
    jobOfferId?: number;
};
