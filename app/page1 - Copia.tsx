"use client";

import { useState, useRef } from "react";

export default function Home() {
  const [title, setTitle] = useState("CASA À VENDA");
  const [price, setPrice] = useState("R$ 280.000,00");
  const [cta, setCta] = useState("Interessou? Chamar no WhatsApp");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("IMAGE_ASPECT_RATIO_PORTRAIT");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [useUpload, setUseUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setUploadedImage(base64);
        setUseUpload(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    setFinalImage(null);

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: useUpload ? "" : prompt,
          aspectRatio,
          title,
          price,
          cta,
          uploadedImage: useUpload ? uploadedImage : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro desconhecido na API.");
      }

      setMessage(data.message);
      setFinalImage(data.imageUrl);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 p-8">
      <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-2xl p-8 space-y-8">
        <div className="text-center">
          <h1 className="text-5xl font-extrabold text-gray-800 mb-2">🎨 Gerador Whisk Pro</h1>
          <p className="text-gray-600 text-lg">Crie imagens com IA ou melhore suas próprias imagens</p>
        </div>

        {/* Abas: Gerar vs Upload */}
        <div className="flex gap-4 border-b-2 border-gray-300">
          <button
            onClick={() => setUseUpload(false)}
            className={`px-6 py-3 font-bold text-lg transition-all ${
              !useUpload
                ? "border-b-4 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            ✨ Gerar Imagem
          </button>
          <button
            onClick={() => setUseUpload(true)}
            className={`px-6 py-3 font-bold text-lg transition-all ${
              useUpload
                ? "border-b-4 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            📤 Usar Minha Imagem
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Coluna Esquerda: Personalização de Textos */}
          <div className="space-y-6 bg-gray-50 p-6 rounded-xl">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">📝 Personalize os Textos</h2>

            <div>
              <label className="block text-gray-700 font-semibold mb-2">Título:</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: CASA À VENDA"
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2">Preço:</label>
              <input
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Ex: R$ 280.000,00"
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2">Call to Action:</label>
              <input
                type="text"
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                placeholder="Ex: Interessou? Chamar no WhatsApp"
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Coluna Direita: Geração ou Upload */}
          <div className="space-y-6 bg-gray-50 p-6 rounded-xl">
            {!useUpload ? (
              <>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">🖼️ Gere a Imagem</h2>

                <div>
                  <label className="block text-gray-700 font-semibold mb-3">Proporção:</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setAspectRatio("IMAGE_ASPECT_RATIO_PORTRAIT")}
                      className={`p-3 rounded-lg font-bold text-sm ${
                        aspectRatio === "IMAGE_ASPECT_RATIO_PORTRAIT"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200"
                      }`}
                      disabled={loading}
                    >
                      📱 9:16
                    </button>
                    <button
                      onClick={() => setAspectRatio("IMAGE_ASPECT_RATIO_SQUARE")}
                      className={`p-3 rounded-lg font-bold text-sm ${
                        aspectRatio === "IMAGE_ASPECT_RATIO_SQUARE"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200"
                      }`}
                      disabled={loading}
                    >
                      ⬜ 1:1
                    </button>
                    <button
                      onClick={() => setAspectRatio("IMAGE_ASPECT_RATIO_LANDSCAPE")}
                      className={`p-3 rounded-lg font-bold text-sm ${
                        aspectRatio === "IMAGE_ASPECT_RATIO_LANDSCAPE"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200"
                      }`}
                      disabled={loading}
                    >
                      🖼️ 16:9
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Descreva a imagem:</label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ex: Uma casa moderna à venda, vista externa, dia ensolarado..."
                    className="w-full p-3 border-2 border-gray-300 rounded-lg resize-none"
                    rows={5}
                    disabled={loading}
                  />
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">📤 Envie Sua Imagem</h2>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  {uploadedImage ? (
                    <div className="space-y-4">
                      <img
                        src={uploadedImage}
                        alt="Preview"
                        className="max-w-full h-auto rounded-lg"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"
                      >
                        Trocar Imagem
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="cursor-pointer space-y-2"
                    >
                      <p className="text-4xl">📸</p>
                      <p className="text-gray-700 font-semibold">Clique para enviar uma imagem</p>
                      <p className="text-gray-500 text-sm">ou arraste e solte aqui</p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-3">Proporção:</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setAspectRatio("IMAGE_ASPECT_RATIO_PORTRAIT")}
                      className={`p-3 rounded-lg font-bold text-sm ${
                        aspectRatio === "IMAGE_ASPECT_RATIO_PORTRAIT"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200"
                      }`}
                      disabled={loading}
                    >
                      📱 9:16
                    </button>
                    <button
                      onClick={() => setAspectRatio("IMAGE_ASPECT_RATIO_SQUARE")}
                      className={`p-3 rounded-lg font-bold text-sm ${
                        aspectRatio === "IMAGE_ASPECT_RATIO_SQUARE"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200"
                      }`}
                      disabled={loading}
                    >
                      ⬜ 1:1
                    </button>
                    <button
                      onClick={() => setAspectRatio("IMAGE_ASPECT_RATIO_LANDSCAPE")}
                      className={`p-3 rounded-lg font-bold text-sm ${
                        aspectRatio === "IMAGE_ASPECT_RATIO_LANDSCAPE"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200"
                      }`}
                      disabled={loading}
                    >
                      🖼️ 16:9
                    </button>
                  </div>
                </div>
              </>
            )}

            <button
              onClick={handleGenerate}
              disabled={loading || (!useUpload && !prompt.trim()) || (useUpload && !uploadedImage)}
              className={`w-full font-bold py-3 px-6 rounded-xl text-white text-lg ${
                loading || (!useUpload && !prompt.trim()) || (useUpload && !uploadedImage)
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {loading ? "⏳ Processando..." : "✨ Gerar Imagem com Texto"}
            </button>
          </div>
        </div>

        {message && (
          <div className="p-4 bg-green-100 border-l-4 border-green-500 text-green-700 rounded-lg">
            {message}
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {finalImage && (
          <div className="mt-10 text-center space-y-6 bg-gray-50 p-6 rounded-xl">
            <h2 className="text-3xl font-bold text-gray-800">🎉 Sua Imagem Profissional:</h2>
            <img
              src={finalImage}
              alt="Imagem gerada"
              className="max-w-full h-auto rounded-lg shadow-xl"
            />
            <a
              href={finalImage}
              download="imagem-profissional-whisk.png"
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl"
            >
              ⬇️ Baixar Imagem
            </a>
          </div>
        )}
      </div>
    </main>
  );
}