import dotenv from 'dotenv';
dotenv.config();

export const authTidal = async () => {
    const credentials = Buffer.from(`${process.env.TIDAL_CLIENT}:${process.env.TIDAL_SECRET_CLIENT}`).toString('base64');

    try {
        const response = await fetch("https://auth.tidal.com/v1/oauth2/token", {
            method: "POST",
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded',

            },
            body: "grant_type=client_credentials"
        })

        if (!response.ok) {
            console.error(`❌ Spotify Auth Error: Status ${response.status}`);
            throw new Error(`Spotify authentication failed.`);
        }

        return await response.json();
    } catch (error) {
        console.error('An error occurred during Spotify fetch:', error.message);
        throw error;
    }
}