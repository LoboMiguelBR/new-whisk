import { Whisk } from "@rohitaryal/whisk-api";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const imagesDir = path.join(process.cwd(), "public", "imagens");

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, aspectRatio, title, price, cta, uploadedImage } = await request.json();

    const cookie = process.env.WHISK_COOKIE;

    if (!cookie) {
      return NextResponse.json(
        { error: "❌ Cookie do Whisk não configurado" },
        { status: 400 }
      );
    }

    console.log(`🎨 Processando imagem...`);
    console.log(`📐 Aspect Ratio: ${aspectRatio}`);

    const whisk = new Whisk(cookie);
    const project = await whisk.newProject("Gerador Imagens");

    let media;
    let isUploadedImage = false;

    if (uploadedImage) {
      // 🔧 CORRIGIDO: Usar a imagem enviada DIRETAMENTE
      console.log(`📤 Usando imagem enviada pelo usuário`);
      isUploadedImage = true;

      // Converter base64 para buffer
      const base64Data = uploadedImage.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      // Salvar temporariamente
      const tempPath = path.join(imagesDir, `temp-${Date.now()}.png`);
      fs.writeFileSync(tempPath, buffer);

      try {
        // 🔧 IMPORTANTE: Fazer upload como Subject para manter a imagem original
        console.log(`📤 Fazendo upload da imagem como Subject...`);
        const uploadedRef = await project.addSubject({ file: tempPath });
        console.log(`✅ Imagem enviada com sucesso`);
        console.log(`📝 Prompt detectado: ${uploadedRef.prompt}`);

        // 🔧 AGORA: Usar generateImageWithReferences com aspectRatio correto
        const textPrompt = `
Add professional text overlay at the bottom of the image with a semi-transparent dark background (rgba 0,0,0,0.85):

TITLE: "${title}"
- Font: Bold, Large (60-90px)
- Color: White (#FFFFFF)
- Position: Top of overlay area
- Style: Professional, clean sans-serif

PRICE: "${price}"
- Font: Bold, Extra Large (80-120px)
- Color: Gold (#FFD700)
- Position: Middle of overlay area
- Style: Professional, prominent

CALL TO ACTION: "${cta}"
- Font: Bold, Medium (35-50px)
- Color: White (#FFFFFF)
- Position: Bottom of overlay area
- Style: Professional, clean sans-serif

REQUIREMENTS:
- Add black outline/stroke around all text for better visibility and contrast
- Ensure text is centered horizontally
- Use professional typography
- Maintain proper spacing between text elements
- Make sure text is clearly readable and stands out
- Keep the dark overlay semi-transparent to show the image behind
- Use high contrast for maximum legibility
- DO NOT modify or change the original image content
- DO NOT generate a new image
- ONLY add text overlay to the provided image
        `.trim();

        console.log(`🎨 Gerando imagem com referência (mantendo original)...`);
        console.log(`📐 Aspect Ratio a usar: ${aspectRatio || "IMAGE_ASPECT_RATIO_LANDSCAPE"}`);
        
        // 🔧 CORRIGIDO: Passar aspectRatio como objeto de configuração
        media = await project.generateImageWithReferences({
          prompt: textPrompt,
          aspectRatio: aspectRatio || "IMAGE_ASPECT_RATIO_LANDSCAPE",
        });
        
        console.log(`✅ Imagem processada com sucesso`);

        // Limpar arquivo temporário
        fs.unlinkSync(tempPath);
      } catch (uploadError) {
        console.error("❌ Erro ao processar upload:", uploadError);
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
        throw uploadError;
      }
    } else {
      // Se não, gerar nova imagem
      if (!prompt || prompt.trim().length === 0) {
        return NextResponse.json(
          { error: "❌ Descrição é obrigatória" },
          { status: 400 }
        );
      }

      console.log(`🎨 Gerando imagem com IA...`);
      console.log(`📐 Aspect Ratio: ${aspectRatio || "IMAGE_ASPECT_RATIO_LANDSCAPE"}`);
      
      media = await project.generateImage({
        prompt: prompt,
        aspectRatio: aspectRatio || "IMAGE_ASPECT_RATIO_LANDSCAPE",
      });
      console.log(`✅ Imagem gerada pela API`);

      // Refinamento para imagens geradas
      const refinementPrompt = `
Add professional text overlay at the bottom of the image with a semi-transparent dark background (rgba 0,0,0,0.85):

TITLE: "${title}"
- Font: Bold, Large (60-90px)
- Color: White (#FFFFFF)
- Position: Top of overlay area
- Style: Professional, clean sans-serif

PRICE: "${price}"
- Font: Bold, Extra Large (80-120px)
- Color: Gold (#FFD700)
- Position: Middle of overlay area
- Style: Professional, prominent

CALL TO ACTION: "${cta}"
- Font: Bold, Medium (35-50px)
- Color: White (#FFFFFF)
- Position: Bottom of overlay area
- Style: Professional, clean sans-serif

REQUIREMENTS:
- Add black outline/stroke around all text for better visibility and contrast
- Ensure text is centered horizontally
- Use professional typography
- Maintain proper spacing between text elements
- Make sure text is clearly readable and stands out
- Keep the dark overlay semi-transparent to show the image behind
- Use high contrast for maximum legibility
      `.trim();

      console.log(`🎨 Refinando imagem com texto...`);
      media = await media.refine(refinementPrompt);
      console.log(`✅ Imagem refinada com sucesso`);
    }

    // Salvar a imagem final
    const savedFilePath = media.save(imagesDir);
    console.log(`✅ Arquivo salvo em: ${savedFilePath}`);

    // Converter para base64
    const fileBuffer = fs.readFileSync(savedFilePath);
    const base64Image = fileBuffer.toString("base64");
    const dataUrl = `data:image/png;base64,${base64Image}`;

    const stats = fs.statSync(savedFilePath);
    const filename = path.basename(savedFilePath);

    console.log(`✅ Imagem convertida para base64`);

    return NextResponse.json({
      success: true,
      message: isUploadedImage 
        ? "✅ Imagem refinada com sucesso!" 
        : "✅ Imagem gerada e refinada com sucesso!",
      imageUrl: dataUrl,
      publicUrl: `/imagens/${filename}`,
      filename: filename,
      fileSize: stats.size,
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