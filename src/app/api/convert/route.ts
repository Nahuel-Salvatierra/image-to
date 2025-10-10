import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("image") as File;
    const format = formData.get("format") as "webp" | "png" | "jpg";

    if (!file) {
      return NextResponse.json(
        { error: "No se proporcionó ninguna imagen" },
        { status: 400 }
      );
    }

    if (!format || !["webp", "png", "jpg"].includes(format)) {
      return NextResponse.json({ error: "Formato no válido" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let convertedBuffer: Buffer;

    if (format === "webp") {
      convertedBuffer = await sharp(buffer).webp({ quality: 90 }).toBuffer();
    } else if (format === "png") {
      convertedBuffer = await sharp(buffer).png({ quality: 90 }).toBuffer();
    } else {
      convertedBuffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
    }

    const mimeTypes = {
      webp: "image/webp",
      png: "image/png",
      jpg: "image/jpeg",
    };

    return new NextResponse(new Uint8Array(convertedBuffer), {
      headers: {
        "Content-Type": mimeTypes[format],
        "Content-Disposition": `attachment; filename="converted.${format}"`,
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
