# Product Facts

> Single source of truth for all downstream marketing skills. No promotional material may claim more
> than this document supports.

## Verified facts

Every fact traced to a repository file, the README, or the user. The `source:` field is restricted to
`<repo-relative path>` | `README` | `user`.

- Product name: "SAJC" (Semantic Adaptive JSON Compression) — source: package.json, README.md
- A compression library for JSON datasets, aimed at Node.js / TypeScript projects — source: package.json, README.md
- Written in TypeScript — source: core/SemanticCompressor.ts, codecs/, schema/, utils/, tests/
- Runs on the Node.js runtime (uses the built-in `node:zlib` module) — source: core/SemanticCompressor.ts
- Compresses an array of JSON records into a single binary `Buffer` — source: core/SemanticCompressor.ts
- Converts row-oriented JSON records into per-field columns (columnar storage) before encoding — source: schema/FieldType.ts (`ColumnBuilder`)
- Infers each field's semantic type before encoding: UUID, Timestamp, Enum, Boolean, Number, Array, Array-of-primitives, or String — source: schema/FieldProfile.ts (`FieldProfiler.detectType`)
- String columns are adaptively encoded in one of three modes: Raw, Dictionary, or RLE-Dictionary — source: codecs/AdaptiveStringCodec.ts
- Number columns use integer (ZigZag varint), fixed-point decimal, or Float64 encoding, chosen by data — source: codecs/NumberCodec.ts
- Boolean columns are bit-packed, 8 values per byte — source: codecs/BooleanCodec.ts
- UUID values are stored as 16-byte binary — source: codecs/UUIDCodec.ts
- Timestamp values are delta-encoded against a stored base value — source: codecs/TimestampCodec.ts
- Nested objects are flattened to dotted paths for columnar compression — source: codecs/ObjectFlattener.ts
- Arrays of objects and arrays of primitives have dedicated codecs — source: codecs/ArrayObjectCodec.ts, codecs/ArrayPrimitiveCodec.ts
- Missing or optional fields are tracked with a null-bitmap wrapper — source: utils/NullableCodecWrapper.ts
- Integer values use LEB128 varint and ZigZag encoding — source: utils/Varint.ts
- The codec architecture is extensible via the `IFieldCodec` interface and a `CodecRegistry` — source: codecs/IFieldCodec.ts, codecs/CodecRegistry.ts
- Compression validates round-trip integrity internally and throws on any mismatch — source: core/SemanticCompressor.ts
- An optional per-column Brotli compression mode emits an "SJCB"-magic buffer — source: core/SemanticCompressor.ts
- Jest-style tests assert codec behavior and end-to-end round-trips — source: tests/core/SemanticCompressor.test.ts, tests/codecs/, tests/schema/
- Licensed under MIT — source: package.json
- README claims compression ratios "up to 10x–15x"; its own benchmark tables show ratios of roughly 4.4x–9.1x on the 1M-row and 100K-row datasets they present — source: README
- README claims the core logic has zero external dependencies — source: README (package.json lists no runtime dependencies)
- README claims "100% Strict TypeScript" — source: README

## Repository evidence

Concrete file paths in this repository that back the Verified facts.

- `package.json`
- `README.md`
- `core/SemanticCompressor.ts`
- `schema/FieldType.ts`
- `schema/FieldProfile.ts`
- `codecs/AdaptiveStringCodec.ts`
- `codecs/ArrayObjectCodec.ts`
- `codecs/ArrayPrimitiveCodec.ts`
- `codecs/BooleanCodec.ts`
- `codecs/CodecRegistry.ts`
- `codecs/EnumCodec.ts`
- `codecs/IFieldCodec.ts`
- `codecs/NumberCodec.ts`
- `codecs/ObjectFlattener.ts`
- `codecs/StringCodec.ts`
- `codecs/TimestampCodec.ts`
- `codecs/UUIDCodec.ts`
- `utils/Varint.ts`
- `utils/NullableCodecWrapper.ts`
- `tests/core/SemanticCompressor.test.ts`
- `tests/codecs/ComplexCodecs.test.ts`
- `tests/codecs/PrimitiveCodecs.test.ts`
- `tests/schema/SchemaAndUtils.test.ts`
- `examples/benchmark.ts`
- `examples/usage_example.ts`

## User-provided facts

Only the four non-derivable categories: production URL, primary goal, open-source status, features
not visible in the repository.

- Production URL: public GitHub repository `github.com/Basiliskin/SAJC` (remote in `.git/config`; public visibility confirmed by user) — source: user
- Primary goal: portfolio / learning showcase — source: user
- Open-source status: public repository, MIT license — source: user
- Features not visible in the repository: none — the repository is the complete product — source: user

## Unknown

Gaps recorded as open. Never invent an answer here.

- Number of users, adopters, or download counts
- Independent (third-party) performance benchmarks — the only numbers are the in-repo README tables and `examples/benchmark.ts`
- npm publication (per the user, this is a public GitHub repo, not an npm package)
- Supported Node.js version range
- Browser support (a Node.js library; not applicable, and unstated)
- Whether the README quick-start API works as documented: `package.json` `main` points to `index.js`, which does not exist; there is no build artifact or `index.ts` entry point, and no `tsconfig.json` in the repo
- The "100% Strict TypeScript" claim is unverified by repository configuration (no `tsconfig.json` present)
- Practical limits of the codecs (maximum dataset size, memory use) beyond what the tests and benchmark exercise
- Release history / roadmap beyond `version 1.0.0`

## Forbidden assumptions

Never claim the following without explicit evidence. Un-evidenced occurrences are parked here, not in
Verified facts.

- The README states SAJC "consistently outperforms industry standards" — a comparative-superiority claim backed only by the project's own benchmark. Parked here; not a Verified fact.
- No evidence in the repository for `fastest`, `most secure`, or `privacy-preserving`. Any such claim would require explicit evidence.
