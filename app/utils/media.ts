import type { Source } from '~/types/ask'

export const isVideo = (src?: Source) => src?.mediaType === 'video'
// APOD videos are either a direct .mp4/.webm or a YouTube embed.
export const isFileVideo = (url?: string) => /\.(mp4|webm|ogg)(\?|$)/i.test(url ?? '')

// Autoplaying, muted, looping YouTube embed (loop needs playlist=<id>).
export function youtubeAutoplaySrc(url: string): string {
  const id = url.match(/embed\/([^?&/]+)/)?.[1]
  if (!id) return url
  return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&playsinline=1&loop=1&playlist=${id}&controls=0&rel=0`
}

// Card preview: a video's thumbnail, otherwise the still image.
export const cardImage = (src: Source) => (isVideo(src) ? src.thumbnailUrl : src.imageUrl)

// Per-card fallback gradient, shown behind and through each image.
export function cardGradient(i: number): string {
  const h = (i * 47 + 200) % 360
  return `radial-gradient(120% 120% at 28% 18%, hsl(${h} 72% 56% / .5), transparent 46%), radial-gradient(90% 90% at 82% 84%, hsl(${(h + 45) % 360} 76% 46% / .42), transparent 52%), #04060b`
}

// Hide a broken image so the gradient shows instead. NuxtPicture's error payload
// is `string | Event`; only the Event carries a DOM target.
export function hideBrokenImage(event: Event | string) {
  if (typeof event === 'string') return
  ;(event.target as HTMLElement).style.display = 'none'
}
