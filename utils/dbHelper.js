const {  databases } = require("../services/dbService");

exports.getTableName = (dbName) => {
    const tableMapping = {
        "annex.db": "journals",
        "ugc.db": "journals",  // Updated to journal_details
        "journal_details.db": "journal_details",  // Added journal_details.db mapping
        "wiley_db.db": "journals",
        "elsevier_journals.db": "journal_details",
        "emerald_journals.db": "journal_details",
        "inderscience_journals.db": "journal_details",
        "springer_journals.db": "journals",  // Make sure this matches your schema
        "tandf_journal_details.db": "journal_details",
        "sage.db": "journal_data",
        "world_scientific_journals.db": "Journals"
    };


    const tableName = tableMapping[dbName];
    if (!tableName) {
        throw new Error(`Unknown database: ${dbName}`);
    }
    return tableName;
};

exports.getDatabasesForPublishers = (publishers) => {
    const publisherToDB = {
        "Taylor & Francis": "tandf_journal_details.db",
        "Wiley": "wiley_db.db",
        "Elsevier": "elsevier_journals.db",
        "Springer": "springer_journals.db",
        "Inderscience": "inderscience_journals.db",
        "World Scientific": "world_scientific_journals.db",
        "Emerald": "emerald_journals.db",
        "Sage": "sage.db",
    };

    return publishers
        .map(publisher => publisherToDB[publisher])
        .filter(db => db && databases.includes(db));
};

