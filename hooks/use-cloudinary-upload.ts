'use client'

import { useState } from 'react'

type UploadState = { url: string; publicId: string } | null

export function useCloudinaryUpload(folder: string) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<UploadState>(null)

  async function upload(file: File): Promise<UploadState> {
    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', `beehive_${folder}`)
      formData.append('folder', folder)

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData },
      )

      if (!res.ok) throw new Error('Upload failed')

      const data = await res.json()
      const uploaded = { url: data.secure_url, publicId: data.public_id }
      setResult(uploaded)
      return uploaded
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setError(message)
      return null
    } finally {
      setUploading(false)
    }
  }

  return { upload, uploading, error, result }
}
