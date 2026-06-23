'use client'

import { useState } from 'react'

export type UploadResult =
  | { url: string; publicId: string; error: null }
  | { url: null; publicId: null; error: string }

export function useCloudinaryUpload(folder: string) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ url: string; publicId: string } | null>(null)

  async function upload(file: File): Promise<UploadResult> {
    setUploading(true)
    setError(null)

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    if (!cloudName) {
      const msg = 'Cloudinary cloud name is not configured.'
      setError(msg)
      setUploading(false)
      return { url: null, publicId: null, error: msg }
    }

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', `beehive_${folder}`)
      formData.append('folder', folder)

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: 'POST', body: formData },
      )

      if (!res.ok) {
        // Surface Cloudinary's actual error message so callers can show a
        // useful toast (e.g. "Upload preset not found", "Invalid signature").
        let detail = `HTTP ${res.status}`
        try {
          const body = (await res.json()) as { error?: { message?: string } }
          if (body?.error?.message) detail = body.error.message
        } catch {
          // ignore non-JSON response
        }
        console.error('[cloudinary] upload failed:', detail)
        throw new Error(detail)
      }

      const data = await res.json()
      const uploaded = { url: data.secure_url as string, publicId: data.public_id as string }
      setResult(uploaded)
      return { ...uploaded, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setError(message)
      return { url: null, publicId: null, error: message }
    } finally {
      setUploading(false)
    }
  }

  return { upload, uploading, error, result }
}
