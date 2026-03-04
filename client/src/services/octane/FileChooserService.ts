/**
 * File Chooser Service - Directory listing for the file browser dialog.
 * When Octane is local, fetches real filesystem via /api/files/list.
 * When remote, returns a fake file tree stub.
 */

import { EventEmitter } from '../../utils/EventEmitter';
import { Logger } from '../../utils/Logger';
import { BaseService } from './BaseService';
import { ApiService } from './ApiService';

export interface FileEntry {
  name: string;
  isDirectory: boolean;
  size: number;
  extension: string;
}

export interface DirectoryListing {
  path: string;
  parent: string | null;
  entries: FileEntry[];
}

/** Fake file tree for remote/stub mode */
const FAKE_TREE: Record<string, FileEntry[]> = {
  '': [
    { name: 'C:\\', isDirectory: true, size: 0, extension: '' },
    { name: 'D:\\', isDirectory: true, size: 0, extension: '' },
  ],
  'C:\\': [
    { name: 'scenes', isDirectory: true, size: 0, extension: '' },
    { name: 'textures', isDirectory: true, size: 0, extension: '' },
    { name: 'models', isDirectory: true, size: 0, extension: '' },
    { name: 'Users', isDirectory: true, size: 0, extension: '' },
  ],
  'C:\\scenes': [
    { name: 'project1', isDirectory: true, size: 0, extension: '' },
    { name: 'project2', isDirectory: true, size: 0, extension: '' },
    { name: 'scene.orbx', isDirectory: false, size: 1048576, extension: '.orbx' },
    { name: 'backup.orbx', isDirectory: false, size: 524288, extension: '.orbx' },
    { name: 'test.ocs', isDirectory: false, size: 262144, extension: '.ocs' },
  ],
  'C:\\scenes\\project1': [
    { name: 'main.orbx', isDirectory: false, size: 2097152, extension: '.orbx' },
    { name: 'lighting.orbx', isDirectory: false, size: 819200, extension: '.orbx' },
  ],
  'C:\\scenes\\project2': [
    { name: 'exterior.orbx', isDirectory: false, size: 3145728, extension: '.orbx' },
  ],
  'C:\\textures': [
    { name: 'wood.png', isDirectory: false, size: 4194304, extension: '.png' },
    { name: 'metal.exr', isDirectory: false, size: 8388608, extension: '.exr' },
    { name: 'brick_diffuse.jpg', isDirectory: false, size: 2097152, extension: '.jpg' },
    { name: 'brick_normal.png', isDirectory: false, size: 1048576, extension: '.png' },
  ],
  'C:\\models': [
    { name: 'chair.obj', isDirectory: false, size: 5242880, extension: '.obj' },
    { name: 'table.abc', isDirectory: false, size: 10485760, extension: '.abc' },
    { name: 'lamp.ply', isDirectory: false, size: 1048576, extension: '.ply' },
  ],
  'C:\\Users': [{ name: 'Documents', isDirectory: true, size: 0, extension: '' }],
  'C:\\Users\\Documents': [{ name: 'renders', isDirectory: true, size: 0, extension: '' }],
  'C:\\Users\\Documents\\renders': [
    { name: 'final_render.png', isDirectory: false, size: 15728640, extension: '.png' },
    { name: 'draft.jpg', isDirectory: false, size: 524288, extension: '.jpg' },
  ],
  'D:\\': [{ name: 'assets', isDirectory: true, size: 0, extension: '' }],
  'D:\\assets': [{ name: 'hdri', isDirectory: true, size: 0, extension: '' }],
  'D:\\assets\\hdri': [
    { name: 'studio.hdr', isDirectory: false, size: 67108864, extension: '.hdr' },
    { name: 'outdoor.exr', isDirectory: false, size: 33554432, extension: '.exr' },
  ],
};

export class FileChooserService extends BaseService {
  private apiService: ApiService;

  constructor(emitter: EventEmitter, serverUrl: string, apiService: ApiService) {
    super(emitter, serverUrl);
    this.apiService = apiService;
  }

  /** List directory contents. Uses real filesystem when local, fake tree when remote. */
  async listDirectory(dirPath: string): Promise<DirectoryListing | null> {
    if (this.apiService.isLocal) {
      return this.listDirectoryLocal(dirPath);
    }
    return this.listDirectoryFake(dirPath);
  }

  /** Fetch real directory listing from /api/files/list */
  private async listDirectoryLocal(dirPath: string): Promise<DirectoryListing | null> {
    const url = `${this.serverUrl}/api/files/list?path=${encodeURIComponent(dirPath)}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        Logger.error('FileChooserService.listDirectoryLocal failed:', err.error);
        return null;
      }
      return (await response.json()) as DirectoryListing;
    } catch (error) {
      Logger.error('FileChooserService.listDirectoryLocal error:', error);
      return null;
    }
  }

  /** Return fake directory listing for remote/stub mode */
  private async listDirectoryFake(dirPath: string): Promise<DirectoryListing | null> {
    const normalized = dirPath.replace(/\\$/, '');
    const key = normalized.length <= 3 ? dirPath : normalized;
    const entries = FAKE_TREE[key];
    if (!entries) return null;

    let parent: string | null = null;
    if (dirPath) {
      const sep = dirPath.lastIndexOf('\\');
      parent = sep > 0 ? dirPath.substring(0, sep) : sep === 0 ? '' : null;
      if (dirPath.length <= 3) parent = '';
    }

    return { path: dirPath, parent, entries };
  }
}
