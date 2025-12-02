export const fetchSpotifyAuth = async () => {
    const credentials = Buffer.from(`${process.env.SPOTIFY_CLIENT}:${process.env.SPOTIFY_SECRET_CLIENT}`).toString('base64');

    try {
        const response = await fetch("https://accounts.spotify.com/api/token", {
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