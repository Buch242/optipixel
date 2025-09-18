import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import sharp from 'sharp';
import OpenAI from 'openai';

// Initialiser le client OpenAI
const openai = new OpenAI();

export async function POST(req: NextRequest) {
  const cookieStore = cookies();

  // Création du client Supabase pour le serveur avec une configuration complète et robuste
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // NOTE: Les fonctions set et remove sont requises par la librairie pour être complètes.
        // Nous ajoutons un bloc try/catch comme bonne pratique et préfixons les variables
        // non utilisées avec '_' pour satisfaire le linter.
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Les en-têtes de la requête sont en lecture seule dans les API Routes.
            // Cette erreur est attendue et peut être ignorée en toute sécurité.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // Idem que pour la fonction set.
          }
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized: You must be logged in.' }, { status: 401 });
  }

  const userId = session.user.id;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    console.error('Error fetching profile:', profileError);
    return NextResponse.json({ error: 'Could not find user profile.' }, { status: 500 });
  }

  if (profile.credits <= 0) {
    return NextResponse.json({ error: 'Insufficient credits. Please upgrade your plan.' }, { status: 402 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No image file provided.' }, { status: 400 });
    }

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
    
    const { error: updateError } = await supabase
        .from('profiles')
        .update({ credits: profile.credits - 1 })
        .eq('id', userId);

    if (updateError) {
        console.error('Error updating credits:', updateError);
    }

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
      creditsRemaining: profile.credits - 1,
    });

  } catch (error) {
    console.error('Error processing image:', error);
    return NextResponse.json({ error: 'Failed to process the image.' }, { status: 500 });
  }
}

