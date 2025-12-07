import dotenv from 'dotenv';
import {fetchMovieDetails} from "./fetchMovieDetails.js";
import {processCountry} from "../process/processCountry.js";
import {fetchTidalAlbums} from "./fetchTidalAlbum.js";

dotenv.config();

const hansZimmer = 947;

export const fetchMovies = async () => {
    const movies = []

    const response = await fetch(`${process.env.BASE_URL}/person/${hansZimmer}/movie_credits?api_key=${process.env.TMDB_API_KEY}`);

    if (!response.ok) {
        console.error(`Failed to fetch movies: ${response.status} - ${response.statusText}`);
        throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    await Promise.all(
        data.crew.map(async (movie) => {
            const detail = await fetchMovieDetails(movie.id)
            console.log(detail);
            movies.push({
                id: movie.id,
                title: detail.title,
                overview: detail.overview,
                poster_path: `${process.env.FULL_POSTER_PATH}/original${detail.poster_path}`,
                origin_country: await processCountry(detail.origin_country[0]),
                tidal_album: await fetchTidalAlbums(movie.title)
            });
        })
    )


    console.log('✅ Fetched Data:', movies[0] );

    return movies || [] ;
}