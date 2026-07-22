import { FetchError } from 'ofetch'

export default defineEventHandler(async () => {
    const config = useRuntimeConfig()
    const nasaApodApiUrl = config.public.nasaApodApiUrl

    try {
        return await $fetch(nasaApodApiUrl, {
            query: {
                api_key: config.nasaApiKey
            }
        })
    } catch (error) {
        console.error(error)
        if (error instanceof FetchError) {
            throw createError({
                statusCode: error.statusCode || 502,
                statusMessage: 'Could not reach the NASA APOD API'
            })
        }
        throw createError({ statusCode: 502, statusMessage: 'Unexpected error' })
    }
})
