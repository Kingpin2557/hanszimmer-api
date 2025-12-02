import express from 'express';
import dotenv from 'dotenv';

import {fetchMovies} from "./scripts/fetch/fetchMovies.js";
import {fetchSpotifyAuth} from "./scripts/fetch/fetchSpotifyAuth.js";

const app = express();
const PORT = 3000;
dotenv.config();

const initialize = async () => {
    const authData = await fetchSpotifyAuth();

    try {
        process.env.SPOTIFY_ACCESS_TOKEN = authData.access_token;
        console.log('Current Access Token Value (First 10 chars):', process.env.SPOTIFY_ACCESS_TOKEN ? process.env.SPOTIFY_ACCESS_TOKEN.substring(0, 10) + '...' : 'TOKEN IS UNDEFINED');
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

