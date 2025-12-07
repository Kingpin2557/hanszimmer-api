export async function limitlessFetch(url, errMsg = "Failed to fetch", token = '') {
    const maxTries = 3
    for(let attempt = 1, timeout = 750; attempt <= maxTries; attempt++, timeout *= 1.5) {
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                accept: "application/vnd.api+json"
            }
        })
        if(response.ok) {
            return await response.json()
        }

        if(response.status !== 429) {
            throw new Error(`${errMsg}: ${response.status}: "${url}"`)
        }
        await new Promise((resolve) => setTimeout(resolve, timeout))
    }
    throw new Error(`Failed to fetch after ${maxTries} retries.`)
}