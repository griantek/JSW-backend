const { 
    queryDB, 
    databases, 
    getDatabaseIndex, 
    fallbackDatabases, 
    queryFallbackDB  // Make sure this is imported
} = require("../services/dbService");
const { buildQuery, fieldMappings } = require("../utils/queryBuilder"); // Add fieldMappings import
const { getTableName, getDatabasesForPublishers } = require("../utils/dbHelper");

// New helper function for batch ISSN processing
const batchSearchISSNs = async (issns, db) => {
    try {
        const tableName = getTableName(db);
        const issnField = fieldMappings.issn.find(m => m.db === db);
        
        if (!issnField) return [];

        // Create parameterized query for multiple ISSNs
        const placeholders = issns.map(() => `${issnField.field} LIKE ?`).join(' OR ');
        const query = `SELECT * FROM ${tableName} WHERE ${placeholders}`;
        const params = issns.map(issn => `%${issn}%`);
        
        console.log(`Batch searching ${issns.length} ISSNs in ${db}`);
        const results = await queryDB(databases.indexOf(db), query, params);
        return normalizeResults(db, results);
    } catch (error) {
        console.error(`Error in batch ISSN search for ${db}:`, error);
        return [];
    }
};

// Add new helper function at the top
const performFallbackSearch = async (filters) => {
    console.log('\n=== Starting Fallback Search Process ===');
    console.log('Original filters:', JSON.stringify(filters, null, 2));
    
    let fallbackResults = [];
    let dbsToSearch = [];

    // Clone filters but preserve search fields
    const fallbackFilters = { ...filters };
    
    // Remove database-specific filters for initial search
    delete fallbackFilters.databases;

    // Determine which fallback databases to query
    if (!filters.databases || filters.databases.length === 0) {
        console.log('No specific databases requested, will search in both UGC and Scopus');
        dbsToSearch = fallbackDatabases;
    } else {
        if (filters.databases.includes('UGC')) {
            dbsToSearch.push('ugc.db');
        }
        if (filters.databases.includes('Scopus')) {
            dbsToSearch.push('journal_details.db');
        }
    }

    console.log('Will search in following databases:', dbsToSearch);

    // Perform fallback search
    for (const db of dbsToSearch) {
        try {
            console.log(`\n--- Processing database: ${db} ---`);
            
            const tableName = getTableName(db);
            console.log('Table name:', tableName);
            
            // Make sure to use the filters to build the query
            const { whereClause, params } = buildQuery(fallbackFilters, db);
            
            // Build complete query with where clause if it exists
            const query = `SELECT * FROM ${tableName} ${whereClause}`;
            
            console.log('Executing fallback query:', query);
            console.log('With parameters:', params);

            const results = await queryFallbackDB(db, query, params);
            console.log(`Found ${results.length} results in ${db}`);

            const normalizedResults = normalizeResults(db, results);
            fallbackResults = fallbackResults.concat(normalizedResults);

        } catch (error) {
            console.error(`Error in fallback search for ${db}:`, error);
        }
    }

    console.log(`\n=== Fallback Search Complete ===`);
    console.log(`Total results found: ${fallbackResults.length}`);
    
    return fallbackResults;
};

