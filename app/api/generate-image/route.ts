import { Whisk } from "@rohitaryal/whisk-api";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Inicializar Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { prompt, aspectRatio, title, price, cta, uploadedImage, refinementPrompt } = await request.json();

    const cookie = process.env.WHISK_COOKIE;

    if (!cookie) {
      return NextResponse.json(
        { error: "❌ Cookie do Whisk não configurado" },
        { status: 400 }
      );
    }

    console.log(`🎨 Processando imagem...`);

    const whisk = new Whisk(cookie);
    const project = await whisk.newProject("Gerador Imagens");

    let media;
    let isUploadedImage = false;

    if (uploadedImage) {
      console.log(`📤 Usando imagem enviada pelo usuário`);
      isUploadedImage = true;

      // Converter base64 para buffer
      const base64Data = uploadedImage.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      // Salvar em memória (não em disco)
      const tempPath = `/tmp/temp-${Date.now()}.png`;
      fs.writeFileSync(tempPath, buffer);

      try {
        console.log(`📤 Fazendo upload da imagem como Subject...`);
        const uploadedRef = await project.addSubject({ file: tempPath });
        console.log(`✅ Imagem enviada com sucesso`);

        const textPrompt = refinementPrompt || `
Add professional text overlay at the bottom of the image with a semi-transparent dark background (rgba 0,0,0,0.85):

TITLE: "${title}"
- Font: Bold, Large (60-90px)
- Color: White (#FFFFFF)
- Position: Top of overlay area

PRICE: "${price}"
- Font: Bold, Extra Large (80-120px)
- Color: Gold (#FFD700)
- Position: Middle of overlay area

CALL TO ACTION: "${cta}"
- Font: Bold, Medium (35-50px)
- Color: White (#FFFFFF)
- Position: Bottom of overlay area

REQUIREMENTS:
- Add black outline/stroke around all text for better visibility
- Ensure text is centered horizontally
- Use professional typography
- Keep the dark overlay semi-transparent
- Use high contrast for maximum legibility
- DO NOT modify or change the original image content
- ONLY add text overlay to the provided image
        `.trim();

        console.log(`🎨 Gerando imagem com referência...`);
        media = await project.generateImageWithReferences({
          prompt: textPrompt,
          aspectRatio: aspectRatio || "IMAGE_ASPECT_RATIO_LANDSCAPE",
        });

        // Limpar arquivo temporário
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch (uploadError) {
        console.error("❌ Erro ao processar upload:", uploadError);
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
        throw uploadError;
      }
    } else {
      if (!prompt || prompt.trim().length === 0) {
        return NextResponse.json(
          { error: "❌ Descrição é obrigatória" },
          { status: 400 }
        );
      }

      console.log(`🎨 Gerando imagem com IA...`);
      media = await project.generateImage({
        prompt: prompt,
        aspectRatio: aspectRatio || "IMAGE_ASPECT_RATIO_LANDSCAPE",
      });

      const refinementPrompt_default = refinementPrompt || `
Add professional text overlay at the bottom of the image with a semi-transparent dark background (rgba 0,0,0,0.85):

TITLE: "${title}"
- Font: Bold, Large (60-90px)
- Color: White (#FFFFFF)
- Position: Top of overlay area

PRICE: "${price}"
- Font: Bold, Extra Large (80-120px)
- Color: Gold (#FFD700)
- Position: Middle of overlay area

CALL TO ACTION: "${cta}"
- Font: Bold, Medium (35-50px)
- Color: White (#FFFFFF)
- Position: Bottom of overlay area

REQUIREMENTS:
- Add black outline/stroke around all text for better visibility
- Ensure text is centered horizontally
- Use professional typography
- Keep the dark overlay semi-transparent
- Use high contrast for maximum legibility
      `.trim();

      console.log(`🎨 Refinando imagem com texto...`);
      media = await media.refine(refinementPrompt_default);
    }

    // 🔧 NOVO: Salvar em memória e fazer upload para Supabase
    const tempDir = "/tmp";
    const savedFilePath = media.save(tempDir);
    console.log(`✅ Arquivo salvo em: ${savedFilePath}`);

    // Ler arquivo
    const fileBuffer = fs.readFileSync(savedFilePath);
    const filename = path.basename(savedFilePath);

    // 🔧 Upload para Supabase Storage
    console.log(`📤 Fazendo upload para Supabase Storage...`);
    const { data, error } = await supabase.storage
      .from("imagens")
      .upload(filename, fileBuffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (error) {
      console.error("❌ Erro ao fazer upload para Supabase:", error);
      throw error;
    }

    // Obter URL pública
    const { data: publicUrlData } = supabase.storage
      .from("imagens")
      .getPublicUrl(filename);

    // Limpar arquivo temporário
    if (fs.existsSync(savedFilePath)) {
      fs.unlinkSync(savedFilePath);
    }

    console.log(`✅ Imagem salva em Supabase`);

    return NextResponse.json({
      success: true,
      message: isUploadedImage 
        ? "✅ Imagem refinada com sucesso!" 
        : "✅ Imagem gerada e refinada com sucesso!",
      imageUrl: publicUrlData.publicUrl,
      filename: filename,
      aspectRatio: aspectRatio || "LANDSCAPE",
    });
  } catch (error) {
    console.error("❌ Erro ao processar imagem:", error);

    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";

    return NextResponse.json(
      {
        error: `❌ Erro: ${errorMessage}`,
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}