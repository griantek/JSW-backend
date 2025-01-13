const { queryDB, databases } = require("../services/dbService");
const { buildQuery } = require("../utils/queryBuilder");
const { getTableName, getDatabasesForPublishers } = require("../utils/dbHelper");

exports.searchJournals = async (req, res) => {
    const { filters = {} } = req.body;

    try {
        console.log('Incoming filters:', filters);

        let dbToQuery;
        // Fix: Change publisher to publishers to match the request structure
        if (filters.publishers && filters.publishers.length > 0) {
            dbToQuery = getDatabasesForPublishers(filters.publishers);
            console.log('Databases selected based on publishers:', dbToQuery);
        } else {
            dbToQuery = databases.filter(db => !['ugc.db', 'annex.db'].includes(db));
            console.log('Using default database list:', dbToQuery);
        }

        if (dbToQuery.length === 0) {
            console.warn('No databases selected for querying');
            return res.status(200).json({
                success: true,
                data: [],
                totalResults: 0,
                message: 'No matching databases found for the selected publishers'
            });
        }

        let results = [];
        for (const db of dbToQuery) {
            const dbIndex = databases.indexOf(db);
            if (dbIndex === -1) {
                console.warn(`Database ${db} not found in available databases list`);
                continue;
            }

            try {
                const tableName = getTableName(db);
                const { whereClause, params } = buildQuery(filters, db);
                const query = `SELECT * FROM ${tableName} ${whereClause}`;

                console.log(`Querying ${db} with:`, { query, params });

                const dbResults = await queryDB(dbIndex, query, params);
                console.log(`Retrieved ${dbResults.length} results from ${db}`);

                results = results.concat(normalizeResults(db, dbResults));
            } catch (error) {
                console.error(`Error querying ${db}:`, error.message);
                continue;
            }
        }

        res.status(200).json({
            success: true,
            data: results,
            totalResults: results.length,
            queriedDatabases: dbToQuery
        });
    } catch (error) {
        console.error('Error searching journals:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Normalize results based on database
const normalizeResults = (dbName, data) => {
    switch (dbName) {
        case "annex.db":
            return data.map((row) => ({
                title: row.title,
                issn: row.issn,
                publisher: row.publisher,
                citeScore: row.CiteScore,
                subjectArea: row.SubjectArea,
            }));
        case "elsevier_journals.db":
            return data.map((row) => ({
                title: row.title, // Updated field name
                issn: row.issn,
                publisher: "Elsevier", // Retained hardcoded value
                citeScore: row.cite_score, // Updated field name
                impactFactor: row.impact_factor, // Updated field name
                aimsAndScope: row.aims_and_scope, // Updated field name
                link: row.link, // Added field for consistency
            }));
        case "emerald_journals.db":
            return data.map((row) => ({
                title: row.title, // Updated field name
                issn: row.issn, // Updated field name
                publisher: "Emerald", // Retained hardcoded value
                citeScore: row.cite_score, // Updated field name
                impactFactor: row.impact_factor, // Updated field name
                aimsAndScope: row.aims_and_scope, // Updated field name
                link: row.link, // Updated field name
            }));
        case "inderscience_journals.db":
            return data.map((row) => ({
                title: row.title, // Updated field name
                issn: row.print_issn, // Updated field name
                publisher: "Inderscience", // Retained hardcoded value
                citeScore: row.cite_score, // Updated field name
                impactFactor: row.impact_factor, // Updated field name
                aimsAndScope: row.aims_and_scope, // Updated field name
                link: row.link, // Updated field name
            }));
        case "ugc.db":
            return data.map((row) => ({
                title: row.journal_title,
                issn: row.issn,
                publisher: row.publisher,
                citeScore: row.CiteScore,
                subjectArea: row.SubjectArea,
                keywords: row.keywords,
            }));
        case "wiley_db.db":
            return data.map((row) => ({
                title: row.title, // Updated field name
                issn: row.issn, // Updated field name
                publisher: "Wiley", // Retained hardcoded value
                citeScore: row.cite_score, // Updated field name
                impactFactor: row.impact_factor, // Updated field name
                aimsAndScope: row.aims_and_scope, // Updated field name
                indexed: row.indexing, // Updated field name
                link: row.link, // Updated field name
            }));
        case "world_scientific_journals.db":
            return data.map((row) => ({
                title: row.title, // Updated field name
                issn: row.issn, // Updated field name
                publisher: "World Scientific", // Retained hardcoded value
                citeScore: row.cite_score, // Updated field name
                impactFactor: row.impact_factor, // Updated field name
                aimsAndScope: row.aims_and_scope, // Updated field name
                indexed: row.indexed, // Updated field name
                link: row.link, // Updated field name
            }));
        case "springer_journals.db":
            return data.map((row) => ({
                title: row.title, // Updated field name
                issn: row.print_issn || row.electronic_issn, // Updated field names
                publisher: "Springer", // Retained hardcoded value
                citeScore: row.cite_score, // Updated field name
                impactFactor: row.impact_factor, // Updated field name
                aimsAndScope: row.aims_and_scope, // Updated field name
                indexed: row.indexed, // Updated field name
                link: row.link, // Updated field name
            }));
        case "sage.db":
            return data.map((row) => ({
                title: row.title, // Updated field name
                issn: row.issn, // Updated field name
                publisher: "SAGE", // Retained hardcoded value
                citeScore: row.cite_score, // Updated field name
                impactFactor: row.impact_factor, // Updated field name
                aimsAndScope: row.aims_and_scope, // Updated field name
                indexed: row.indexed, // Updated field name
                link: row.link, // Updated field name
            }));
        case "tandf_journal_details.db":
            return data.map((row) => ({
                title: row.title, // Updated field name
                issn: row.issn, // Updated field name
                publisher: "Taylor & Francis", // Retained hardcoded value
                citeScore: row.cite_score, // Updated field name
                impactFactor: row.impact_factor, // Updated field name
                aimsAndScope: row.aims_and_scope, // Updated field name
                indexed: row.indexed, // Updated field name
                link: row.link, // Updated field name
            }));
        default:
            return [];
    }
};

