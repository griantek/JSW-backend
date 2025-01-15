const { queryDB, databases } = require("../services/dbService");
const { buildQuery } = require("../utils/queryBuilder");
const { getTableName, getDatabasesForPublishers } = require("../utils/dbHelper");

exports.searchJournals = async (req, res) => {
    console.log('Received search request:', req.body);
    const { filters = {}, sorting = null } = req.body;  // Extract sorting from root level

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
                const { whereClause, params } = buildQuery(filters, db);  // Remove sorting parameter
                // whereClause now includes both WHERE and ORDER BY clauses
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

        // If quartile filtering is requested, apply it before sorting
        if (filters.quartiles && filters.quartiles.length > 0) {
            // First sort by impact factor desc for quartile calculation
            results.sort((a, b) => {
                const aVal = parseFloat(a.impactFactor) || 0;
                const bVal = parseFloat(b.impactFactor) || 0;
                return bVal - aVal;
            });

            // Calculate quartile ranges
            const totalResults = results.length;
            const quarterSize = Math.ceil(totalResults / 4);
            
            // Create quartile ranges
            const quartileRanges = {
                'Q1': [0, quarterSize],
                'Q2': [quarterSize, quarterSize * 2],
                'Q3': [quarterSize * 2, quarterSize * 3],
                'Q4': [quarterSize * 3, totalResults]
            };

            // Filter results based on selected quartiles
            const filteredResults = [];
            filters.quartiles.forEach(quartile => {
                const [start, end] = quartileRanges[quartile];
                filteredResults.push(...results.slice(start, end));
            });

            // Replace results with filtered results
            results = filteredResults;
        }

        // Sort combined results
        if (sorting && sorting.field) {
            const sortField = sorting.field.toLowerCase();
            const sortOrder = sorting.order || 'desc';
            
            console.log('Sorting by:', sortField, 'in order:', sortOrder);
            
            results.sort((a, b) => {
                let aVal, bVal;
                
                // Handle different field types
                switch(sortField) {
                    case 'impactfactor':
                        aVal = parseFloat(a.impactFactor) || 0;
                        bVal = parseFloat(b.impactFactor) || 0;
                        break;
                    case 'citescore':
                        aVal = parseFloat(a.citeScore) || 0;
                        bVal = parseFloat(b.citeScore) || 0;
                        break;
                    case 'title':
                    case 'publisher':
                        // Case-insensitive string comparison
                        aVal = (a[sortField] || '').toLowerCase();
                        bVal = (b[sortField] || '').toLowerCase();
                        // Use localeCompare for proper string sorting
                        return sortOrder === 'desc' 
                            ? bVal.localeCompare(aVal)
                            : aVal.localeCompare(bVal);
                    default:
                        aVal = a[sortField];
                        bVal = b[sortField];
                }
                
                // Numeric comparison for impact factor and cite score
                if (sortOrder === 'desc') {
                    return bVal - aVal;
                }
                return aVal - bVal;
            });
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
                indexed: row.indexed || '', // Add indexed field
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
                indexed: row.indexed || '', // Add indexed field
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
                indexed: row.indexed || '', // Add indexed field
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
                indexed: row.indexed || '', // Add indexed field
            }));
        case "ugc.db":
            return data.map((row) => ({
                title: row.journal_title,
                issn: row.issn,
                publisher: row.publisher,
                citeScore: row.CiteScore,
                subjectArea: row.SubjectArea,
                keywords: row.keywords,
                indexed: row.indexed || '', // Add indexed field
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
                indexed: row.indexed || '', // Add indexed field
            }));
        case "world_scientific_journals.db":
            return data.map((row) => ({
                title: row.title, // Updated field name
                issn: row.issn, // Updated field name
                publisher: "World Scientific", // Retained hardcoded value
                citeScore: row.cite_score, // Updated field name
                impactFactor: row.impact_factor, // Updated field name
                aimsAndScope: row.aims_and_scope, // Updated field name
                indexed: row.indexed || '', // Add indexed field
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
                indexed: row.indexed || '', // Add indexed field
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
                indexed: row.indexed || '', // Add indexed field
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
                indexed: row.indexed || '', // Add indexed field
                link: row.link, // Updated field name
            }));
        default:
            return [];
    }
};

