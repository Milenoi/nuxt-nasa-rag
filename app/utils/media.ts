import type { Source } from '~/types/ask'

// APOD videos come in two shapes: a direct .mp4 hosted by NASA, or a YouTube
// embed URL. We autoplay them muted + looping in the hero.
export const isVideo = (src?: Source) => src?.mediaType === 'video'
export const isFileVideo = (url?: string) => /\.(mp4|webm|ogg)(\?|$)/i.test(url ?? '')

// Build an autoplaying, muted, looping YouTube embed (loop needs playlist=<id>).
export function youtubeAutoplaySrc(url: string): string {
  const id = url.match(/embed\/([^?&/]+)/)?.[1]
  if (!id) return url
  return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&playsinline=1&loop=1&playlist=${id}&controls=0&rel=0`
}

// Card preview: video thumbnail if we have one, else the still image (and the
// gradient shows through when there's neither).
export const cardImage = (src: Source) => (isVideo(src) ? src.thumbnailUrl : src.imageUrl)

// A colourful gradient behind each image (and shown if the image fails to load),
// varied per card index so the row never looks flat.
export function cardGradient(i: number): string {
  const h = (i * 47 + 200) % 360
  return `radial-gradient(120% 120% at 28% 18%, hsl(${h} 72% 56% / .5), transparent 46%), radial-gradient(90% 90% at 82% 84%, hsl(${(h + 45) % 360} 76% 46% / .42), transparent 52%), #04060b`
}

// Hide a broken image so the gradient placeholder underneath shows instead.
// NuxtPicture types its error payload as `string | Event`; only the Event form
// carries a DOM target to hide.
export function hideBrokenImage(event: Event | string) {
  if (typeof event === 'string') return
  ;(event.target as HTMLElement).style.display = 'none'
}
