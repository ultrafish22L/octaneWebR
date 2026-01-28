#!/bin/bash
set -e

PROTO_DIR="./server/proto"
OUT_DIR="./server/src/generated"

echo "🔧 Generating protobuf bindings..."

mkdir -p "$OUT_DIR"

# Generate TypeScript bindings for all proto files
npx grpc_tools_node_protoc \
  --plugin=protoc-gen-ts=./node_modules/.bin/protoc-gen-ts \
  --ts_out=grpc_js:"$OUT_DIR" \
  --js_out=import_style=commonjs,binary:"$OUT_DIR" \
  --grpc_out=grpc_js:"$OUT_DIR" \
  -I "$PROTO_DIR" \
  "$PROTO_DIR"/*.proto

echo "✅ Protobuf generation complete: $OUT_DIR"
ls -lh "$OUT_DIR" | head -20
