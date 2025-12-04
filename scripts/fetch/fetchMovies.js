import dotenv from 'dotenv';
import {fetchMovieDetails} from "./fetchMovieDetails.js";
import {processCountry} from "../process/processCountry.js";
import {fetchTidalAlbum} from "./fetchTidalAlbum.js";

dotenv.config();

const hansZimmer = 947;

export const fetchMovies = async () => {
    let movies = []

    const response = await fetch(`${process.env.BASE_URL}/person/${hansZimmer}/movie_credits?api_key=${process.env.TMDB_API_KEY}`);

    if (!response.ok) {
        console.error(`Failed to fetch movies: ${response.status} - ${response.statusText}`);
        throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();


    for (const movie of data.crew) {
        const movieDetails = await fetchMovieDetails(movie.id);

        for (const movieDetail of movieDetails) {

            const  tidalAlbum = await fetchTidalAlbum(movieDetail.title);

            movies.push(
                {
                    id: movie.id,
                    title: movieDetail.title,
                    overview: movieDetail.overview,
                    poster_path: `${process.env.FULL_POSTER_PATH}/original${movieDetail.poster_path}`,
                    origin_country: await processCountry(movieDetail.origin_country[0]),
                    tidal_album: tidalAlbum
                }
            );
        }
    }
    console.log('✅ Fetched Data:', movies[0] );


    return movies || [] ;
}