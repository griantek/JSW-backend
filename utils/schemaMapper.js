const mapJournalData = (source, data) => {
    switch (source) {
        case 'elsevier':
            return data.map((row) => ({
                title: row.journal_title,
                issn: row.issn,
                publisher: 'Elsevier',
                citeScore: row.cite_score,
                impactFactor: row.impact_factor,
                aimsAndScope: row.aims_and_scope,
                link: row.shop_url,
            }));
        case 'emerald':
            return data.map((row) => ({
                title: row.Title,
                issn: row.ISSN,
                publisher: 'Emerald',
                citeScore: row.CiteScore,
                impactFactor: row.Impact_Factor,
                aimsAndScope: row.Aims_and_Scope,
                link: row.Link,
            }));
        // Add cases for other databases...
        default:
            return [];
    }
};

module.exports = { mapJournalData };
