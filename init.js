import express from 'express';
import dotenv from 'dotenv';

import {fetchMovies} from "./scripts/fetch/fetchMovies.js";
import {authTidal} from "./scripts/auth/authTidal.js";

const app = express();
const PORT = 3000;
dotenv.config();

const initialize = async () => {
    const authData = await authTidal();

    try {
        process.env.TIDAL_ACCESS_TOKEN = authData.access_token;
        console.log('Current Access Token Value (First 10 chars):', process.env.TIDAL_ACCESS_TOKEN ? process.env.TIDAL_ACCESS_TOKEN : 'TOKEN IS UNDEFINED');

        app.listen(
            PORT,
            () => console.log(`🚀 Server running on http://localhost:${PORT}`)
        );
    } catch (err) {
        console.error('Spotify authentication failed:', err);
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

