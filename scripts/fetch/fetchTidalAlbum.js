import dotenv from 'dotenv';

dotenv.config();

const TIDAL_RATE_LIMIT_DELAY = 1000;

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let lastRequestTime = 0;


const isTitleClose = (albumTitle, movieTitle) => {
    const cleanedMovieTitle = movieTitle.toLowerCase().trim();
    return albumTitle.toLowerCase().includes(cleanedMovieTitle);
};

export const fetchTidalAlbums = async (movieTitle) => {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < TIDAL_RATE_LIMIT_DELAY) {
        const timeToWait = TIDAL_RATE_LIMIT_DELAY - timeSinceLastRequest;
        await wait(timeToWait);
    }


    const response = await fetch(`https://openapi.tidal.com/v2/searchResults/${encodeURIComponent(movieTitle)}?countryCode=NO&explicitFilter=include&include=albums,topHits`, {
        headers: {
            Authorization: `Bearer ${process.env.TIDAL_ACCESS_TOKEN}`,
            accept: "application/vnd.api+json"
        }
    });

    lastRequestTime = Date.now();

    if (!response.ok) {
        throw new Error(`TIDAL API request failed: ${response.status}`);
    }

    const data = await response.json();

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