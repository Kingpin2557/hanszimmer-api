import dotenv from 'dotenv';
import {fetchMovieDetails} from "./fetchMovieDetails.js";
import {processCountry} from "../process/processCountry.js";
import {fetchTidalAlbums} from "./fetchTidalAlbum.js";
import {limitlessFetch} from "../limitlessFetch.js";

dotenv.config();

const hansZimmer = 947;

export const fetchMovies = async () => {
    const movies = []
    const data = await limitlessFetch(`${process.env.BASE_URL}/person/${hansZimmer}/movie_credits?api_key=${process.env.TMDB_API_KEY}`, 'TMDB API Error');

    for (const movie of data.crew) {
        const detail = await fetchMovieDetails(movie.id)
        movies.push({
            id: movie.id,
            title: detail.title,
            overview: detail.overview,
            poster_path: `${process.env.FULL_POSTER_PATH}/original${detail.poster_path}`,
            origin_country: await processCountry(detail.origin_country[0]),
            tidal_album: await fetchTidalAlbums(movie.title, detail.origin_country[0])
        });
    }

    return movies || [] ;
}