import dotenv from 'dotenv';
dotenv.config();

export const fetchTidalAlbum = async (movieTitle, countryCode) => {

    try {
        const response = await fetch(
            `https://openapi.tidal.com/v2/artists/12979?countryCode=${countryCode}&include=albums`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.TIDAL_ACCESS_TOKEN}`,
                    accept: "application/vnd.api+json"
                }
            }
        );

        if (!response.ok) {
            console.error(`Fetching TIDAL album failed: ${response.status} - ${response.statusText}`);
            throw new Error(`TIDAL API request failed with status ${response.status}`);
        }

        const data = await response.json();

        const matchingAlbum = data.included?.find(album => {
            const albumTitle = album.attributes?.title;
            return albumTitle?.toLowerCase() === movieTitle.toLowerCase();
        }) || null;

        const albumId = matchingAlbum?.id || null;

        if (albumId) {
            console.log(`✅ Match Found! Album ID: ${albumId}`);
        } else {
            console.log(`❌ No exact TIDAL match found for movie: "${movieTitle}"`);
            console.log("API response:", JSON.stringify(data, null, 2));
        }

        return albumId;

    } catch (error) {
        console.error("Error in fetchTidalAlbum:", error.message);
        throw error;
    }
};
