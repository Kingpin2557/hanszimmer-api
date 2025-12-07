import {fetchMovieDetails} from "../fetch/fetchMovieDetails.js";

const movieDetailsCache = {};

export const cacheMovies = async (movieId) => {
    const key = String(movieId);

    if (!movieDetailsCache[key]) {
        movieDetailsCache[key] = await fetchMovieDetails(movieId);
    }

    return movieDetailsCache[key];
};