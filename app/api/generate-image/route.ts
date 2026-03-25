// Usar Service Role Key para upload
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // 🔧 Usar Service Role Key
);

// Depois, na função uploadToSupabase:
async function uploadToSupabase(
  fileBuffer: Buffer,
  filename: string
): Promise<string> {
  try {
    console.log(`📤 Fazendo upload para Supabase Storage...`);

    const { data, error } = await supabaseAdmin.storage // 🔧 Usar supabaseAdmin
      .from("imagens")
      .upload(filename, fileBuffer, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (error) {
      console.error("❌ Erro ao fazer upload para Supabase:", error);
      throw new Error(`Supabase upload error: ${error.message}`);
    }

    const { data: publicUrlData } = supabaseAdmin.storage // 🔧 Usar supabaseAdmin
      .from("imagens")
      .getPublicUrl(filename);

    console.log(`✅ Imagem salva em Supabase: ${publicUrlData.publicUrl}`);
    return publicUrlData.publicUrl;
  } catch (error) {
    console.error("❌ Erro no upload Supabase:", error);
    throw error;
  }
}
