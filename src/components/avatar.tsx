import { useState } from 'react'
import { Blobatar } from '@blobatar/react'
import { profileUrl } from '../lib/validation'

export function Avatar({
  name,
  image,
  size,
}: {
  name: string
  image?: string | null
  size?: number
}) {
  const [failedImage, setFailedImage] = useState<string | null>(null)
  const showImage =
    !!image && image !== failedImage && profileUrl.safeParse(image).success
  return (
    <div
      className="avatar overflow-hidden"
      style={size !== undefined ? { width: size, height: size } : undefined}
      aria-hidden="true"
    >
      {showImage ? (
        <img
          src={image}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailedImage(image)}
        />
      ) : (
        <Blobatar
          name={name}
          traits={{ shape: 0.11 }}
          animate="hover"
          width="100%"
          height="100%"
        />
      )}
    </div>
  )
}
