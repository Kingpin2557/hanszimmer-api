import dotenv from 'dotenv';
import {fetchMovieDetails} from "./fetchMovieDetails.js";
dotenv.config();

export const fetchMovies = async () => {
    const response = await fetch(`${process.env.BASE_URL}/person/947/movie_credits?api_key=${process.env.TMDB_API_KEY}`);
    let movies = []

    if (!response.ok) {
        console.error(`❌ HTTP Error: Status ${response.status} - ${response.statusText}`);
        throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();


    for (const movie of data.crew) {
        console.log('✅ Fetched Data:', movie);
        const movieDetails = await fetchMovieDetails(movie.id);

        for (const movieDetail of movieDetails) {
            movies.push(
                {
                    id: movie.id,
                    title: movieDetail.title,
                    overview: movieDetail.overview
                }
            );
        }
    }


    return movies || [];
}