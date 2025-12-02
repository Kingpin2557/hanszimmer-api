export const processCountry = async (code) => {
    let country = {};

    const response = await fetch(`https://restcountries.com/v3.1/alpha/${code}`);

    if (!response.ok) {
        console.error(`❌ HTTP Error: Status ${response.status} - ${response.statusText}`);
        throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();

    if (data && data.length > 0) {
        country = {
            name: data[0].name.official,
            code: data[0].cca2,
            coords: {
                lat: data[0].latlng[0],
                lng: data[0].latlng[1]
            }
        }
    } else {
        console.error('API returned no country data.');
    }
    return country;
}