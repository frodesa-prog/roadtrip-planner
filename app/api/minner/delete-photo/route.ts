import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const publicId = searchParams.get('publicId')
  const id       = searchParams.get('id')

  if (!publicId || !id) {
    return NextResponse.json({ error: 'publicId og id er påkrevd' }, { status: 400 })
  }

  // Slett fra Cloudinary (server-side med API-nøkkel)
  const cloudName   = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey      = process.env.CLOUDINARY_API_KEY
  const apiSecret   = process.env.CLOUDINARY_API_SECRET

  if (cloudName && apiKey && apiSecret) {
    try {
      const timestamp = Math.round(Date.now() / 1000)
      const str = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`

      // SHA-1 signature via Web Crypto
      const encoder = new TextEncoder()
      const data = encoder.encode(str)
      const hashBuffer = await crypto.subtle.digest('SHA-1', data)
      const hashArray  = Array.from(new Uint8Array(hashBuffer))
      const signature  = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

      const form = new FormData()
      form.append('public_id',  publicId)
      form.append('api_key',    apiKey)
      form.append('timestamp',  String(timestamp))
      form.append('signature',  signature)

      await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
        method: 'POST',
        body:   form,
      })
    } catch (err) {
      console.error('Cloudinary delete error:', err)
      // Fortsett selv om Cloudinary-sletting feiler
    }
  }

  // Slett fra Supabase
  const { error } = await supabase
    .from('memory_photos')
    .delete()
    .eq('id', id)
    .eq('uploaded_by', user.id)   // Sjekker at brukeren eier bildet

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
