const sqlite3 = require('sqlite3');
const path = require('path');

// Database filenames with full array of databases
const databases = [
    'annex.db',  // Add annex.db to the list
    'sage.db',
    'elsevier_journals.db',
    'emerald_journals.db',
    'inderscience_journals.db',
    'tandf_journal_details.db',
    'wiley_db.db',
    'world_scientific_journals.db',
    'springer_journals.db',
    'ugc.db'     // Keep ugc.db in main list but remove journal_details.db
];

// Add a new constant for fallback databases
const fallbackDatabases = ['journal_details.db', 'ugc.db'];

const queryDB = (dbIndex, query, params) => {
    // Validate dbIndex
    if (dbIndex < 0 || dbIndex >= databases.length || typeof dbIndex !== 'number') {
        return Promise.reject(new Error(`Invalid database index: ${dbIndex}`));
    }

    const dbName = databases[dbIndex];
    if (!dbName) {
        return Promise.reject(new Error(`No database found at index ${dbIndex}`));
    }

    const dbFilePath = path.join(__dirname, '..', 'db', dbName);
    // console.log(`Attempting to query database at: ${dbFilePath}`);

    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbFilePath, (err) => {
            if (err) {
                reject(new Error(`Failed to connect to database ${dbName}: ${err.message}`));
                return;
            }
            
            db.all(query, params, (err, rows) => {
                if (err) {
                    db.close();
                    reject(new Error(`Query error in ${dbName}: ${err.message}`));
                    return;
                }
                
                db.close();
                resolve(rows);
            });
        });
    });
};

// Add a separate function for fallback database queries without index validation
const queryFallbackDB = (dbName, query, params) => {
    const dbFilePath = path.join(__dirname, '..', 'db', dbName);
    
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbFilePath, (err) => {
            if (err) {
                reject(new Error(`Failed to connect to fallback database ${dbName}: ${err.message}`));
                return;
            }
            
            db.all(query, params, (err, rows) => {
                if (err) {
                    db.close();
                    reject(new Error(`Query error in ${dbName}: ${err.message}`));
                    return;
                }
                
                db.close();
                resolve(rows);
            });
        });
    });
};

// Add helper function to get database index
const getDatabaseIndex = (dbName) => {
    const index = databases.indexOf(dbName);
    if (index === -1) {
        throw new Error(`Database ${dbName} not found in available databases`);
    }
    return index;
};

// Make sure to export all functions and constants
module.exports = { 
    queryDB,
    queryFallbackDB,  // Make sure this is exported
    databases,
    fallbackDatabases,
    getDatabaseIndex
};