import dotenv from 'dotenv';
import {limitlessFetch} from "../limitlessFetch.js";
import {cacheMovies} from "../cache/cacheMovies.js";
import {countryInfo} from "../cache/cacheCountry.js";
import {cacheTidalAlbums} from "../cache/cacheTidalAlbums.js";

dotenv.config();

const hansZimmer = 947;

export const fetchMovies = async () => {
    const movies = []
    const data = await limitlessFetch(`${process.env.BASE_URL}/person/${hansZimmer}/movie_credits?api_key=${process.env.TMDB_API_KEY}`, 'TMDB API Error');
    for (const movie of data.crew) {
        const detail = await cacheMovies(movie.id)
        movies.push({
            id: movie.id,
            title: detail.original_title,
            overview: detail.overview,
            poster_path: `${process.env.FULL_POSTER_PATH}/original${detail.poster_path}`,
            origin_country: await countryInfo(detail.origin_country[0]),
            tidal_album: await cacheTidalAlbums(movie.original_title)
        });
    }

    console.log(`Fetched ${movies.length} movies.`);
    return movies || [] ;
}