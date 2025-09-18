import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import sharp from 'sharp';
import OpenAI from 'openai';

// Initialiser le client OpenAI
const openai = new OpenAI();

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};

export async function POST(req: NextRequest) {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized: You must be logged in.' }, { status: 401 });
  }

  // --- NOUVEAU : Vérification et gestion des crédits ---
  const userId = session.user.id;

  // 1. Récupérer le nombre de crédits actuels de l'utilisateur
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    console.error('Error fetching profile:', profileError);
    return NextResponse.json({ error: 'Could not find user profile.' }, { status: 500 });
  }

  // 2. Vérifier si l'utilisateur a suffisamment de crédits
  if (profile.credits <= 0) {
    return NextResponse.json({ error: 'Insufficient credits. Please upgrade your plan.' }, { status: 402 }); // 402 Payment Required
  }
  // --- Fin de la gestion des crédits ---

  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No image file provided.' }, { status: 400 });
    }

    // Le traitement de l'image commence ici...
    const imageBuffer = Buffer.from(await file.arrayBuffer());

    const [jpegBuffer, webpBuffer, altTextResponse] = await Promise.all([
      sharp(imageBuffer).resize({ width: 1920, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer(),
      sharp(imageBuffer).resize({ width: 1920, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Act as an SEO expert. Describe this image in a concise sentence (under 150 characters) for an HTML alt tag. Be descriptive and do not include phrases like 'Image of...'. Write in English." },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBuffer.toString('base64')}` } },
            ],
          },
        ],
        max_tokens: 60,
      })
    ]);
    
    // --- NOUVEAU : Décrémenter les crédits APRÈS un traitement réussi ---
    const { error: updateError } = await supabase
        .from('profiles')
        .update({ credits: profile.credits - 1 })
        .eq('id', userId);

    if (updateError) {
        console.error('Error updating credits:', updateError);
        // On ne bloque pas l'utilisateur s'il y a une erreur ici, mais on la logue
    }
    // --- Fin de la déduction de crédits ---

    const altText = altTextResponse.choices[0].message.content || "Description could not be generated.";
    const jpegBase64 = jpegBuffer.toString('base64');
    const webpBase64 = webpBuffer.toString('base64');

    return NextResponse.json({
      altText: altText,
      originalSize: file.size,
      jpegSize: jpegBuffer.length,
      webpSize: webpBuffer.length,
      jpegBase64: jpegBase64,
      webpBase64: webpBase64,
      creditsRemaining: profile.credits - 1, // On peut renvoyer le nouveau solde
    });

  } catch (error) {
    console.error('Error processing image:', error);
    return NextResponse.json({ error: 'Failed to process the image.' }, { status: 500 });
  }
}

