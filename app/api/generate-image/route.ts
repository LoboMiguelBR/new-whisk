import { Whisk } from "@rohitaryal/whisk-api";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

// Inicializar Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Função para comprimir imagem
async function compressImage(buffer: Buffer): Promise<Buffer> {
  try {
    console.log(`📦 Comprimindo imagem...`);
    const compressedBuffer = await sharp(buffer)
      .resize(1920, 1080, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80, progressive: true })
      .toBuffer();

    console.log(`✅ Imagem comprimida: ${buffer.length} → ${compressedBuffer.length} bytes`);
    return compressedBuffer;
  } catch (error) {
    console.error("❌ Erro ao comprimir imagem:", error);
    return buffer;
  }
}

// Função para validar JSON
function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

// Função para fazer upload no Supabase
async function uploadToSupabase(
  fileBuffer: Buffer,
  filename: string
): Promise<string> {
  try {
    console.log(`📤 Fazendo upload para Supabase Storage...`);

    const { data, error } = await supabase.storage
      .from("imagens")
      .upload(filename, fileBuffer, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (error) {
      console.error("❌ Erro ao fazer upload para Supabase:", error);
      throw new Error(`Supabase upload error: ${error.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from("imagens")
      .getPublicUrl(filename);

    console.log(`✅ Imagem salva em Supabase: ${publicUrlData.publicUrl}`);
    return publicUrlData.publicUrl;
  } catch (error) {
    console.error("❌ Erro no upload Supabase:", error);
    throw error;
  }
}

// Função para construir o prompt de refinamento com as configurações
function buildRefinementPrompt(
  title: string,
  price: string,
  cta: string,
  titleStyle: any,
  priceStyle: any,
  ctaStyle: any,
  overlayStyle: any
): string {
  return `
Add professional text overlay at the bottom of the image with a semi-transparent dark background:

OVERLAY SETTINGS:
- Background Color: ${overlayStyle.backgroundColor}
- Opacity: ${overlayStyle.opacity}
- Height: ${overlayStyle.height}% of image

TITLE: "${title}"
- Font: ${titleStyle.fontWeight}, ${titleStyle.fontSize}px
- Color: ${titleStyle.color}
- Shadow: blur ${titleStyle.shadowBlur}px, offset (${titleStyle.shadowOffsetX}, ${titleStyle.shadowOffsetY})
- Shadow Color: ${titleStyle.shadowColor}
- Position: Top of overlay area
- Style: Professional, clean sans-serif

PRICE: "${price}"
- Font: ${priceStyle.fontWeight}, ${priceStyle.fontSize}px
- Color: ${priceStyle.color}
- Shadow: blur ${priceStyle.shadowBlur}px, offset (${priceStyle.shadowOffsetX}, ${priceStyle.shadowOffsetY})
- Shadow Color: ${priceStyle.shadowColor}
- Position: Middle of overlay area
- Style: Professional, prominent

CALL TO ACTION: "${cta}"
- Font: ${ctaStyle.fontWeight}, ${ctaStyle.fontSize}px
- Color: ${ctaStyle.color}
- Shadow: blur ${ctaStyle.shadowBlur}px, offset (${ctaStyle.shadowOffsetX}, ${ctaStyle.shadowOffsetY})
- Shadow Color: ${ctaStyle.shadowColor}
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
}

// 🔧 Função para converter base64 para Buffer
function base64ToBuffer(base64String: string): Buffer {
  // Remover o prefixo data:image/...;base64,
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(base64Data, "base64");
}

export async function POST(request: NextRequest) {
  try {
    // 🔧 Validar Content-Type
    const contentType = request.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return NextResponse.json(
        { error: "❌ Content-Type deve ser application/json" },
        { status: 400 }
      );
    }

    // 🔧 Ler e validar JSON
    let requestBody: any;
    try {
      const bodyText = await request.text();

      if (!isValidJSON(bodyText)) {
        return NextResponse.json(
          { error: "❌ JSON inválido na requisição" },
          { status: 400 }
        );
      }

      requestBody = JSON.parse(bodyText);
    } catch (parseError) {
      console.error("❌ Erro ao fazer parse do JSON:", parseError);
      return NextResponse.json(
        { error: "❌ Erro ao processar JSON da requisição" },
        { status: 400 }
      );
    }

    const {
      prompt,
      aspectRatio,
      title,
      price,
      cta,
      uploadedImage,
      titleStyle,
      priceStyle,
      ctaStyle,
      overlayStyle,
    } = requestBody;

    // 🔧 Validar variáveis de ambiente
    const cookie = process.env.WHISK_COOKIE;
    if (!cookie) {
      console.error("❌ WHISK_COOKIE não configurado");
      return NextResponse.json(
        { error: "❌ Cookie do Whisk não configurado no servidor" },
        { status: 500 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      console.error("❌ Credenciais Supabase não configuradas");
      return NextResponse.json(
        { error: "❌ Credenciais Supabase não configuradas no servidor" },
        { status: 500 }
      );
    }

    console.log(`🎨 Processando imagem...`);
    console.log(`📐 Aspect Ratio: ${aspectRatio}`);

    const whisk = new Whisk(cookie);
    const project = await whisk.newProject("Gerador Imagens");

    let media;
    let isUploadedImage = false;

    // 🔧 Construir prompt de refinamento com as configurações
    const refinementPrompt = buildRefinementPrompt(
      title,
      price,
      cta,
      titleStyle,
      priceStyle,
      ctaStyle,
      overlayStyle
    );

    if (uploadedImage) {
      console.log(`📤 Usando imagem enviada pelo usuário`);
      isUploadedImage = true;

      try {
        // 🔧 Converter base64 para buffer
        const buffer = base64ToBuffer(uploadedImage);
        console.log(`📦 Tamanho original: ${buffer.length} bytes`);

        // 🔧 Comprimir imagem
        const compressedBuffer = await compressImage(buffer);

        // 🔧 Converter buffer para base64 para o Whisk
        const base64Compressed = compressedBuffer.toString("base64");
        const dataUrl = `data:image/jpeg;base64,${base64Compressed}`;

        console.log(`📤 Fazendo upload da imagem como Subject...`);
        const uploadedRef = await project.addSubject({ file: uploadedImage });
        console.log(`✅ Imagem enviada com sucesso`);
        console.log(`📝 Prompt detectado: ${uploadedRef.prompt}`);

        console.log(`🎨 Gerando imagem com referência (mantendo original)...`);
        console.log(`📐 Aspect Ratio a usar: ${aspectRatio || "IMAGE_ASPECT_RATIO_LANDSCAPE"}`);

        media = await project.generateImageWithReferences({
          prompt: refinementPrompt,
          aspectRatio: aspectRatio || "IMAGE_ASPECT_RATIO_LANDSCAPE",
        });

        console.log(`✅ Imagem processada com sucesso`);
      } catch (uploadError) {
        console.error("❌ Erro ao processar upload:", uploadError);
        throw uploadError;
      }
    } else {
      // 🔧 Gerar nova imagem
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

      console.log(`🎨 Refinando imagem com texto...`);
      media = await media.refine(refinementPrompt);
      console.log(`✅ Imagem refinada com sucesso`);
    }

    // 🔧 NOVO: Usar media.encodedMedia ao invés de media.save()
    console.log(`📦 Extraindo imagem em memória...`);
    
    // 🔧 Obter a imagem como base64 do Whisk
    const encodedImage = media.encodedMedia;
    if (!encodedImage) {
      throw new Error("❌ Não foi possível obter a imagem do Whisk");
    }

    // 🔧 Converter base64 para buffer
    const imageBuffer = base64ToBuffer(encodedImage);
    console.log(`✅ Imagem extraída: ${imageBuffer.length} bytes`);

    // 🔧 Comprimir antes de fazer upload
    const compressedBuffer = await compressImage(imageBuffer);

    // 🔧 Gerar nome do arquivo
    const filename = `img_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

    // 🔧 Upload para Supabase Storage
    const publicUrl = await uploadToSupabase(compressedBuffer, filename);

    console.log(`✅ Processamento concluído com sucesso`);

    // 🔧 Retornar resposta JSON válida
    const response = {
      success: true,
      message: isUploadedImage
        ? "✅ Imagem refinada com sucesso!"
        : "✅ Imagem gerada e refinada com sucesso!",
      imageUrl: publicUrl,
      filename: filename,
      aspectRatio: aspectRatio || "LANDSCAPE",
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("❌ Erro ao processar imagem:", error);

    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    const errorDetails = error instanceof Error ? error.stack : "";

    // 🔧 Retornar erro JSON válido
    const errorResponse = {
      success: false,
      error: `❌ Erro: ${errorMessage}`,
      details: errorDetails,
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
