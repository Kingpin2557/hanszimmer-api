import dotenv from 'dotenv';
import {limitlessFetch} from "../limitlessFetch.js";
import {authTidal} from "../auth/authTidal.js";
dotenv.config();
const auth = await authTidal();

const isTitleClose = (albumTitle, movieTitle) => {
    const cleanedMovieTitle = movieTitle.toLowerCase().trim();
    return albumTitle.toLowerCase().includes(cleanedMovieTitle);
};

export const fetchTidalAlbums = async (movieTitle) => {
    const accessToken = auth.access_token;
    const data = await limitlessFetch(
        `https://openapi.tidal.com/v2/searchResults/${encodeURIComponent(movieTitle)}?countryCode=NO&explicitFilter=include%2C%20exclude&include=albums`, 'Tidal API Error'
        , accessToken)


    let foundAlbum = null;

    if (data.included && Array.isArray(data.included)) {
        foundAlbum = data.included.find(item => {
            if (item.type === 'albums' && item.attributes && item.attributes.title) {
                return isTitleClose(item.attributes.title, movieTitle);
            }
            return false;
        });
    }

    if (foundAlbum) {
        console.log(`Successfully found close album match: ${foundAlbum.attributes.title}`);
        return {
            id: foundAlbum.id,
            title: foundAlbum.attributes.title,
            tracks: `${process.env.BASE_URL}${foundAlbum.relationships.items.links.self}`
        };
    }

    console.log(`No close album title match found for: ${movieTitle}.`);

    return null;
};