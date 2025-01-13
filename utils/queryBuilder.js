const fieldMappings = {
    title: [
        { db: "annex.db", field: "title" },
        { db: "elsevier_journals.db", field: "title" },
        { db: "emerald_journals.db", field: "title" },
        { db: "inderscience_journals.db", field: "title" },
        { db: "ugc.db", field: "title" },
        { db: "wiley_db.db", field: "title" },
        { db: "world_scientific_journals.db", field: "title" },
        { db: "springer_journals.db", field: "title" },
        { db: "sage.db", field: "title" },
        { db: "tandf_journal_details.db", field: "title" }
    ],
    link: [
        { db: "emerald_journals.db", field: "link" },
        { db: "inderscience_journals.db", field: "link" },
        { db: "ugc.db", field: "link" },
        { db: "wiley_db.db", field: "link" },
        { db: "world_scientific_journals.db", field: "link" },
        { db: "springer_journals.db", field: "link" },
        { db: "sage.db", field: "link" },
        { db: "tandf_journal_details.db", field: "link" }
    ],
    issn: [
        { db: "annex.db", field: "issn" },
        { db: "elsevier_journals.db", field: "issn" },
        { db: "emerald_journals.db", field: "issn" },
        { db: "inderscience_journals.db", field: "print_issn" },
        { db: "ugc.db", field: "issn" },
        { db: "wiley_db.db", field: "issn" },
        { db: "world_scientific_journals.db", field: "issn" },
        { db: "springer_journals.db", field: "print_issn" },
        { db: "sage.db", field: "issn" },
        { db: "tandf_journal_details.db", field: "issn" }
    ],
    aimsAndScope: [
        { db: "elsevier_journals.db", field: "aims_and_scope" },
        { db: "emerald_journals.db", field: "aims_and_scope" },
        { db: "inderscience_journals.db", field: "aims_and_scope" },
        { db: "ugc.db", field: "aims_and_scope" },
        { db: "wiley_db.db", field: "aims_and_scope" },
        { db: "world_scientific_journals.db", field: "aims_and_scope" },
        { db: "springer_journals.db", field: "aims_and_scope" },
        { db: "sage.db", field: "aims_and_scope" },
        { db: "tandf_journal_details.db", field: "aims_and_scope" }
    ],
    indexed: [
        { db: "elsevier_journals.db", field: "indexed" },
        { db: "emerald_journals.db", field: "indexed" },
        { db: "inderscience_journals.db", field: "indexed" },
        { db: "ugc.db", field: "indexed" },
        { db: "wiley_db.db", field: "indexed" },
        { db: "world_scientific_journals.db", field: "indexed" },
        { db: "springer_journals.db", field: "indexed" },
        { db: "sage.db", field: "indexed" },
        { db: "tandf_journal_details.db", field: "indexed" }
    ],
    citeScore: [
        { db: "annex.db", field: "cite_score" },
        { db: "elsevier_journals.db", field: "cite_score" },
        { db: "emerald_journals.db", field: "cite_score" },
        { db: "inderscience_journals.db", field: "cite_score" },
        { db: "ugc.db", field: "cite_score" },
        { db: "wiley_db.db", field: "cite_score" },
        { db: "world_scientific_journals.db", field: "cite_score" },
        { db: "springer_journals.db", field: "cite_score" },
        { db: "sage.db", field: "cite_score" },
        { db: "tandf_journal_details.db", field: "cite_score" }
    ],
    impactFactor: [
        { db: "elsevier_journals.db", field: "impact_factor" },
        { db: "emerald_journals.db", field: "impact_factor" },
        { db: "inderscience_journals.db", field: "impact_factor" },
        { db: "ugc.db", field: "impact_factor" },
        { db: "wiley_db.db", field: "impact_factor" },
        { db: "world_scientific_journals.db", field: "impact_factor" },
        { db: "springer_journals.db", field: "impact_factor" },
        { db: "sage.db", field: "impact_factor" },
        { db: "tandf_journal_details.db", field: "impact_factor" }
    ]
};


const indexingKeywords = {
    'Scopus': ['scopus', 'elsevier scopus'],
    'SCI': ['sci', 'science citation index'],
    'SCIE': ['scie', 'science citation index expanded'],
    'EI': ['ei compendex', 'engineering index'],
    'ESCI': ['esci', 'emerging sources citation index'],
    'UGC': ['ugc', 'ugc-care'],
    'Pubmed/Medline': ['pubmed', 'medline'],
    'ABDC': ['abdc', 'australian business deans council'],
    'NAAS': ['naas', 'national academy of agricultural sciences']
};

const exampleFilters = {
    searchText: "machine learning",
    searchFields: ["title", "aimsAndScope"],
    publisher: ["Elsevier", "Springer"],
    databases: ["Scopus", "SCI"],
    citeScoreRange: [10, 50],
    impactFactorRange: [1, 5]
};

const buildQuery = (filters, dbName) => {
    const conditions = [];
    const params = [];

    // Handle search fields
    if (filters.searchText && filters.searchFields && filters.searchFields.length > 0) {
        const searchConditions = [];

        filters.searchFields.forEach((field) => {
            // Map common variations of field names
            let mappedField = field.toLowerCase();
            if (mappedField === "aims & scope" || mappedField === "aims and scope") {
                mappedField = "aimsAndScope";
            }
            
            const fieldMapping = fieldMappings[mappedField]?.find((m) => m.db === dbName);
            if (fieldMapping) {
                searchConditions.push(`${fieldMapping.field} LIKE ?`);
                params.push(`%${filters.searchText}%`);
            }
        });

        if (searchConditions.length > 0) {
            conditions.push(`(${searchConditions.join(" OR ")})`);
        }
    }

    // Handle database indexing filters
    if (filters.databases && filters.databases.length > 0) {
        const indexingMapping = fieldMappings.indexed.find((m) => m.db === dbName);
        if (indexingMapping) {
            const indexingConditions = [];
            filters.databases.forEach((database) => {
                const keywords = indexingKeywords[database];
                if (keywords) {
                    keywords.forEach((keyword) => {
                        indexingConditions.push(`${indexingMapping.field} LIKE ?`);
                        params.push(`%${keyword}%`);
                    });
                }
            });
            if (indexingConditions.length > 0) {
                conditions.push(`(${indexingConditions.join(" OR ")})`);
            }
        }
    }

    // Handle CiteScore range
    if (filters.citeScoreRange && filters.citeScoreRange.length === 2) {
        const [min, max] = filters.citeScoreRange;
        const citeScoreMapping = fieldMappings.citeScore.find((m) => m.db === dbName);
        if (citeScoreMapping) {
            conditions.push(`CAST(NULLIF(${citeScoreMapping.field}, '') AS REAL) BETWEEN ? AND ?`);
            params.push(min, max);
        }
    }

    // Handle Impact Factor range
    if (filters.impactFactorRange && filters.impactFactorRange.length === 2) {
        const [min, max] = filters.impactFactorRange;
        const impactFactorMapping = fieldMappings.impactFactor.find((m) => m.db === dbName);
        if (impactFactorMapping) {
            conditions.push(`CAST(NULLIF(${impactFactorMapping.field}, '') AS REAL) BETWEEN ? AND ?`);
            params.push(min, max);
        }
    }

    // Construct the WHERE clause only if conditions exist
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    return { whereClause, params };
};


module.exports = { buildQuery };
