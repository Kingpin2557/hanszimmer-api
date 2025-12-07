import express from 'express';
import dotenv from 'dotenv';

import {fetchMovies} from "./scripts/fetch/fetchMovies.js";

const PORT = 3000;

dotenv.config();

export const app = express();

app.use(express.json());

app.get('/', async (req, res) => {
    try {
        const movies = await fetchMovies();
        res.send(movies);
    } catch (error) {
        res.status(500).send({
            message: 'Failed to retrieve movie data.',
            error: error.message
        });
    }
});

(async () => {
    try {
    app.listen(PORT, () => console.log(`Listening on port ${PORT}!`));
        console.log('Access token initialized');
    } catch (err) {
        console.error('TIDAL auth failed:', err);
    }
})();
