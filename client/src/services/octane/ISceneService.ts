/**
 * ISceneService — interface for the scene tree loading service.
 *
 * Covers the subset of the scene API used by other services
 * (NodeService, MaterialDatabaseService) so those services are not bound to a
 * concrete implementation.
 */

import { SceneNode } from './types';
import { Scene } from './types';

export interface ISceneService {
  /**
   * Build (or incrementally update) the scene tree.
   * @param newNodeHandle — when provided, add only this single node instead of
   *                        rebuilding the full tree.
   */
  buildSceneTree(newNodeHandle?: number): Promise<SceneNode[]>;

  /** Get the current in-memory scene object. */
  getScene(): Scene;

  /** Abort a pending scene load. */
  abort(): void;
}
