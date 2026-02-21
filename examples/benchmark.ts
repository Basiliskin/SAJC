import { faker } from "@faker-js/faker";
import zlib from "node:zlib";
import {
  SemanticCompressor,
  SemanticCompressorOptions,
} from "../core/SemanticCompressor";
import { CodecRegistry } from "../codecs/CodecRegistry";
import { FieldProfiler } from "../schema/FieldProfile";
import { ColumnBuilder, HeaderEncoder } from "../schema/FieldType";
import { ObjectFlattener } from "../codecs/ObjectFlattener";
import { UUIDCodec } from "../codecs/UUIDCodec";
import { TimestampCodec } from "../codecs/TimestampCodec";
import { EnumCodec } from "../codecs/EnumCodec";
import { AdaptiveStringCodec } from "../codecs/AdaptiveStringCodec";
import { NumberCodec } from "../codecs/NumberCodec";
import { BooleanCodec } from "../codecs/BooleanCodec";
import { ArrayObjectCodec } from "../codecs/ArrayObjectCodec";
import { ArrayPrimitiveCodec } from "../codecs/ArrayPrimitiveCodec";

export interface BenchmarkResult {
  format: string;
  totalBytes: number;
  compressionRatio: string;
}

/**
 * Initializes and configures the SemanticCompressor with all standard codecs.
 */
export function createCompressor(): SemanticCompressor {
  const profiler = new FieldProfiler();
  const columnBuilder = new ColumnBuilder();
  const headerEncoder = new HeaderEncoder();
  const flattener = new ObjectFlattener();
  const registry = new CodecRegistry();

  // Register all supported codecs
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

  // Use AdaptiveStringCodec for optimal string compression
  registry.register(new AdaptiveStringCodec(), "STRING" as any);

  const options: SemanticCompressorOptions = { version: 1 };
  return new SemanticCompressor(
    registry,
    profiler,
    columnBuilder,
    headerEncoder,
    flattener,
    options
  );
}

/**
 * Generates a deterministic dataset of the specified size using Faker.
 */
export function generateDataset(rowCount: number): Record<string, unknown>[] {
  console.log(`Generating ${rowCount.toLocaleString()} rows of data...`);

  // Seed faker for deterministic, reproducible results
  faker.seed(42);

  const data: Record<string, unknown>[] = [];
  const statuses = ["active", "inactive", "pending", "completed", "cancelled"];
  const tagsPool = [
    "urgent",
    "frontend",
    "typescript",
    "backend",
    "javascript",
    "database",
    "sql",
    "deal",
  ];

  for (let i = 0; i < rowCount; i++) {
    data.push({
      id: faker.string.uuid(),
      createdAt: faker.date.recent().toISOString(),
      status: faker.helpers.arrayElement(statuses),
      score: faker.number.float({ min: 0, max: 100, fractionDigits: 2 }),
      isPremium: faker.datatype.boolean(),
      tags: faker.helpers.arrayElements(tagsPool, { min: 0, max: 3 }),
      metadata: {
        source: faker.helpers.arrayElement(["web", "app", "api"]),
        version: faker.number.int({ min: 1, max: 5 }),
        comment: faker.datatype.boolean() ? faker.lorem.sentence() : null,
      },
      items: Array.from({ length: faker.number.int({ min: 0, max: 3 }) }).map(
        () => ({
          name: faker.commerce.productName(),
          price: faker.number.float({ min: 10, max: 2000, fractionDigits: 2 }),
          inStock: faker.datatype.boolean(),
        })
      ),
      history: Array.from({ length: faker.number.int({ min: 0, max: 5 }) }).map(
        () => faker.number.int({ min: 1, max: 100 })
      ),
      notes: faker.datatype.boolean() ? faker.lorem.words(3) : null,
    });

    // Log progress for large datasets
    if ((i + 1) % 100000 === 0) {
      console.log(`...generated ${(i + 1).toLocaleString()} rows`);
    }
  }

  return data;
}

/**
 * Formats and prints the benchmark results as a Markdown table.
 */
export function printMarkdownTable(results: BenchmarkResult[]): void {
  console.log("\n### Storage Efficiency Benchmark Results\n");
  console.log("| Format                  | Total Bytes | Compression Ratio |");
  console.log("|-------------------------|-------------|-------------------|");

  for (const result of results) {
    const formatPad = result.format.padEnd(23);
    const bytesPad = result.totalBytes.toLocaleString().padEnd(11);
    const ratioPad = result.compressionRatio.padEnd(17);
    console.log(`| ${formatPad} | ${bytesPad} | ${ratioPad} |`);
  }
  console.log("\n");
}

