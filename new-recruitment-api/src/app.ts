import express from "express";
import { Database } from "sqlite";
import { CandidatesController } from "./candidates/candidates.controller";
import { setupDb } from "./db";
import { LegacyClient } from "./candidates/legacy-api.client";

export const setupApp = async (db?: Database, legacyClient?: LegacyClient) => {
    const database = db ?? await setupDb();
    const app = express();

    app.use(express.json());

    app.use(new CandidatesController(database, legacyClient).router);

    return app;
}
