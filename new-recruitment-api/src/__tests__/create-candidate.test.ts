import { Application } from "express";
import request from "supertest";
import { setupApp } from "../app";
import { setupDb } from "../db";
import { Database } from "sqlite";

describe('Create Candidate', () => {
    let app: Application;
    let db: Database;
    const legacyClient = {
        createCandidate: jest.fn(),
    };

    beforeAll(async () => {
        db = await setupDb();
        app = await setupApp(db, legacyClient);
    })

    beforeEach(() => {
        legacyClient.createCandidate.mockResolvedValue(undefined);
        legacyClient.createCandidate.mockClear();
    });

    afterAll(async () => {
        await db.close();
    });

    it('should create a new candidate successfully', async () => {
        const response = await request(app)
            .post('/candidates')
            .send({
                firstName: "John",
                lastName: "Doe",
                email: "john.doe@example.com",
                phone: "+48123123123",
                yearsOfExperience: 5,
                recruiterNotes: "Strong TypeScript experience",
                recruitmentStatus: "nowy",
                consentDate: "2026-05-27T08:00:00.000Z",
                jobOfferIds: [1, 2],
            });

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
            message: "Candidate added successfully",
            candidate: {
                firstName: "John",
                lastName: "Doe",
                email: "john.doe@example.com",
                phone: "+48123123123",
                yearsOfExperience: 5,
                recruiterNotes: "Strong TypeScript experience",
                recruitmentStatus: "nowy",
                consentDate: "2026-05-27T08:00:00.000Z",
                jobOfferIds: [1, 2],
            },
        });

        expect(legacyClient.createCandidate).toHaveBeenCalledWith({
            firstName: "John",
            lastName: "Doe",
            email: "john.doe@example.com",
        });

        const storedCandidate = await db.get(
            "SELECT first_name as firstName, email FROM Candidate WHERE email = ?",
            "john.doe@example.com",
        );
        const assignedOffers = await db.all(
            "SELECT job_offer_id as jobOfferId FROM CandidateJobOffer WHERE candidate_id = ? ORDER BY job_offer_id",
            response.body.candidate.id,
        );

        expect(storedCandidate).toEqual({
            firstName: "John",
            email: "john.doe@example.com",
        });
        expect(assignedOffers).toEqual([{ jobOfferId: 1 }, { jobOfferId: 2 }]);
    })

    it('should reject candidate without job offers', async () => {
        const response = await request(app)
            .post('/candidates')
            .send({
                firstName: "Jane",
                lastName: "Nowak",
                email: "jane.nowak@example.com",
                phone: "+48123123124",
                yearsOfExperience: 3,
                recruiterNotes: "Missing job offer assignment",
                recruitmentStatus: "nowy",
                consentDate: "2026-05-27T08:00:00.000Z",
                jobOfferIds: [],
            });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            message: "Validation failed",
            errors: ["At least one job offer is required"],
        });
        expect(legacyClient.createCandidate).not.toHaveBeenCalled();

        const storedCandidate = await db.get(
            "SELECT id FROM Candidate WHERE email = ?",
            "jane.nowak@example.com",
        );

        expect(storedCandidate).toBeUndefined();
    })
})
