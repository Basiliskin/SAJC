import { SemanticCompressor } from "../../core/SemanticCompressor";
import { CodecRegistry } from "../../codecs/CodecRegistry";
import { FieldProfiler } from "../../schema/FieldProfile";
import { ColumnBuilder, HeaderEncoder } from "../../schema/FieldType";
import { ObjectFlattener } from "../../codecs/ObjectFlattener";
import { UUIDCodec } from "../../codecs/UUIDCodec";
import { TimestampCodec } from "../../codecs/TimestampCodec";
import { AdaptiveStringCodec } from "../../codecs/AdaptiveStringCodec";
import { NumberCodec } from "../../codecs/NumberCodec";
import { BooleanCodec } from "../../codecs/BooleanCodec";
import { ArrayObjectCodec } from "../../codecs/ArrayObjectCodec";
import { ArrayPrimitiveCodec } from "../../codecs/ArrayPrimitiveCodec";

describe("SemanticCompressor Columnar Brotli", () => {
  let compressor: SemanticCompressor;

  beforeAll(() => {
    const profiler = new FieldProfiler();
    const columnBuilder = new ColumnBuilder();
    const headerEncoder = new HeaderEncoder();
    const flattener = new ObjectFlattener();
    const registry = new CodecRegistry();

    // Register standard codecs
    registry.register(new UUIDCodec(), "UUID" as any);
    registry.register(new TimestampCodec(), "TIMESTAMP" as any);
    registry.register(new BooleanCodec(), "BOOLEAN" as any);
    registry.register(new NumberCodec(), "NUMBER" as any);
    registry.register(new AdaptiveStringCodec(), "STRING" as any);
    registry.register(
      new ArrayObjectCodec(profiler, registry, columnBuilder),
      "ARRAY" as any
    );
    registry.register(
      new ArrayPrimitiveCodec(profiler, registry),
      "ARRAY_PRIMITIVE" as any
    );

    compressor = new SemanticCompressor(
      registry,
      profiler,
      columnBuilder,
      headerEncoder,
      flattener,
      { version: 1 }
    );
  });

  const testData = [
    {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Item A",
      active: true,
      score: 95.5,
      tags: ["test", "unit"],
      metadata: { version: 1, author: "Dev" },
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440001",
      name: "Item B",
      active: false,
      score: 42,
      tags: ["qa"],
      metadata: { version: 2, author: "Tester" },
    },
  ];

  it("should perform a successful round-trip with compressColumnarBrotli and decompressColumnarBrotliBuffer", () => {
    const compressed = compressor.compressColumnarBrotli(testData);
    expect(compressed).toBeInstanceOf(Buffer);

    const decompressed = compressor.decompressColumnarBrotliBuffer(compressed);

    expect(decompressed).toHaveLength(testData.length);
    expect(decompressed[0].id).toBe(testData[0].id);
    expect(decompressed[0].name).toBe(testData[0].name);
    expect(decompressed[0].active).toBe(testData[0].active);
    expect(decompressed[0].score).toBe(testData[0].score);
    expect(decompressed[0].tags).toEqual(testData[0].tags);
    expect(decompressed[0].metadata).toEqual(testData[0].metadata);
  });

  it("should produce a buffer with 'SJCB' magic bytes", () => {
    const compressed = compressor.compressColumnarBrotli(testData);
    const magic = compressed.slice(0, 4).toString("utf8");
    expect(magic).toBe("SJCB");
  });

  it("should handle datasets with missing/null values in columnar Brotli mode", () => {
    const sparseData = [
      { id: "550e8400-e29b-41d4-a716-446655440000", note: "has note" },
      { id: "550e8400-e29b-41d4-a716-446655440001", note: null },
    ];

    const compressed = compressor.compressColumnarBrotli(sparseData);
    const decompressed = compressor.decompressColumnarBrotliBuffer(compressed);

    expect(decompressed).toHaveLength(2);
    expect(decompressed[0].note).toBe("has note");
    expect(decompressed[1].note).toBeNull();
  });

  it("should handle large datasets in columnar Brotli mode", () => {
    const largeData = Array.from({ length: 100 }, (_, i) => ({
      id: `550e8400-e29b-41d4-a716-446655440${i.toString().padStart(3, "0")}`,
      val: i * 1.5,
      flag: i % 2 === 0,
    }));

    const compressed = compressor.compressColumnarBrotli(largeData);
    const decompressed = compressor.decompressColumnarBrotliBuffer(compressed);

    expect(decompressed).toHaveLength(100);
    expect(decompressed[99].val).toBe(99 * 1.5);
    expect(decompressed[99].flag).toBe(false);
  });
});
