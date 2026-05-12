import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export function getCloudinaryPublicId(url: string): string | null {
  try {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

export async function deleteCloudinaryImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId)
}

export function buildCloudinaryUrl(
  publicId: string,
  opts: { width?: number; height?: number; quality?: number } = {},
): string {
  const { width, height, quality = 80 } = opts
  const transforms = [
    `q_${quality}`,
    `f_auto`,
    width ? `w_${width}` : null,
    height ? `h_${height}` : null,
    width || height ? 'c_fill' : null,
  ].filter(Boolean).join(',')
  return `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/${transforms}/${publicId}`
}
