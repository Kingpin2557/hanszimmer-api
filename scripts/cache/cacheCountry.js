import {processCountry} from "../process/processCountry.js";

const countriesCache = {}
export const countryInfo = async (code) => {
    if(!countriesCache[code]) {
        countriesCache[code] = await processCountry(code)
    }
    return countriesCache[code]
}