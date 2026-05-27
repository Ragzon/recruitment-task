CREATE TABLE Recruiter (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    company TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE JobOffer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    salary_range TEXT,
    location TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Candidate (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    years_of_experience INTEGER NOT NULL,
    recruiter_notes TEXT NOT NULL,
    recruitment_status TEXT NOT NULL CHECK (
        recruitment_status IN ('nowy', 'w trakcie rozmów', 'zaakceptowany', 'odrzucony')
    ),
    consent_date DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE CandidateJobOffer (
    candidate_id INTEGER NOT NULL,
    job_offer_id INTEGER NOT NULL,
    PRIMARY KEY (candidate_id, job_offer_id),
    FOREIGN KEY (candidate_id) REFERENCES Candidate(id) ON DELETE CASCADE,
    FOREIGN KEY (job_offer_id) REFERENCES JobOffer(id) ON DELETE CASCADE
);
