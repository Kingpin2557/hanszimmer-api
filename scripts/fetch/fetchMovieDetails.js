import dotenv from 'dotenv';
dotenv.config();

export const fetchMovieDetails = async (id) => {
    const response = await fetch(`${process.env.BASE_URL}/movie/${id}?api_key=${process.env.TMDB_API_KEY}`);

    if (!response.ok) {
        console.error(`Failed to fetch movie details ${response.status} - ${response.statusText}`);
        throw new Error(`API request failed with status ${response.status}`);
    }

    return await response.json();
}