import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getMissingWearableNodeNames } from "@/components/wearable/wearable-scene";

interface GlbJson {
  nodes?: Array<{ name?: string; mesh?: number }>;
  meshes?: Array<{ name?: string }>;
}

function readGlbJson(path: string): GlbJson {
  const buffer = readFileSync(path);
  const magic = buffer.toString("utf8", 0, 4);
  if (magic !== "glTF") {
    throw new Error(`Expected a binary glTF asset, received magic "${magic}".`);
  }

  const jsonLength = buffer.readUInt32LE(12);
  const chunkType = buffer.toString("utf8", 16, 20);
  if (chunkType !== "JSON") {
    throw new Error(`Expected first GLB chunk to be JSON, received "${chunkType}".`);
  }

  return JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength)) as GlbJson;
}

describe("wearable GLB asset contract", () => {
  it("contains named product parts and hotspot markers", () => {
    const glb = readGlbJson(resolve(process.cwd(), "public/models/model3D.glb"));
    const nodeNames = (glb.nodes ?? []).map((node) => node.name ?? "");
    const meaningfulNodes = nodeNames.filter(Boolean);
    const missing = getMissingWearableNodeNames(meaningfulNodes);

    expect(
      missing,
      `model3D.glb is missing required wearable nodes: ${missing.join(", ")}`,
    ).toEqual([]);
    expect(
      meaningfulNodes.length,
      "model3D.glb must be re-exported as named parts/markers, not a single unnamed mesh.",
    ).toBeGreaterThan(1);
  });
});
