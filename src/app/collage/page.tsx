"use client";

import { useState, useRef, DragEvent, ClipboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface ImageFile {
  file: File;
  id: string;
  image?: HTMLImageElement;
}

export default function CollagePage() {
  const [imageFiles, setImageFiles] = useState<ImageFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [columns, setColumns] = useState(3);
  const [rows, setRows] = useState(3);
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "custom">("9:16");
  const [collages, setCollages] = useState<
    Array<{ url: string; index: number }>
  >([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalSlots = columns * rows;

  const handleImageSelect = async (files: File[]) => {
    const validFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/")
    );

    if (validFiles.length === 0) return;

    const loadImage = (file: File): Promise<ImageFile> => {
      return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve({
            file,
            id: `${Date.now()}-${Math.random()}`,
            image: img,
          });
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve({
            file,
            id: `${Date.now()}-${Math.random()}`,
          });
        };

        img.src = url;
      });
    };

    const newImageFiles = await Promise.all(validFiles.map(loadImage));

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

  const cropAndResizeImage = (
    img: HTMLImageElement,
    targetWidth: number,
    targetHeight: number
  ): HTMLCanvasElement => {
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;

    const imgAspect = img.width / img.height;
    const targetAspect = targetWidth / targetHeight;

    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = img.width;
    let sourceHeight = img.height;

    if (imgAspect > targetAspect) {
      sourceWidth = img.height * targetAspect;
      sourceX = (img.width - sourceWidth) / 2;
    } else {
      sourceHeight = img.width / targetAspect;
      sourceY = (img.height - sourceHeight) / 2;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      img,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      targetWidth,
      targetHeight
    );

    return canvas;
  };

  const generateCollage = async () => {
    if (imageFiles.length === 0) return;

    setIsGenerating(true);

    const validImages = imageFiles.filter((img) => img.image);

    if (validImages.length === 0) {
      setIsGenerating(false);
      return;
    }

    collages.forEach((collage) => {
      URL.revokeObjectURL(collage.url);
    });
    setCollages([]);

    const cellAspectRatio = aspectRatio === "9:16" ? 9 / 16 : 9 / 16;
    const maxCellWidth = 800;
    const cellWidth = maxCellWidth;
    const cellHeight = cellWidth / cellAspectRatio;

    const imagesPerCollage = totalSlots;
    const totalCollages = Math.ceil(validImages.length / imagesPerCollage);

    const generatedCollages: Array<{ url: string; index: number }> = [];

    for (let collageIndex = 0; collageIndex < totalCollages; collageIndex++) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) continue;

      canvas.width = cellWidth * columns;
      canvas.height = cellHeight * rows;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const startIndex = collageIndex * imagesPerCollage;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          const cellIndex = row * columns + col;
          const globalIndex = startIndex + cellIndex;
          const imageFile = validImages[globalIndex];

          const x = col * cellWidth;
          const y = row * cellHeight;

          if (imageFile?.image) {
            const croppedCanvas = cropAndResizeImage(
              imageFile.image,
              cellWidth,
              cellHeight
            );
            ctx.drawImage(croppedCanvas, x, y);
          }
        }
      }

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/png", 1.0);
      });

      if (blob) {
        const url = URL.createObjectURL(blob);
        generatedCollages.push({ url, index: collageIndex + 1 });
      }
    }

    setCollages(generatedCollages);
    setIsGenerating(false);
  };

  const handleDownload = (collageIndex?: number) => {
    if (collages.length === 0) return;

    if (collageIndex !== undefined) {
      const collage = collages[collageIndex];
      if (!collage) return;

      const a = document.createElement("a");
      a.href = collage.url;
      a.download = `collage_${columns}x${rows}_${
        collage.index
      }_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      collages.forEach((collage, index) => {
        setTimeout(() => {
          const a = document.createElement("a");
          a.href = collage.url;
          a.download = `collage_${columns}x${rows}_${
            collage.index
          }_${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }, index * 100);
      });
    }
  };

  const handleRemove = (id: string) => {
    setImageFiles((prev) => prev.filter((img) => img.id !== id));
  };

  const handleClear = () => {
    setImageFiles([]);
    collages.forEach((collage) => {
      URL.revokeObjectURL(collage.url);
    });
    setCollages([]);
  };

  const handleColumnsChange = (value: number) => {
    setColumns(value);
  };

  const handleRowsChange = (value: number) => {
    setRows(value);
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
          Creador de Collages
        </h1>
        <p className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm mb-2">
          Crea collages con grid personalizable
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
          <span className="px-3 py-1 text-xs bg-purple-200 dark:bg-purple-800 rounded">
            Collage
          </span>
          <Link
            href="/compress"
            className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
          >
            Comprimir
          </Link>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex-1 max-w-7xl mx-auto w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl p-3 sm:p-4 flex flex-col gap-3 overflow-hidden"
      >
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Columnas
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={columns}
              onChange={(e) =>
                handleColumnsChange(parseInt(e.target.value) || 1)
              }
              className="w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Filas
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={rows}
              onChange={(e) => handleRowsChange(parseInt(e.target.value) || 1)}
              className="w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Relación de aspecto
            </label>
            <select
              value={aspectRatio}
              onChange={(e) =>
                setAspectRatio(e.target.value as "9:16" | "custom")
              }
              className="w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="9:16">9:16 (Vertical)</option>
              <option value="custom" disabled>
                Personalizado (próximamente)
              </option>
            </select>
          </div>
          <div className="flex items-end">
            <div className="w-full">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Total de imágenes
              </p>
              <p className="text-sm font-bold text-purple-600 dark:text-purple-400">
                {totalSlots} {totalSlots === 1 ? "imagen" : "imágenes"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {imageFiles.length} cargada{imageFiles.length !== 1 ? "s" : ""}
                {imageFiles.length > 0 &&
                  ` • ${Math.ceil(imageFiles.length / totalSlots)} collage${
                    Math.ceil(imageFiles.length / totalSlots) !== 1 ? "s" : ""
                  }`}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 overflow-hidden">
          <div className="flex flex-col gap-3 overflow-hidden">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-lg p-4 sm:p-6 text-center cursor-pointer
                transition-all duration-300 ease-in-out flex-shrink-0
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
                <div className="flex justify-between items-center gap-2 flex-shrink-0">
                  <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                    {imageFiles.length} imagen
                    {imageFiles.length !== 1 ? "es" : ""} cargada
                    {imageFiles.length !== 1 ? "s" : ""}
                  </span>
                  <div className="flex gap-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={generateCollage}
                      disabled={isGenerating}
                      className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold text-xs sm:text-sm rounded-lg shadow-lg transition-all duration-200 disabled:opacity-50"
                    >
                      {isGenerating ? "Generando..." : "Generar Collage"}
                    </motion.button>
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
                    {imageFiles.map((imageFile, index) => (
                      <motion.div
                        key={imageFile.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2 sm:p-3"
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                              <span className="text-white text-xs font-bold">
                                {index + 1}
                              </span>
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                              {imageFile.file.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {(imageFile.file.size / 1024).toFixed(1)} KB
                              {imageFile.image &&
                                ` • ${imageFile.image.width}×${imageFile.image.height}`}
                            </p>
                          </div>

                          <button
                            onClick={() => handleRemove(imageFile.id)}
                            className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded transition-all duration-200 flex-shrink-0"
                          >
                            ✕
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-3 overflow-hidden">
            <div className="flex-shrink-0 flex justify-between items-center">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Collages generados ({collages.length})
              </h2>
              {collages.length > 0 && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleDownload()}
                  className="px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold text-xs sm:text-sm rounded-lg shadow-lg transition-all duration-200"
                >
                  Descargar todos
                </motion.button>
              )}
            </div>

            <div className="flex-1 bg-gray-100 dark:bg-gray-900 rounded-lg overflow-auto p-4">
              {collages.length > 0 ? (
                <div className="space-y-4">
                  {collages.map((collage, index) => (
                    <div
                      key={index}
                      className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-md"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Collage {collage.index}
                        </h3>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleDownload(index)}
                          className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded transition-all duration-200"
                        >
                          Descargar
                        </motion.button>
                      </div>
                      <img
                        src={collage.url}
                        alt={`Collage ${collage.index}`}
                        className="w-full h-auto border border-gray-300 dark:border-gray-600 rounded shadow-sm"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-400 dark:text-gray-500 h-full flex items-center justify-center">
                  <div>
                    <svg
                      className="w-16 h-16 mx-auto mb-2 opacity-50"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-sm">
                      Los collages aparecerán aquí
                      <br />
                      después de generarlos
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
