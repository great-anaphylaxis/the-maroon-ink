export let builder;

export function urlFor(source) {
    return builder.image(source);
}

export function SanityImageInit(createImageUrlBuilder, client) {
    builder = createImageUrlBuilder(client)
}