import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import OpenAI from 'openai';

// Initialiser le client OpenAI (assurez-vous d'avoir la variable d'environnement OPENAI_API_KEY)
const openai = new OpenAI();

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb', // Augmenter la limite de taille pour l'upload
        },
    },
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No image file provided.' }, { status: 400 });
    }

    const imageBuffer = Buffer.from(await file.arrayBuffer());

    // --- Lancer tous les traitements en parallèle ---
    const [jpegBuffer, webpBuffer, altTextResponse] = await Promise.all([
      // 1. Pipeline JPEG
      sharp(imageBuffer)
        .resize({ width: 1920, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer(),

      // 2. Pipeline WebP
      sharp(imageBuffer)
        .resize({ width: 1920, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer(),
      
      // 3. Appel à l'API OpenAI pour le texte 'alt'
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Act as an SEO expert. Describe this image in a concise sentence (under 150 characters) for an HTML alt tag. Be descriptive and do not include phrases like 'Image of...'. Write in English." },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${imageBuffer.toString('base64')}` },
              },
            ],
          },
        ],
        max_tokens: 60,
      })
    ]);

    const altText = altTextResponse.choices[0].message.content || "Description non générée.";

    // --- NOUVEAU : Conversion en Base64 pour l'envoi au client ---
    const jpegBase64 = jpegBuffer.toString('base64');
    const webpBase64 = webpBuffer.toString('base64');

    return NextResponse.json({
      altText: altText,
      originalSize: file.size,
      jpegSize: jpegBuffer.length,
      webpSize: webpBuffer.length,
      jpegBase64: jpegBase64,
      webpBase64: webpBase64
    });

  } catch (error) {
    console.error('Error processing image:', error);
    return NextResponse.json({ error: 'Failed to process image. Make sure it is a valid image file.' }, { status: 500 });
  }
}