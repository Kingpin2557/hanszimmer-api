import dotenv from 'dotenv';
dotenv.config();

export const fetchTidalAlbum = async (movieTitle) => {

    console.log('Fetching TIDAL album for movie:', movieTitle);
    try {
        const response = await fetch(
            `https://openapi.tidal.com/v2/artists/12979?countryCode=us&include=albums`,
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

        return data.included[0].attributes.title;

    } catch (error) {
        console.error("Error in fetchTidalAlbum:", error.message);
        throw error;
    }
};
