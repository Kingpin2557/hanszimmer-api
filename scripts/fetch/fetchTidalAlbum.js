import dotenv from 'dotenv';
dotenv.config();

export const fetchTidalAlbum = async (albumTitle) => {
    try {
        const response = await fetch(
            `https://openapi.tidal.com/v2/artistRoles/1
`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.TIDAL_ACCESS_TOKEN}`,
                    ContentType: "application/vnd.tidal.v1+json"
                }
            }
        );


        if (!response.ok) {
            console.error(`Fetching tidal album failed ${response.status} - ${response.statusText}`);
            throw new Error(`API request failed with status ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(error);
    }
}