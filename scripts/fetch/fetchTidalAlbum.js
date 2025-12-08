import dotenv from 'dotenv';
import {limitlessFetch} from "../limitlessFetch.js";
import {authTidal} from "../auth/authTidal.js";
dotenv.config();

const STOP_WORDS = new Set([
    "a", "an", "the", "and", "but", "or", "of", "in", "on", "at", "for", "with", "from", "to", "is", "it"
]);

const cleanAndSplitTitle = (title) => {
    return title.toLowerCase()
        // Replace non-alphanumeric characters with a space (except spaces)
        .replace(/[^\w\s]/g, '')
        .split(/\s+/) // Split by one or more spaces
        .filter(word => word.length > 0 && !STOP_WORDS.has(word));
};

const isTitleClose = (albumTitle, movieTitle) => {
    const albumWords = cleanAndSplitTitle(albumTitle);
    const movieWords = cleanAndSplitTitle(movieTitle);

    // Check if ALL significant words from the movie title are included in the album title words
    return movieWords.every(movieWord => albumWords.includes(movieWord));
};

export const fetchTidalAlbums = async (movieTitle) => {
    const auth = await authTidal();

    const accessToken = auth.access_token;
    const data = await limitlessFetch(
        `https://openapi.tidal.com/v2/searchResults/${encodeURIComponent(movieTitle)}?countryCode=NO&explicitFilter=include%2C%20exclude&include=albums,topHits`, 'Tidal API Error'
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
            embed_link:`https://embed.tidal.com/albums/${foundAlbum.id}`,
            title: foundAlbum.attributes.title,
            tracks: `${process.env.BASE_URL}${foundAlbum.relationships.items.links.self}`
        };
    }

    console.log(`No close album title match found for: ${movieTitle}.`);

    return null;
};