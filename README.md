Profile Aggregation API

    This ia a backend API that accepts a user’s name, fetches data from multiple external APIs, processes the results, and stores the aggregated profile in a PostgreSQL database.

Tech Stack
    Node.js
    Express.js
    PostgreSQL (Supabase)
    Axios
    UUID v7

Major Features
    Accepts a name via POST request
    Fetches data from:
        Gender prediction API
        Age prediction API
        Nationality prediction API
    Aggregates and processes the data
    Classifies age into groups:
        child | teenager | adult | senior
    Stores result in a PostgreSQL database (Supabase)
    Implements idempotency (avoids duplicate entries)
    Uses UUID v7 for unique identifiers
    Returns structured JSON response

Idempotency
    If a profile with the same name already exists:
        The API returns the existing record
        No duplicate entry is created