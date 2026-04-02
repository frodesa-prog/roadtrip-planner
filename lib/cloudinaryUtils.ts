/**
 * Konverterer en Cloudinary-URL slik at HEIC/HEIF-filer serveres som
 * nettleserkompatibelt format (JPEG). Alle andre URL-er returneres uendret.
 *
 * Cloudinary støtter dette via f_jpg-transformasjonen i URL-stien.
 */
export function toWebUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (!url.includes('res.cloudinary.com')) return url

  const lower = url.toLowerCase()
  if (!lower.includes('.heic') && !lower.includes('.heif')) return url

  // Allerede en f_-formatransformasjon i URL-en? Ikke legg til på nytt.
  if (/\/upload\/[^/]*f_/.test(url)) return url

  // Legg til f_jpg rett etter /upload/
  return url.replace('/upload/', '/upload/f_jpg/')
}
