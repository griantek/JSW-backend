const sqlite3 = require('sqlite3');
const path = require('path');

// Database filenames
const databases = [
    'sage.db',
    'elsevier_journals.db',
    'emerald_journals.db',
    'inderscience_journals.db',
    'tandf_journal_details.db',
    'wiley_db.db',
    'world_scientific_journals.db',
    'springer_journals.db',
];

const queryDB = (dbIndex, query, params) => {
    const dbFilePath = path.join(__dirname, '../db', databases[dbIndex]);
    
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbFilePath, (err) => {
            if (err) {
                reject(new Error(`Failed to connect to database ${databases[dbIndex]}: ${err.message}`));
                return;
            }
            
            db.all(query, params, (err, rows) => {
                if (err) {
                    db.close();
                    reject(new Error(`Query error in ${databases[dbIndex]}: ${err.message}`));
                    return;
                }
                
                db.close();
                resolve(rows);
            });
        });
    });
};

module.exports = { queryDB, databases };