exports.searchJournals = async (req, res) => {
    const { filters = {}, sorting = null } = req.body;
    console.log(' Request body:', req.body);

    try {
        let results = [];
        let dbToQuery = [];

        // Determine if we should allow fallback search
        const allowFallback = filters.searchFields && 
            filters.searchFields.map(f => f.toLowerCase()).includes('title');

        if (filters.databases && filters.databases.includes('Annexure')) {
            // Get initial results from annex.db
            const db = 'annex.db';
            try {
                const dbIndex = getDatabaseIndex(db);
                const tableName = getTableName(db);
                const { whereClause, params } = buildQuery(filters, db);
                const query = `SELECT * FROM ${tableName} ${whereClause}`;

                const annexResults = await queryDB(dbIndex, query, params);
                const annexEntries = normalizeResults(db, annexResults);
                
                // Get unique ISSNs from annex results
                const uniqueIssns = [...new Set(annexEntries
                    .map(entry => entry.issn)
                    .filter(issn => issn)
                )];

                if (uniqueIssns.length > 0) {
                    // Determine which databases to search based on publishers filter
                    let targetDbs;
                    if (filters.publishers && filters.publishers.length > 0) {
                        // Get databases corresponding to selected publishers
                        targetDbs = getDatabasesForPublishers(filters.publishers);
                        console.log('Targeting specific publishers:', filters.publishers);
                        console.log('Using databases:', targetDbs);
                    } else {
                        // If no publishers specified, search all databases except annex and ugc
                        targetDbs = databases.filter(d => d !== 'annex.db' && d !== 'ugc.db');
                    }

                    // Batch process ISSNs
                    const batchSize = 50;
                    const issnBatches = [];
                    for (let i = 0; i < uniqueIssns.length; i += batchSize) {
                        issnBatches.push(uniqueIssns.slice(i, i + batchSize));
                    }

                    // Process each database in parallel with batched ISSNs
                    const issnResults = await Promise.all(
                        targetDbs.map(async (dbName) => {
                            const dbResults = await Promise.all(
                                issnBatches.map(batch => batchSearchISSNs(batch, dbName))
                            );
                            return dbResults.flat();
                        })
                    );

                    results = issnResults.flat();
                }

                return res.status(200).json({
                    success: true,
                    data: results,
                    totalResults: results.length,
                    queriedDatabases: filters.publishers && filters.publishers.length > 0 
                        ? getDatabasesForPublishers(filters.publishers) 
                        : databases.filter(d => d !== 'annex.db' && d !== 'ugc.db'),
                    isAnnexure: true
                });
            } catch (error) {
                console.error(`Error in Annexure search:`, error);
                throw error;
            }
        }

        // Determine which databases to query
        if (filters.publishers && filters.publishers.length > 0) {
            dbToQuery = getDatabasesForPublishers(filters.publishers);
        } else if (!filters.databases || filters.databases.length === 0) {
            // If no specific databases selected, include all databases including annex.db
            dbToQuery = databases;
        } else if (filters.databases.includes('Annexure')) {
            // If Annexure is specifically selected
            dbToQuery = ['annex.db'];
        } else {
            // Other specific databases selected
            dbToQuery = databases.filter(db => !['ugc.db', 'annex.db'].includes(db));
        }

        console.log('Using database list:', dbToQuery);

        // Process each database
        for (const db of dbToQuery) {
            try {
                const dbIndex = getDatabaseIndex(db);
                const tableName = getTableName(db);
                const { whereClause, params } = buildQuery(filters, db);
                const query = `SELECT * FROM ${tableName} ${whereClause}`;

                console.log(`Querying ${db} with:`, { query, params });
                const dbResults = await queryDB(dbIndex, query, params);
                
                if (db === 'annex.db' && dbResults.length > 0) {
                    // For annex.db results, perform ISSN-based search in other databases
                    const annexEntries = normalizeResults(db, dbResults);
                    const uniqueIssns = [...new Set(annexEntries
                        .map(entry => entry.issn)
                        .filter(issn => issn)
                    )];

                    if (uniqueIssns.length > 0) {
                        const otherDbs = databases.filter(d => d !== 'annex.db' && d !== 'ugc.db');
                        const batchSize = 50;
                        const issnBatches = [];
                        
                        for (let i = 0; i < uniqueIssns.length; i += batchSize) {
                            issnBatches.push(uniqueIssns.slice(i, i + batchSize));
                        }

                        // Process each database in parallel with batched ISSNs
                        const issnResults = await Promise.all(
                            otherDbs.map(async (dbName) => {
                                const dbResults = await Promise.all(
                                    issnBatches.map(batch => batchSearchISSNs(batch, dbName))
                                );
                                return dbResults.flat();
                            })
                        );

                        // Add ISSN-matched results to the main results array
                        results = results.concat(issnResults.flat());
                    }
                } else {
                    // For non-annex databases, add results directly
                    results = results.concat(normalizeResults(db, dbResults));
                }
            } catch (error) {
                console.error(`Error querying ${db}:`, error.message);
                continue;
            }
        }

        // Only use fallback search if no results found AND searching by title
        if (results.length === 0 && allowFallback) {
            console.log('No results found in primary search and title search detected, attempting fallback search...');
            const fallbackResults = await performFallbackSearch(filters);
            results = fallbackResults;
        } else if (results.length === 0) {
            console.log('No results found, skipping fallback search as not searching by title');
        }

        // Enhanced deduplication with logging
        const seenEntries = new Map();
        const duplicates = [];
        
        results.forEach(item => {
            const key = item.issn + item.publisher;
            if (seenEntries.has(key)) {
                duplicates.push({
                    issn: item.issn,
                    title: item.title,
                    publisher: item.publisher,
                    existing: seenEntries.get(key).title
                });
            } else {
                seenEntries.set(key, item);
            }
        });

        // Log duplicates if any found
        // if (duplicates.length > 0) {
        //     console.log('\nDuplicate entries found:');
        //     duplicates.forEach(dup => {
        //         console.log(`ISSN: ${dup.issn}`);
        //         console.log(`Title 1: ${dup.title}`);
        //         console.log(`Title 2: ${dup.existing}`);
        //         console.log(`Publisher: ${dup.publisher}\n`);
        //     });
        // }

        // Set results to unique entries
        results = Array.from(seenEntries.values());

        // Apply quartile filtering if requested
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

        // Apply sorting to combined results
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

        return res.status(200).json({
            success: true,
            data: results,
            totalResults: results.length,
            queriedDatabases: dbToQuery,
            usedFallback: results.length > 0 && dbToQuery.length === 0,
            isAnnexure: dbToQuery.includes('annex.db')
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
                citeScore: row.cite_score,    // Fixed field name to match db
                impactFactor: row.impact_factor,  // Added impact factor
                aimsAndScope: row.aims_and_scope, // Added aims and scope
                indexed: row.indexed || '',
                link: row.link || '',         // Added link field
                subjectArea: row.subject_area // Fixed field name to match db
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
        case "journal_details.db":
            return data.map((row) => ({
                title: row.title,
                issn: row.issn,
                publisher: row.publisher,
                citeScore: row.cite_score,
                impactFactor: row.impact_factor,
                aimsAndScope: row.aims_and_scope,
                indexed: "Scopus",
                link: row.link || ''
            }));
        default:
            return [];
    }
};