/**
 * Calculates the compression ratio formatted to 2 decimal places.
 */
export function calculateRatio(
  compressedBytes: number,
  rawBytes: number
): string {
  return `${(rawBytes / compressedBytes).toFixed(2)}x`;
}

/**
 * Main execution function for the benchmark.
 */
export function runBenchmark(ROW_COUNT = 100_000): void {
  console.log("=== SAJC Storage Efficiency Benchmark ===");
  console.log(`Target: ${ROW_COUNT.toLocaleString()} rows\n`);

  const dataset = generateDataset(ROW_COUNT);

  console.log("\nStarting benchmark measurements...");

  // 1. Raw JSON
  console.log("Measuring Raw JSON...");
  console.time("Raw JSON");
  const rawJsonString = JSON.stringify(dataset);
  const rawJsonBuffer = Buffer.from(rawJsonString, "utf8");
  const rawBytes = rawJsonBuffer.byteLength;
  console.timeEnd("Raw JSON");

  // 2. Gzip JSON
  console.log("Measuring Gzip JSON...");
  console.time("Gzip JSON");
  const gzipBuffer = zlib.gzipSync(rawJsonBuffer, { level: 9 });
  const gzipBytes = gzipBuffer.byteLength;
  console.timeEnd("Gzip JSON");
  console.log("Measuring Brotli JSON...");
  console.time("Brotli JSON");
  const brotliBuffer = zlib.brotliCompressSync(rawJsonBuffer, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
    },
  });
  const brotliBytes = brotliBuffer.byteLength;
  console.timeEnd("Brotli JSON");
  // 3. SAJC (Standard)
  console.log("Measuring SAJC...");
  const compressor = createCompressor();
  console.time("SAJC");

  // Use the updated compress method
  const sajcBuffer = compressor.compress(dataset);
  const sajcBytes = sajcBuffer.byteLength;
  console.timeEnd("SAJC");
  // 4. SAJC + Gzip
  console.log("Measuring SAJC + Gzip...");
  console.time("SAJC + Gzip");
  const sajcGzipBuffer = zlib.gzipSync(sajcBuffer, { level: 9 });
  const sajcGzipBytes = sajcGzipBuffer.byteLength;
  console.timeEnd("SAJC + Gzip");
  // 5. SAJC + Brotli
  console.log("Measuring SAJC + Brotli...");
  console.time("SAJC + Brotli");
  const sajcBrotliBuffer = zlib.brotliCompressSync(sajcBuffer, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
    },
  });
  const sajcBrotliBytes = sajcBrotliBuffer.byteLength;
  console.timeEnd("SAJC + Brotli");
  // 6. SAJC (Columnar Brotli)
  console.log("Measuring SAJC (Columnar Brotli)...");
  console.time("SAJC (Columnar Brotli)");
  // Use the updated compressColumnarBrotli method
  const columnarBrotliBuffer = compressor.compressColumnarBrotli(dataset);
  const columnarBrotliBytes = columnarBrotliBuffer.byteLength;
  console.timeEnd("SAJC (Columnar Brotli)");
  // Compile Results
  const results: BenchmarkResult[] = [
    {
      format: "Raw JSON",
      totalBytes: rawBytes,
      compressionRatio: "1.00x",
    },
    {
      format: "Gzip",
      totalBytes: gzipBytes,
      compressionRatio: calculateRatio(gzipBytes, rawBytes),
    },
    {
      format: "Brotli",
      totalBytes: brotliBytes,
      compressionRatio: calculateRatio(brotliBytes, rawBytes),
    },
    {
      format: "SAJC",
      totalBytes: sajcBytes,
      compressionRatio: calculateRatio(sajcBytes, rawBytes),
    },
    {
      format: "SAJC + Gzip",
      totalBytes: sajcGzipBytes,
      compressionRatio: calculateRatio(sajcGzipBytes, rawBytes),
    },
    {
      format: "SAJC + Brotli",
      totalBytes: sajcBrotliBytes,
      compressionRatio: calculateRatio(sajcBrotliBytes, rawBytes),
    },
    {
      format: "SAJC (Columnar Brotli)",
      totalBytes: columnarBrotliBytes,
      compressionRatio: calculateRatio(columnarBrotliBytes, rawBytes),
    },
  ];

  printMarkdownTable(results);
}

// Execute if run directly
if (require.main === module) {
  try {
    runBenchmark();
  } catch (error) {
    console.error("Benchmark failed with an error:", error);
    process.exit(1);
  }
}
