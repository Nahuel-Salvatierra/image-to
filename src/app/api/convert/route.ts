import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("image") as File;
    const format = formData.get("format") as string;

    if (!file) {
      return NextResponse.json(
        { error: "No se proporcionó ninguna imagen" },
        { status: 400 }
      );
    }

    const validFormats = ["webp", "png", "jpg", "jpeg", "gif", "tiff"];
    if (!format || !validFormats.includes(format.toLowerCase())) {
      return NextResponse.json({ error: "Formato no válido" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const normalizedFormat = format.toLowerCase();

    let convertedBuffer: Buffer;

    if (normalizedFormat === "webp") {
      convertedBuffer = await sharp(buffer).webp({ quality: 90 }).toBuffer();
    } else if (normalizedFormat === "png") {
      convertedBuffer = await sharp(buffer).png({ quality: 90 }).toBuffer();
    } else if (normalizedFormat === "jpg" || normalizedFormat === "jpeg") {
      convertedBuffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
    } else if (normalizedFormat === "gif") {
      convertedBuffer = await sharp(buffer).gif().toBuffer();
    } else if (normalizedFormat === "tiff") {
      convertedBuffer = await sharp(buffer).tiff({ quality: 90 }).toBuffer();
    } else {
      convertedBuffer = await sharp(buffer).png({ quality: 90 }).toBuffer();
    }

    const mimeTypes: Record<string, string> = {
      webp: "image/webp",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      tiff: "image/tiff",
    };

    const outputFormat = normalizedFormat === "jpeg" ? "jpg" : normalizedFormat;

    return new NextResponse(new Uint8Array(convertedBuffer), {
      headers: {
        "Content-Type": mimeTypes[normalizedFormat] || "image/png",
        "Content-Disposition": `attachment; filename="converted.${outputFormat}"`,
      },
    });
  } catch (error) {
    console.error("Error al convertir imagen:", error);
    return NextResponse.json(
      { error: "Error al procesar la imagen" },
      { status: 500 }
    );
  }
}
