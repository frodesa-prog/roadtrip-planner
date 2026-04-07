import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id er påkrevd' }, { status: 400 })

  // Hent vedlegget for å verifisere tilgang og få Cloudinary-info
  const { data: attachment, error: fetchError } = await supabase
    .from('attachments')
    .select('id, cloudinary_public_id, file_type, uploaded_by')
    .eq('id', id)
    .single()

  if (fetchError || !attachment) {
    return NextResponse.json({ error: 'Vedlegg ikke funnet' }, { status: 404 })
  }

  // Kun opplasteren kan slette
  if (attachment.uploaded_by !== user.id) {
    return NextResponse.json({ error: 'Ikke tilgang' }, { status: 403 })
  }

  // Slett fra Cloudinary (PDF-er er 'raw', bilder er 'image')
  const cloudName  = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey     = process.env.CLOUDINARY_API_KEY
  const apiSecret  = process.env.CLOUDINARY_API_SECRET

  if (cloudName && apiKey && apiSecret) {
    try {
      const resourceType = attachment.file_type === 'pdf' ? 'raw' : 'image'
      const publicId     = attachment.cloudinary_public_id
      const timestamp    = Math.round(Date.now() / 1000)

      const str = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`
      const encoded     = new TextEncoder().encode(str)
      const hashBuffer  = await crypto.subtle.digest('SHA-1', encoded)
      const signature   = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

      const form = new FormData()
      form.append('public_id', publicId)
      form.append('api_key',   apiKey)
      form.append('timestamp', String(timestamp))
      form.append('signature', signature)

      await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`,
        { method: 'POST', body: form },
      )
    } catch (err) {
      console.error('[attachments/delete] Cloudinary-feil:', err)
      // Fortsetter selv om Cloudinary-sletting feiler – fjerner fra DB uansett
    }
  }

  // Slett fra Supabase
  const { error } = await supabase
    .from('attachments')
    .delete()
    .eq('id', id)
    .eq('uploaded_by', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
