export const runtime = "nodejs";
import { listParticipantsAdmin } from "@/app/_lib/actions/adminInscricoes";
import type { BeltColor, ModalityFilter, ParticipantAdmin } from "@/app/_lib/types";
import { beltLabel } from "@/app/_lib/types";

function normalize(s: string) {
  return s.trim().toLowerCase();
}

function filterList(
  list: ParticipantAdmin[],
  {
    q,
    belt,
    mod,
    minW,
    maxW,
  }: { q?: string; belt?: string; mod?: string; minW?: string; maxW?: string }
) {
  const qq = q ? normalize(q) : "";
  const beltFilter = (belt as "ALL" | BeltColor | undefined) ?? "ALL";
  const modFilter = (mod as ModalityFilter | undefined) ?? "ALL";
  const min = minW ? Number(minW) : undefined;
  const max = maxW ? Number(maxW) : undefined;

  return list
    .filter((p) => {
      if (!qq) return true;
      return (
        normalize(p.full_name).includes(qq) ||
        normalize(p.whatsapp).includes(qq) ||
        normalize(p.academy ?? "").includes(qq)
      );
    })
    .filter((p) => (beltFilter === "ALL" ? true : p.belt_color === beltFilter))
    .filter((p) => {
      if (modFilter === "ALL") return true;
      if (modFilter === "GI") return p.mod_gi;
      if (modFilter === "NOGI") return p.mod_nogi;
      if (modFilter === "ABS") return p.mod_abs;
      return true;
    })
    .filter((p) => {
      if (min !== undefined && !Number.isNaN(min) && (p.weight_kg === null || p.weight_kg < min)) return false;
      if (max !== undefined && !Number.isNaN(max) && (p.weight_kg === null || p.weight_kg > max)) return false;
      return true;
    });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const all = await listParticipantsAdmin();
    const filtered = filterList(all, {
      q: searchParams.get("q") ?? undefined,
      belt: searchParams.get("belt") ?? undefined,
      mod: searchParams.get("mod") ?? undefined,
      minW: searchParams.get("minW") ?? undefined,
      maxW: searchParams.get("maxW") ?? undefined,
    });

    // Importação usando require no runtime Node.js
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfmake = require("pdfmake");
    const PdfPrinter = pdfmake.default || pdfmake;

    const fonts = {
      Roboto: {
        normal: "Helvetica",
        bold: "Helvetica-Bold",
        italics: "Helvetica-Oblique",
        bolditalics: "Helvetica-BoldOblique",
      },
    };

    const printer = new PdfPrinter(fonts);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docDefinition: any = {
      pageSize: "A4",
      pageMargins: [36, 36, 36, 36],
      content: [
        { text: "Relatório de Inscrições", style: "header", margin: [0, 0, 0, 10] },
        { text: `Total filtrado: ${filtered.length}`, style: "subheader", margin: [0, 0, 0, 20] },
        {
          table: {
            headerRows: 1,
            widths: ["*", 60, 60, 80, 100],
            body: [
              [
                { text: "Atleta", style: "tableHeader", bold: true },
                { text: "Idade", style: "tableHeader", bold: true },
                { text: "Peso", style: "tableHeader", bold: true },
                { text: "Faixa", style: "tableHeader", bold: true },
                { text: "Categoria", style: "tableHeader", bold: true },
              ],
              ...filtered.map((p) => {
                const mods = [
                  p.mod_gi ? "Gi" : null,
                  p.mod_nogi ? "NoGi" : null,
                  p.mod_abs ? "Abs" : null,
                ]
                  .filter(Boolean)
                  .join(", ");

                return [
                  {
                    text: [
                      { text: `${p.full_name} (${p.whatsapp})\n`, fontSize: 10 },
                      {
                        text: `${p.academy ?? "-"} | ${mods || "-"}`,
                        fontSize: 9,
                        color: "#666666",
                      },
                    ],
                  },
                  { text: String(p.age), fontSize: 10 },
                  { text: `${p.weight_kg} kg`, fontSize: 10 },
                  { text: beltLabel[p.belt_color], fontSize: 10 },
                  { text: p.category || "-", fontSize: 10 },
                ];
              }),
            ],
          },
          layout: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            hLineWidth: function (i: number, node: any) {
              return i === 0 || i === node.table.body.length ? 1 : 0;
            },
            vLineWidth: function () {
              return 0;
            },
            paddingLeft: function () {
              return 0;
            },
            paddingRight: function () {
              return 0;
            },
            paddingTop: function () {
              return 5;
            },
            paddingBottom: function () {
              return 5;
            },
          },
        },
      ],
      styles: {
        header: { fontSize: 16, bold: true },
        subheader: { fontSize: 10, color: "#666666" },
        tableHeader: { fontSize: 11 },
      },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    const chunks: Buffer[] = [];
    pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
      pdfDoc.on("error", reject);
      pdfDoc.end();
    });

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="inscricoes.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    return new Response(JSON.stringify({ error: "Erro ao gerar PDF. Tente novamente." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
