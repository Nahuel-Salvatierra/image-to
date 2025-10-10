"use client";

import { useState, useRef, DragEvent, ClipboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";

type ImageFormat = "webp" | "png" | "jpg";

export default function Home() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [selectedFormat, setSelectedFormat] = useState<ImageFormat>("webp");
  const [isConverting, setIsConverting] = useState(false);
  const [convertedImageUrl, setConvertedImageUrl] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Por favor, selecciona un archivo de imagen válido");
      return;
    }

    setError("");
    setSelectedImage(file);
    setConvertedImageUrl("");

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleImageSelect(file);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData.items;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          handleImageSelect(file);
        }
        break;
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageSelect(file);
    }
  };

  const handleConvert = async () => {
    if (!selectedImage) return;

    setIsConverting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("image", selectedImage);
      formData.append("format", selectedFormat);

      const response = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Error al convertir la imagen");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setConvertedImageUrl(url);
    } catch (err) {
      setError("Error al convertir la imagen. Por favor, intenta de nuevo.");
      console.error(err);
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownload = () => {
    if (!convertedImageUrl) return;

    const a = document.createElement("a");
    a.href = convertedImageUrl;
    a.download = `converted.${selectedFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleReset = () => {
    setSelectedImage(null);
    setPreviewUrl("");
    setConvertedImageUrl("");
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div
      className="h-screen flex flex-col bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-3 sm:p-4 overflow-hidden"
      onPaste={handlePaste}
      tabIndex={0}
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-2 sm:mb-3"
      >
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 dark:text-white mb-1">
          Convertidor de Imágenes
        </h1>
        <p className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm">
          PNG, JPG y WEBP
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex-1 max-w-7xl mx-auto w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl p-3 sm:p-4 flex flex-col lg:flex-row gap-3 overflow-hidden"
      >
        <div className="flex-1 flex flex-col gap-3 min-w-0 min-h-0">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !previewUrl && fileInputRef.current?.click()}
            className={`
              flex-1 border-2 border-dashed rounded-lg p-3 text-center cursor-pointer
              transition-all duration-300 ease-in-out flex items-center justify-center min-h-0
              ${
                isDragging
                  ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                  : "border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              className="hidden"
            />

            <AnimatePresence mode="wait">
              {!previewUrl ? (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center"
                >
                  <svg
                    className="w-12 h-12 sm:w-16 sm:h-16 text-purple-400 mb-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-200 mb-1">
                    Arrastra una imagen
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    clic o Ctrl+V
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex flex-col items-center w-full h-full justify-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-full max-w-full object-contain rounded-lg shadow-lg mb-2"
                  />
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-medium truncate max-w-full px-2 mb-1">
                    {selectedImage?.name}
                  </p>
                  <button
                    onClick={handleReset}
                    className="text-xs sm:text-sm text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-medium underline"
                  >
                    Eliminar
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-2 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-xs sm:text-sm"
            >
              {error}
            </motion.div>
          )}
        </div>

        <AnimatePresence>
          {selectedImage && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.3 }}
              className="lg:w-64 xl:w-80 flex flex-col gap-3"
            >
              <div className="flex-1 flex flex-col justify-center">
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  Formato
                </label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {(["webp", "png", "jpg"] as ImageFormat[]).map((format) => (
                    <button
                      key={format}
                      onClick={() => setSelectedFormat(format)}
                      className={`
                        py-2 px-2 rounded-lg font-semibold uppercase text-xs sm:text-sm
                        transition-all duration-200
                        ${
                          selectedFormat === format
                            ? "bg-purple-500 text-white shadow-lg"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                        }
                      `}
                    >
                      {format}
                    </button>
                  ))}
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleConvert}
                  disabled={isConverting}
                  className={`
                    w-full py-2.5 sm:py-3 rounded-lg font-bold text-sm
                    transition-all duration-200
                    ${
                      isConverting
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg"
                    }
                    text-white
                  `}
                >
                  {isConverting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span className="text-xs sm:text-sm">
                        Convirtiendo...
                      </span>
                    </span>
                  ) : (
                    "Convertir"
                  )}
                </motion.button>
              </div>

              <AnimatePresence>
                {convertedImageUrl && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-t lg:border-t-0 pt-3 lg:pt-0"
                  >
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                      Resultado
                    </label>
                    <div
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2 mb-2 flex items-center justify-center"
                      style={{ height: "120px" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={convertedImageUrl}
                        alt="Converted"
                        className="max-h-full max-w-full object-contain rounded-lg shadow-lg"
                      />
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleDownload}
                      className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold text-sm rounded-lg shadow-lg transition-all duration-200"
                    >
                      Descargar
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
