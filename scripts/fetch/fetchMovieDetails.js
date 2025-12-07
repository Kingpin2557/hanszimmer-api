import dotenv from 'dotenv';
import {limitlessFetch} from "../limitlessFetch.js";
dotenv.config();

export const fetchMovieDetails = async (id) => {
    return await limitlessFetch(`${process.env.BASE_URL}/movie/${id}?api_key=${process.env.TMDB_API_KEY}`);
}