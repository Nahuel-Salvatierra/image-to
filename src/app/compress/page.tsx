"use client";

import { useState, useRef, DragEvent, ClipboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import JSZip from "jszip";

interface ImageFile {
  file: File;
  id: string;
  status: "pending" | "compressing" | "completed" | "error";
  compressedUrl?: string;
  error?: string;
  originalSize?: number;
  compressedSize?: number;
}

export default function CompressPage() {
  const [imageFiles, setImageFiles] = useState<ImageFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [quality, setQuality] = useState(0.7);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (files: File[]) => {
    const validFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/")
    );

    if (validFiles.length === 0) return;

    const newImageFiles: ImageFile[] = validFiles.map((file) => ({
      file,
      id: `${Date.now()}-${Math.random()}`,
      status: "pending",
      originalSize: file.size,
    }));

    setImageFiles((prev) => [...prev, ...newImageFiles]);
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

    const files = Array.from(e.dataTransfer.files);
    handleImageSelect(files);
  };

  const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData.items;
    const files: File[] = [];

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      handleImageSelect(files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      handleImageSelect(Array.from(files));
    }
  };

  const compressImage = async (
    file: File,
    qualityPercent: number
  ): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);

        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo obtener el contexto del canvas"));
          return;
        }

        ctx.imageSmoothingEnabled = qualityPercent > 0.5;
        ctx.imageSmoothingQuality =
          qualityPercent > 0.7
            ? "high"
            : qualityPercent > 0.4
            ? "medium"
            : "low";
        ctx.drawImage(img, 0, 0);

        const originalType = file.type.toLowerCase();
        let outputMimeType = "image/jpeg";
        let outputQuality = qualityPercent;

        if (originalType === "image/png") {
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = img.width;
          tempCanvas.height = img.height;
          const tempCtx = tempCanvas.getContext("2d");
          if (tempCtx) {
            tempCtx.drawImage(img, 0, 0);
            const imageData = tempCtx.getImageData(
              0,
              0,
              tempCanvas.width,
              tempCanvas.height
            );
            const hasTransparency = imageData.data.some(
              (_, i) => i % 4 === 3 && imageData.data[i] < 255
            );

            if (hasTransparency) {
              outputMimeType = "image/png";
              outputQuality = Math.max(0.1, qualityPercent * 0.9);
            } else {
              outputMimeType = "image/jpeg";
            }
          }
        } else if (originalType === "image/webp") {
          outputMimeType = "image/webp";
        } else if (
          originalType.includes("jpeg") ||
          originalType.includes("jpg")
        ) {
          outputMimeType = "image/jpeg";
        }

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Error al crear el blob"));
            }
          },
          outputMimeType,
          outputQuality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Error al cargar la imagen"));
      };

      img.src = url;
    });
  };

  const compressSingleImage = async (imageFile: ImageFile) => {
    setImageFiles((prev) =>
      prev.map((img) =>
        img.id === imageFile.id ? { ...img, status: "compressing" } : img
      )
    );

    try {
      const blob = await compressImage(imageFile.file, quality);
      const url = URL.createObjectURL(blob);

      setImageFiles((prev) =>
        prev.map((img) =>
          img.id === imageFile.id
            ? {
                ...img,
                status: "completed",
                compressedUrl: url,
                compressedSize: blob.size,
              }
            : img
        )
      );
    } catch (err) {
      setImageFiles((prev) =>
        prev.map((img) =>
          img.id === imageFile.id
            ? { ...img, status: "error", error: "Error al comprimir" }
            : img
        )
      );
      console.error(err);
    }
  };

  const handleCompressAll = async () => {
    const pendingImages = imageFiles.filter((img) => img.status === "pending");

    if (pendingImages.length === 0) return;

    setIsCompressing(true);

    for (const imageFile of pendingImages) {
      await compressSingleImage(imageFile);
    }

    setIsCompressing(false);
  };

  const handleDownloadAll = async () => {
    const completedImages = imageFiles.filter(
      (img) => img.status === "completed" && img.compressedUrl
    );

    if (completedImages.length === 0) return;

    const zip = new JSZip();

    for (const imageFile of completedImages) {
      if (!imageFile.compressedUrl) continue;

      try {
        const response = await fetch(imageFile.compressedUrl);
        const blob = await response.blob();
        const originalName = imageFile.file.name
          .split(".")
          .slice(0, -1)
          .join(".");
        const ext = imageFile.file.name.split(".").pop();
        const fileName = `${originalName}_compressed.${ext}`;
        zip.file(fileName, blob);
      } catch (error) {
        console.error(`Error al procesar ${imageFile.file.name}:`, error);
      }
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `imagenes_comprimidas_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownload = (imageFile: ImageFile) => {
    if (!imageFile.compressedUrl) return;

    const a = document.createElement("a");
    a.href = imageFile.compressedUrl;
    const originalName = imageFile.file.name.split(".").slice(0, -1).join(".");
    const ext = imageFile.file.name.split(".").pop();
    a.download = `${originalName}_compressed.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleRemove = (id: string) => {
    setImageFiles((prev) => {
      const file = prev.find((img) => img.id === id);
      if (file?.compressedUrl) {
        URL.revokeObjectURL(file.compressedUrl);
      }
      return prev.filter((img) => img.id !== id);
    });
  };

  const handleClear = () => {
    imageFiles.forEach((file) => {
      if (file.compressedUrl) {
        URL.revokeObjectURL(file.compressedUrl);
      }
    });
    setImageFiles([]);
  };

  const pendingCount = imageFiles.filter(
    (img) => img.status === "pending"
  ).length;

  const completedCount = imageFiles.filter(
    (img) => img.status === "completed"
  ).length;

  const totalOriginalSize = imageFiles.reduce(
    (sum, img) => sum + (img.originalSize || 0),
    0
  );

  const totalCompressedSize = imageFiles.reduce(
    (sum, img) => sum + (img.compressedSize || 0),
    0
  );

  const compressionRatio =
    totalOriginalSize > 0
      ? ((1 - totalCompressedSize / totalOriginalSize) * 100).toFixed(1)
      : "0";

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
          Compresor de Imágenes
        </h1>
        <p className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm mb-2">
          Reduce el peso de tus imágenes
        </p>
        <div className="flex gap-2 justify-center">
          <Link
            href="/"
            className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
          >
            Convertir
          </Link>
          <Link
            href="/resize"
            className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
          >
            Redimensionar
          </Link>
          <Link
            href="/collage"
            className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
          >
            Collage
          </Link>
          <span className="px-3 py-1 text-xs bg-purple-200 dark:bg-purple-800 rounded">
            Comprimir
          </span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex-1 max-w-7xl mx-auto w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl p-3 sm:p-4 flex flex-col gap-3 overflow-hidden"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Calidad: {Math.round(quality * 100)}%
            </label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={quality}
              onChange={(e) => setQuality(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>Baja</span>
              <span>Alta</span>
            </div>
          </div>
          <div className="flex items-end">
            <div className="w-full">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Estadísticas
              </p>
              {completedCount > 0 && (
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Reducción: {compressionRatio}%
                  <br />
                  {imageFiles.length} imagen
                  {imageFiles.length !== 1 ? "es" : ""}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-end">
            <div className="w-full">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Tamaños
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Original: {(totalOriginalSize / 1024).toFixed(1)} KB
                {totalCompressedSize > 0 && (
                  <>
                    <br />
                    Comprimido: {(totalCompressedSize / 1024).toFixed(1)} KB
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-lg p-4 sm:p-6 text-center cursor-pointer
            transition-all duration-300 ease-in-out
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
            multiple
            onChange={handleFileInputChange}
            className="hidden"
          />

          <svg
            className="w-10 h-10 sm:w-12 sm:h-12 text-purple-400 mb-2 mx-auto"
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
            Arrastra imágenes aquí
          </p>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            o clic para seleccionar / Ctrl+V
          </p>
        </div>

        {imageFiles.length > 0 && (
          <>
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                {imageFiles.length} imagen{imageFiles.length !== 1 ? "es" : ""}
              </span>
              <div className="flex gap-2">
                {pendingCount > 0 && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCompressAll}
                    disabled={isCompressing}
                    className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold text-xs sm:text-sm rounded-lg shadow-lg transition-all duration-200 disabled:opacity-50"
                  >
                    {isCompressing
                      ? "Comprimiendo..."
                      : `Comprimir todas (${pendingCount})`}
                  </motion.button>
                )}
                {completedCount > 0 && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleDownloadAll}
                    className="px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold text-xs sm:text-sm rounded-lg shadow-lg transition-all duration-200"
                  >
                    Descargar ZIP ({completedCount})
                  </motion.button>
                )}
                <button
                  onClick={handleClear}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white font-semibold text-xs sm:text-sm rounded-lg transition-all duration-200"
                >
                  Limpiar
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <AnimatePresence>
                {imageFiles.map((imageFile) => (
                  <motion.div
                    key={imageFile.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2 sm:p-3"
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="flex-shrink-0">
                        {imageFile.status === "pending" && (
                          <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                            <span className="text-xs">⏳</span>
                          </div>
                        )}
                        {imageFile.status === "compressing" && (
                          <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                            <svg
                              className="animate-spin h-4 w-4 text-white"
                              viewBox="0 0 24 24"
                            >
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
                          </div>
                        )}
                        {imageFile.status === "completed" && (
                          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                            <span className="text-white text-xs">✓</span>
                          </div>
                        )}
                        {imageFile.status === "error" && (
                          <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
                            <span className="text-white text-xs">✗</span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                          {imageFile.file.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Original:{" "}
                          {((imageFile.originalSize || 0) / 1024).toFixed(1)} KB
                          {imageFile.compressedSize && (
                            <>
                              {" • "}
                              Comprimido:{" "}
                              {(imageFile.compressedSize / 1024).toFixed(1)} KB
                              {" • "}
                              {imageFile.originalSize &&
                                imageFile.compressedSize &&
                                (
                                  (1 -
                                    imageFile.compressedSize /
                                      imageFile.originalSize) *
                                  100
                                ).toFixed(1)}
                              % menos
                            </>
                          )}
                        </p>
                      </div>

                      <div className="flex gap-1 flex-shrink-0">
                        {imageFile.status === "pending" && (
                          <button
                            onClick={() => compressSingleImage(imageFile)}
                            className="px-2 py-1 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded transition-all duration-200"
                          >
                            Comprimir
                          </button>
                        )}
                        {imageFile.status === "completed" && (
                          <button
                            onClick={() => handleDownload(imageFile)}
                            className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded transition-all duration-200"
                          >
                            Descargar
                          </button>
                        )}
                        <button
                          onClick={() => handleRemove(imageFile.id)}
                          className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded transition-all duration-200"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
