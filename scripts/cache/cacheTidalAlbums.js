import {fetchTidalAlbums} from "../fetch/fetchTidalAlbum.js";

const tidalAlbumCache = {};

export const cacheTidalAlbums = async (movieTitle, countryCode, accessToken) => {
    const key = movieTitle.toLowerCase().trim();

    if (!tidalAlbumCache[key]) {
        tidalAlbumCache[key] = await fetchTidalAlbums(movieTitle, countryCode, accessToken);
    }

    return tidalAlbumCache[key];
};