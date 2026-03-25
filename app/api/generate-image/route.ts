import { Whisk } from "@rohitaryal/whisk-api";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

// Inicializar Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 🔧 Valores padrão para estilos
const DEFAULT_OVERLAY_STYLE = {
  backgroundColor: "#000000",
  opacity: 0.85,
  height: 35,
};

const DEFAULT_TEXT_STYLE = {
  color: "#FFFFFF",
  fontSize: 60,
  fontWeight: "bold",
  shadowColor: "#000000",
  shadowBlur: 3,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
};

const DEFAULT_PRICE_STYLE = {
  color: "#FFD700",
  fontSize: 90,
  fontWeight: "bold",
  shadowColor: "#000000",
  shadowBlur: 3,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
};

const DEFAULT_CTA_STYLE = {
  color: "#FFFFFF",
  fontSize: 40,
  fontWeight: "bold",
  shadowColor: "#000000",
  shadowBlur: 3,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
};

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
  // 🔧 Usar valores padrão se não forem fornecidos
  const tStyle = titleStyle || DEFAULT_TEXT_STYLE;
  const pStyle = priceStyle || DEFAULT_PRICE_STYLE;
  const cStyle = ctaStyle || DEFAULT_CTA_STYLE;
  const oStyle = overlayStyle || DEFAULT_OVERLAY_STYLE;

  return `
Add professional text overlay at the bottom of the image with a semi-transparent dark background:

OVERLAY SETTINGS:
- Background Color: ${oStyle.backgroundColor}
- Opacity: ${oStyle.opacity}
- Height: ${oStyle.height}% of image

TITLE: "${title}"
- Font: ${tStyle.fontWeight}, ${tStyle.fontSize}px
- Color: ${tStyle.color}
- Shadow: blur ${tStyle.shadowBlur}px, offset (${tStyle.shadowOffsetX}, ${tStyle.shadowOffsetY})
- Shadow Color: ${tStyle.shadowColor}
- Position: Top of overlay area
- Style: Professional, clean sans-serif

PRICE: "${price}"
- Font: ${pStyle.fontWeight}, ${pStyle.fontSize}px
- Color: ${pStyle.color}
- Shadow: blur ${pStyle.shadowBlur}px, offset (${pStyle.shadowOffsetX}, ${pStyle.shadowOffsetY})
- Shadow Color: ${pStyle.shadowColor}
- Position: Middle of overlay area
- Style: Professional, prominent

CALL TO ACTION: "${cta}"
- Font: ${cStyle.fontWeight}, ${cStyle.fontSize}px
- Color: ${cStyle.color}
- Shadow: blur ${cStyle.shadowBlur}px, offset (${cStyle.shadowOffsetX}, ${cStyle.shadowOffsetY})
- Shadow Color: ${cStyle.shadowColor}
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

    // 🔧 Construir prompt de refinamento com as configurações (com valores padrão)
    const refinementPrompt = buildRefinementPrompt(
      title,
      price,
      cta,
      titleStyle || DEFAULT_TEXT_STYLE,
      priceStyle || DEFAULT_PRICE_STYLE,
      ctaStyle || DEFAULT_CTA_STYLE,
      overlayStyle || DEFAULT_OVERLAY_STYLE
    );

    if (uploadedImage) {
      console.log(`📤 Usando imagem enviada pelo usuário`);
      isUploadedImage = true;

      try {
        const buffer = base64ToBuffer(uploadedImage);
        console.log(`📦 Tamanho original: ${buffer.length} bytes`);

        const compressedBuffer = await compressImage(buffer);

        console.log(`📤 Fazendo upload da imagem como Subject...`);
        const uploadedRef = await project.addSubject({ file: uploadedImage });
        console.log(`✅ Imagem enviada com sucesso`);

        console.log(`🎨 Gerando imagem com referência...`);
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

      console.log(`🎨 Refinando imagem com texto...`);
      media = await media.refine(refinementPrompt);
    }

    console.log(`📦 Extraindo imagem em memória...`);
    const encodedImage = media.encodedMedia;
    if (!encodedImage) {
      throw new Error("❌ Não foi possível obter a imagem do Whisk");
    }

    const imageBuffer = base64ToBuffer(encodedImage);
    console.log(`✅ Imagem extraída: ${imageBuffer.length} bytes`);

    const compressedBuffer = await compressImage(imageBuffer);
    const filename = `img_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

    const publicUrl = await uploadToSupabase(compressedBuffer, filename);

    console.log(`✅ Processamento concluído com sucesso`);

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

    const errorResponse = {
      success: false,
      error: `❌ Erro: ${errorMessage}`,
      details: errorDetails,
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
