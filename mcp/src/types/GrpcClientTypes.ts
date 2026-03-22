/**
 * Typed interface for the gRPC client imported via dynamic require().
 *
 * OctaneMcpClient uses require() to load OctaneGrpcClientBase at runtime
 * (avoids pulling the full server/gRPC type system into MCP's esbuild,
 * which causes OOM). This file provides the type contract so TypeScript
 * can check our usage without needing the actual import.
 *
 * If OctaneGrpcClientBase's API changes, update this interface to match.
 * The integration tests will catch any drift between this contract and
 * the real implementation.
 */

export interface GrpcCallOptions {
  timeout?: number;
}

/**
 * Minimal typed interface for OctaneGrpcClientBase.
 * Matches server/src/grpc/OctaneGrpcClientBase.ts public API.
 */
export interface IGrpcClientBase {
  /** Load proto definitions. Lazy mode if no args. */
  initialize(coreProtoFiles?: string[]): Promise<void>;

  /**
   * Invoke a gRPC method. Always use Beta 2 method names.
   * Handles API version translation automatically.
   */
  callMethod(
    serviceName: string,
    methodName: string,
    params?: Record<string, unknown>,
    options?: GrpcCallOptions
  ): Promise<Record<string, unknown>>;

  /**
   * Get a raw gRPC service stub for streaming RPCs.
   * Used by CallbackStreamManager for StreamCallbackService.
   */
  getService(serviceName: string): any;

  /** Lightweight health check — true if Octane responds to ping. */
  checkHealth(): Promise<boolean>;

  /** Close all gRPC channels and clear service stub cache. */
  close(): void;
}

/** Constructor type for OctaneGrpcClientBase */
export interface IGrpcClientBaseConstructor {
  new (octaneHost?: string, octanePort?: number, protoBasePath?: string): IGrpcClientBase;
}

/**
 * Transform objectPtr parameters to proto-specific field names.
 * Matches server/src/grpc/OctaneGrpcClientBase.ts transformObjectPtrParams.
 */
export type TransformObjectPtrParams = (
  service: string,
  method: string,
  params: Record<string, unknown>
) => Record<string, unknown>;

/** Shape of the dynamic require() result */
export interface GrpcModule {
  OctaneGrpcClientBase: IGrpcClientBaseConstructor;
  transformObjectPtrParams: TransformObjectPtrParams;
}
