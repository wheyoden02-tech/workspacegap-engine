import JSZip from "jszip";
import type { PackageFiles } from "./package-generator.ts";

export async function buildBundle(
  files: PackageFiles,
): Promise<Uint8Array<ArrayBuffer>> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  zip.file(".claspignore", "**/**\n!Code.gs\n!appsscript.json\n");
  const bytes = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
  });
  return new Uint8Array(bytes);
}
