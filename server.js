const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Initialize SQLite database connection
const db = new sqlite3.Database('./timeline.db', (err) => {
    if (err) console.error('Database connection error:', err.message);
    else console.log('Connected to local SQLite database (timeline.db).');
});

// Create tables and seed initial sample data matching your configuration exactly
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sDay INTEGER,
            sMonth INTEGER,
            sYear INTEGER,
            eDay INTEGER,
            eMonth INTEGER,
            eYear INTEGER,
            isSpan BOOLEAN,
            title TEXT NOT NULL,
            desc TEXT
        )
    `);

    db.get("SELECT COUNT(*) as count FROM events", (err, row) => {
        if (!err && row.count === 0) {
            const initialEvents = [
                [15, 3, -44, 15, 3, -44, 0, 'Assassination of Caesar', 'Julius Caesar is assassinated at the Roman Senate, altering global history paths.'],
                [24, 8, 79, 24, 8, 79, 0, 'Vesuvius Destroys Pompeii', 'The catastrophic eruption burying local Roman communities in volcanic sediment layers.'],
                [1, 1, -753, 1, 1, -753, 0, 'Founding of Rome', 'The traditional date marking Romulus establishing the settlements on the Palatine Hill.'],
                [1, 1, -100, 1, 1, -27, 1, 'Fall of the Roman Republic', 'A period of profound institutional decay, civil conflict, and shifting military hegemony.'],
                [8, 3, -51, 12, 8, -30, 1, 'Reign of Cleopatra VII', 'Sits nested within the Roman collapse. Her strategic alliances with Caesar and Mark Antony guided Mediterranean trade and power blocks.'],
                [1, 1, 500, 31, 12, 1500, 1, 'The European Middle Ages', 'Feudal socioeconomic tracking loops running across a full millennium spectrum.']
            ];
            const stmt = db.prepare(`
                INSERT INTO events (sDay, sMonth, sYear, eDay, eMonth, eYear, isSpan, title, desc) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            initialEvents.forEach(evt => stmt.run(evt));
            stmt.finalize();
            console.log("Database seeded with default historical events.");
        }
    });
});

// Explicit home root path routing mapping logic to prevent "Cannot GET /" errors
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// GET all historical entries from SQLite
app.get('/api/events', (req, res) => {
    db.all("SELECT * FROM events ORDER BY sYear ASC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const formatted = rows.map(r => ({ ...r, isSpan: !!r.isSpan }));
        res.json(formatted);
    });
});

// POST single event marker
app.post('/api/events', (req, res) => {
    const { sDay, sMonth, sYear, eDay, eMonth, eYear, isSpan, title, desc } = req.body;
    db.run(`
        INSERT INTO events (sDay, sMonth, sYear, eDay, eMonth, eYear, isSpan, title, desc)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [sDay || 1, sMonth || 1, sYear, eDay || sDay || 1, eMonth || sMonth || 1, eYear || sYear, isSpan ? 1 : 0, title, desc], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, success: true });
    });
});

// POST bulk array transaction processing router
app.post('/api/events/bulk', (req, res) => {
    const bulkArray = req.body;
    if (!Array.isArray(bulkArray)) return res.status(400).json({ error: "Invalid data format. Expected an array." });

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        const stmt = db.prepare(`
            INSERT INTO events (sDay, sMonth, sYear, eDay, eMonth, eYear, isSpan, title, desc)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        try {
            bulkArray.forEach(evt => {
                stmt.run([
                    evt.sDay || 1,
                    evt.sMonth || 1,
                    evt.sYear || 0,
                    evt.eDay || evt.sDay || 1,
                    evt.eMonth || evt.sMonth || 1,
                    evt.eYear || evt.sYear || 0,
                    evt.isSpan ? 1 : 0,
                    evt.title || "Untitled Bulk Event",
                    evt.desc || ""
                ]);
            });
            stmt.finalize();
            db.run("COMMIT");
            res.json({ success: true, count: bulkArray.length });
        } catch (err) {
            db.run("ROLLBACK");
            res.status(500).json({ error: "Transaction aborted. Bulk data processing failed." });
        }
    });
});

// DELETE single historical row entry
app.delete('/api/events/:id', (req, res) => {
    db.run("DELETE FROM events WHERE id = ?", req.params.id, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server actively running on port ${PORT}`);
});