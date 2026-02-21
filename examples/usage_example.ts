import {
  SemanticCompressor,
  SemanticCompressorOptions,
} from "../core/SemanticCompressor";
import { CodecRegistry } from "../codecs/CodecRegistry";
import { FieldProfiler } from "../schema/FieldProfile";
import { ColumnBuilder, FieldType, HeaderEncoder } from "../schema/FieldType";
import { ObjectFlattener } from "../codecs/ObjectFlattener";
import { UUIDCodec } from "../codecs/UUIDCodec";
import { TimestampCodec } from "../codecs/TimestampCodec";
import { EnumCodec } from "../codecs/EnumCodec";
import { AdaptiveStringCodec } from "../codecs/AdaptiveStringCodec";
import { NumberCodec } from "../codecs/NumberCodec";
import { BooleanCodec } from "../codecs/BooleanCodec";
import { ArrayObjectCodec } from "../codecs/ArrayObjectCodec";
import { ArrayPrimitiveCodec } from "../codecs/ArrayPrimitiveCodec";
import zlib from "node:zlib";

function deepEqualPreservingAbsence(original: any, decompressed: any): boolean {
  if (original === decompressed) return true;
  if (typeof original !== typeof decompressed) return false;

  if (Array.isArray(original) && Array.isArray(decompressed)) {
    if (original.length !== decompressed.length) return false;
    return original.every((v, i) =>
      deepEqualPreservingAbsence(v, decompressed[i])
    );
  }

  if (
    typeof original === "object" &&
    original !== null &&
    typeof decompressed === "object" &&
    decompressed !== null
  ) {
    const keysOrig = Object.keys(original);
    const keysDec = Object.keys(decompressed);

    if (
      keysOrig.length !== keysDec.length ||
      !keysOrig.every((k) => keysDec.includes(k)) ||
      !keysDec.every((k) => keysOrig.includes(k))
    ) {
      return false;
    }

    return keysOrig.every((key) =>
      deepEqualPreservingAbsence(original[key], decompressed[key])
    );
  }

  return original === decompressed;
}

function main() {
  console.log("=== SAJC Semantic Compression Usage Example ===\n");

  const profiler = new FieldProfiler();
  const columnBuilder = new ColumnBuilder();
  const headerEncoder = new HeaderEncoder();
  const flattener = new ObjectFlattener();
  const registry = new CodecRegistry();

  registry.register(new UUIDCodec(), "UUID" as any);
  registry.register(new TimestampCodec(), "TIMESTAMP" as any);
  registry.register(new EnumCodec(), "ENUM" as any);
  registry.register(new BooleanCodec(), "BOOLEAN" as any);
  registry.register(new NumberCodec(), "NUMBER" as any);
  registry.register(
    new ArrayObjectCodec(profiler, registry, columnBuilder),
    "ARRAY" as any
  );
  registry.register(
    new ArrayPrimitiveCodec(profiler, registry),
    "ARRAY_PRIMITIVE" as any
  );
  registry.register(new AdaptiveStringCodec(), "STRING" as any);

  const testCodec = registry.get(FieldType.NUMBER);
  console.log("Codec for NUMBER:", testCodec.constructor.name);
  console.log(
    `Registered codecs for types: ${registry.getSupportedTypes().join(",")}\n`
  );

  const items = [
    {
      id: "550e8400-e29b-41d4-a716-446655440000",
      createdAt: "2025-06-15T14:30:22.123Z",
      status: "active",
      score: 87.5,
      isPremium: true,
      tags: ["urgent", "frontend", "typescript"],
      metadata: { source: "web", version: 3 },
      items: [
        { name: "Laptop", price: 1299.99, inStock: true },
        { name: "Monitor", price: 349.5, inStock: false },
      ],
      history: [1, 3, 8, 13],
      notes: null,
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440001",
      createdAt: "2025-06-15T14:30:22.123Z",
      status: "inactive",
      score: 87.5,
      isPremium: false,
      tags: ["deal"],
      metadata: { source: "app", version: 3, comment: "some comment" },
      items: [
        { name: "Table", price: 1129.99, inStock: false },
        { name: "Monitor", price: 149.5, inStock: true },
      ],
      history: [1, 3, 8, 13],
      notes: "some notes",
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440001",
      createdAt: "2025-06-15T14:30:22.124Z",
      status: "inactive",
      score: 45.25,
      isPremium: false,
      tags: [],
      metadata: { source: "web", version: 3, comment: "some comment" },
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440002",
      createdAt: "2025-06-15T14:30:22.125Z",
      status: "pending",
      score: 75.75,
      isPremium: true,
      tags: ["backend", "javascript"],
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440003",
      createdAt: "2025-06-15T14:30:22.126Z",
      status: "completed",
      score: 95.5,
      isPremium: true,
      tags: ["database", "sql"],
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440004",
      createdAt: "2025-06-15T14:30:22.127Z",
      status: "cancelled",
      score: 0,
      isPremium: false,
      tags: [],
    },
  ];

  const sampleData = [];
  for (let i = 0; i < 1000; i++) {
    sampleData.push({ ...items[i % items.length], id: i.toString() });
  }

  console.log(`Sample data rows: ${sampleData.length}`);

  const options: SemanticCompressorOptions = { version: 1 };
  const compressor = new SemanticCompressor(
    registry,
    profiler,
    columnBuilder,
    headerEncoder,
    flattener,
    options
  );

  try {
    const compressed = compressor.compress(sampleData);
    const compressedZstd = zlib.gzipSync(compressed, { level: 9 });

    console.info(
      `Compressed size: ${compressed.length} bytes, ${compressedZstd.length} bytes (zstd)`
    );
    console.log("Decompressing...");

    const decompressed = compressor.decompress(compressed);
    console.log(
      "Validating round-trip (strict key presence + value equality)..."
    );

    let errors = 0;
    for (let i = 0; i < sampleData.length; i++) {
      const original = sampleData[i];
      const decoded = decompressed[i];

      if (!deepEqualPreservingAbsence(original, decoded)) {
        console.error(
          `Row ${i} round-trip FAILED (structure or value mismatch)`
        );
        console.error("Original keys:", Object.keys(original).sort());
        console.error("Decoded keys:", Object.keys(decoded).sort());
        errors++;
        if (errors > 5) {
          console.error("Too many errors – stopping early");
          break;
        }
      }
    }

    if (errors === 0) {
      console.log("ALL rows passed strict round-trip validation ✓");
    } else {
      console.error(`Validation found ${errors} failing rows`);
      process.exit(1);
    }

    const originalJsonSize = Buffer.from(JSON.stringify(sampleData)).length;
    const compressionRatio = (originalJsonSize / compressed.length).toFixed(2);
    const compressionRatioZstd = (
      originalJsonSize / compressedZstd.length
    ).toFixed(2);

    console.info(`Compression ratio: ${compressionRatio}x`);
    console.info(`Compression ratio ZSTD: ${compressionRatioZstd}x`);

    console.log("=== Summary ===");
    console.log(`Rows: ${sampleData.length}`);
    console.log(`Original JSON size: ${originalJsonSize} bytes`);
    console.log(`Compressed size: ${compressed.length} bytes`);
    console.log(`Compressed size ZSTD: ${compressedZstd.length} bytes`);
    console.log(`Compression ratio: ${compressionRatio}x`);
    console.log(`Compression ratio ZSTD: ${compressionRatioZstd}x`);
  } catch (err) {
    console.error("Error during compression/decompression cycle:");
    console.error(err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
