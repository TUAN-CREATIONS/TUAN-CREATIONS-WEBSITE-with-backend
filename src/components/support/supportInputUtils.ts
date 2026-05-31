export type SupportAttachmentExtraction = {
  fileName: string;
  mimeType: string;
  kind: "text" | "pdf" | "image" | "video" | "unsupported";
  text: string;
};

export const SUPPORT_USER_ATTACHMENT_ACCEPT = ".pdf,.txt,.md,.csv,image/*";

export const inferSupportKnowledgeType = (file: File): "text" | "pdf" | "image" | "video" => {
  const mimeType = file.type.toLowerCase();
  if (mimeType.includes("pdf") || file.name.toLowerCase().endsWith(".pdf")) return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "text";
};

export const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });

const readTextFile = async (file: File) => {
  return file.text();
};

const extractPdfText = async (file: File) => {
  const pdfModule = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfModule.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    disableWorker: true,
  } as any);

  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (text) {
      pages.push(text);
    }
  }

  return pages.join("\n\n").trim();
};

const extractImageText = async (file: File) => {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");

  try {
    const result = await worker.recognize(file);
    return result.data.text.replace(/\s+/g, " ").trim();
  } finally {
    await worker.terminate();
  }
};

export async function extractSupportAttachmentText(file: File): Promise<SupportAttachmentExtraction> {
  const mimeType = file.type.toLowerCase();
  const fileName = file.name || "attachment";

  try {
    if (mimeType.includes("pdf") || fileName.toLowerCase().endsWith(".pdf")) {
      return {
        fileName,
        mimeType,
        kind: "pdf",
        text: await extractPdfText(file),
      };
    }

    if (mimeType.startsWith("image/")) {
      return {
        fileName,
        mimeType,
        kind: "image",
        text: await extractImageText(file),
      };
    }

    if (mimeType.startsWith("video/")) {
      return {
        fileName,
        mimeType,
        kind: "video",
        text: `Video file attached: ${fileName}. Use the admin transcript or summary to answer this request.`,
      };
    }

    return {
      fileName,
      mimeType,
      kind: "text",
      text: await readTextFile(file),
    };
  } catch {
    return {
      fileName,
      mimeType,
      kind: "unsupported",
      text: `Attached file: ${fileName}`,
    };
  }
}
