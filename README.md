# 🚀 SAJC: Semantic Adaptive JSON Compression

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Stability: Experimental](https://img.shields.io/badge/stability-experimental-orange.svg)](https://github.com/Basiliskin/SAJC)

### **Stop sending air. Send data.**

SAJC is a high-performance, **semantic columnar compression** engine for Node.js and TypeScript. While standard algorithms like Gzip and Brotli are "data-blind," SAJC understands the structure and types of your JSON, achieving compression ratios up to **~9x** in the project's benchmarks by applying specialized binary encoding to every field.

---

## 📊 The Performance Gap

In the project's benchmark of **1,000,000 rows** of realistic, nested JSON data (UUIDs, Timestamps, Enums, and Arrays), SAJC combined with Brotli produced the smallest output:

| Format                     | Total Bytes | Compression Ratio |
| :------------------------- | :---------- | :---------------- |
| **Raw JSON**               | 386,576,686 | 1.00x             |
| **Standard Gzip**          | 87,389,810  | 4.42x             |
| **Standard Brotli**        | 62,852,876  | 6.15x             |
| **SAJC (Raw Binary)**      | 76,873,036  | 5.03x             |
| **SAJC + Brotli**          | 42,369,260  | **9.12x**         |
| **SAJC (Sorted + Brotli)** | 42,350,812  | **9.13x**         |


### Storage Efficiency Benchmark (100,000 rows)

Reproduced by running `examples/benchmark.ts`:

| Format                  | Total Bytes | Compression Ratio |
|-------------------------|-------------|-------------------|
| Raw JSON                | 38,650,684  | 1.00x             |
| Gzip                    | 8,740,017   | 4.42x             |
| Brotli                  | 6,305,898   | 6.13x             |
| SAJC                    | 8,247,162   | 4.69x             |
| SAJC + Gzip             | 4,900,589   | 7.89x             |
| SAJC + Brotli           | 4,503,948   | 8.58x             |
| SAJC (Columnar Brotli)  | 4,500,412   | 8.59x             |


> **Why the difference?** SAJC transforms your "Row-based" JSON into "Columnar" binary blocks. When similar data is grouped together, general-purpose compressors like Brotli can find patterns that are impossible to see in raw JSON.

---

## ✨ Key Features

- **🏗️ Columnar Storage:** Converts JSON objects into contiguous memory blocks by field, maximizing data locality.
- **🧠 Adaptive String Codecs:** Automatically switches between **Dictionary Encoding**, **Run-Length Encoding (RLE)**, and **Raw Varint-Length** based on data cardinality.
- **🔢 Smart Number Encoding:** Detects if a column is Integer-only or Fixed-point Decimal (prices/scores) and uses **ZigZag Varints** instead of 8-byte Floats.
- **🔘 Bit-Packed Booleans:** Stores 8 boolean values in a single byte—a **87.5% reduction** in overhead.
- **📅 Semantic Awareness:** Native specialized codecs for **UUIDs** (16-byte binary) and **Timestamps** (Delta-encoded BigInts).
- **📦 Nested Object Support:** Fully flattens and compresses nested arrays and objects without losing structural integrity.

---

## 🛠️ How It Works

SAJC doesn't just "zip" your file. It profiles your data and applies a strategy:

1.  **Profiling:** It detects that your `status` field only has 5 unique values.
2.  **Dictionary Mapping:** It maps those strings to small integers.
3.  **RLE Optimization:** If your data is sorted, it stores "500 rows of 'Active'" as a single binary pair.
4.  **Varint Encoding:** It uses **LEB128** to ensure that the number `5` takes 1 byte, not 4 or 8.
5.  **Binary Packing:** It concatenates these optimized columns into a single, high-density buffer.

---

## 🚀 Quick Start

```typescript
import { SemanticCompressor } from "./core/SemanticCompressor";
import { CodecRegistry } from "./codecs/CodecRegistry";
import { FieldProfiler } from "./schema/FieldProfile";
import { ColumnBuilder, HeaderEncoder } from "./schema/FieldType";
import { ObjectFlattener } from "./codecs/ObjectFlattener";
import { UUIDCodec } from "./codecs/UUIDCodec";
import { TimestampCodec } from "./codecs/TimestampCodec";
import { EnumCodec } from "./codecs/EnumCodec";
import { AdaptiveStringCodec } from "./codecs/AdaptiveStringCodec";
import { NumberCodec } from "./codecs/NumberCodec";
import { BooleanCodec } from "./codecs/BooleanCodec";
import { ArrayObjectCodec } from "./codecs/ArrayObjectCodec";
import { ArrayPrimitiveCodec } from "./codecs/ArrayPrimitiveCodec";

// 1. Build the codec registry for the types you want to support
const profiler = new FieldProfiler();
const registry = new CodecRegistry();
const columnBuilder = new ColumnBuilder();

registry.register(new UUIDCodec(), "UUID");
registry.register(new TimestampCodec(), "TIMESTAMP");
registry.register(new EnumCodec(), "ENUM");
registry.register(new BooleanCodec(), "BOOLEAN");
registry.register(new NumberCodec(), "NUMBER");
registry.register(new AdaptiveStringCodec(), "STRING");
registry.register(new ArrayObjectCodec(profiler, registry, columnBuilder), "ARRAY");
registry.register(new ArrayPrimitiveCodec(profiler, registry), "ARRAY_PRIMITIVE");

const compressor = new SemanticCompressor(
  registry,
  profiler,
  columnBuilder,
  new HeaderEncoder(),
  new ObjectFlattener()
);

// 2. Your dataset
const data = [
  { id: "550e8400...", status: "active", price: 19.99, tags: ["new"] },
  // ... many more rows
];

// 3. Compress to a high-density Buffer
const compressed = compressor.compress(data);

// 4. Decompress back to the original JSON
const original = compressor.decompress(compressed);
```

> **Note:** the full runnable example lives in [`examples/usage_example.ts`](./examples/usage_example.ts). The package is not yet published to npm, so imports use repo-relative paths.

---

## 🏗️ Architecture Principles

SAJC is built with **SOLID** principles at its core:

- **Single Responsibility:** Every codec (UUID, String, Number) handles exactly one data type.
- **Open/Closed:** Easily add your own custom codecs by implementing the `IFieldCodec` interface.
- **Dependency Inversion:** The `SemanticCompressor` depends on abstractions, allowing you to swap out the `CodecRegistry` or `FieldProfiler` as needed.

---

## 🧪 Testing & Reliability

SAJC is built with reliability in mind:

- **Strict Round-trip Validation:** Every compression cycle is verified internally to ensure the decompressed output matches the input (`core/SemanticCompressor.ts`).
- **Type Safety:** Written in TypeScript.
- **Zero Runtime Dependencies:** Core logic depends only on Node.js built-ins (`Buffer`, `zlib`). The benchmark example additionally uses `@faker-js/faker` for data generation.

---

## 📜 License

MIT © [Dimitry Katz]

---

**Ready to shrink your infrastructure costs?**
[View the Benchmark Script](./examples/benchmark.ts) | [Explore the Codecs](./codecs/)
