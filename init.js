import express from 'express';
import dotenv from 'dotenv';

import {fetchMovies} from "./scripts/fetch/fetchMovies.js";

const app = express();
const PORT = 3000;
dotenv.config();

const initialize = async () => {

    try {
        app.listen(
            PORT,
            () => console.log(`🚀 Server running on http://localhost:${PORT}`)
        );

    } catch (err) {
        console.error('Initialization failed:', err);
    }
}


app.use(express.json());

app.get('/', async (req, res) => {
    try {
        const movies = await fetchMovies();
        res.send(movies);

    } catch (error) {
        console.error('Error fetching movies:', error);

        res.status(500).send({
            message: 'Failed to retrieve movie data.',
            error: error.message
        });
    }
});

initialize();

