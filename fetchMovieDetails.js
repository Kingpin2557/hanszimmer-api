import dotenv from 'dotenv';
dotenv.config();

export const fetchMovieDetails = async (id) => {
    const response = await fetch(`${process.env.BASE_URL}/movie/${id}?api_key=${process.env.TMDB_API_KEY}`);

    if (!response.ok) {
        console.error(`❌ HTTP Error: Status ${response.status} - ${response.statusText}`);
        throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();

    return [data] || [];
}