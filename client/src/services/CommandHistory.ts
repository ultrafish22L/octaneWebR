/**
 * Command History System
 * Implements undo/redo functionality using the Command pattern
 */

import { Logger } from '../utils/Logger';

export interface Command {
  execute(): Promise<void> | void;
  undo(): Promise<void> | void;
  description: string;
}

export class CommandHistory {
  private history: Command[] = [];
  private currentIndex: number = -1;
  private maxHistorySize: number = 50;

  /**
   * Execute a command and add it to history
   * 
   * Undo/Redo branching behavior:
   * If user undoes to state A, then performs new action B, all undone states
   * after A are discarded. This prevents complex tree-based history.
   * 
   * Example: [Create, Delete, Move] -> Undo Move -> Copy
   * Result:  [Create, Delete, Copy] (Move is gone)
   */
  async executeCommand(command: Command): Promise<void> {
    // Clear redo stack: executing a new command after undo discards future states
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    await command.execute();

    this.history.push(command);
    this.currentIndex++;

    // Prevent unbounded memory growth by discarding oldest command
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.currentIndex--;
    }

    Logger.debug(`✓ Executed: ${command.description}`);
    Logger.debug(`History: ${this.currentIndex + 1}/${this.history.length}`);
  }

  /**
   * Undo the last command
   */
  async undo(): Promise<boolean> {
    if (!this.canUndo()) {
      Logger.warn('Cannot undo: no commands in history');
      return false;
    }

    const command = this.history[this.currentIndex];
    await command.undo();
    this.currentIndex--;

    Logger.debug(`↶ Undone: ${command.description}`);
    Logger.debug(`History: ${this.currentIndex + 1}/${this.history.length}`);
    return true;
  }

  /**
   * Redo the next command
   */
  async redo(): Promise<boolean> {
    if (!this.canRedo()) {
      Logger.warn('Cannot redo: no commands to redo');
      return false;
    }

    this.currentIndex++;
    const command = this.history[this.currentIndex];
    await command.execute();

    Logger.debug(`↷ Redone: ${command.description}`);
    Logger.debug(`History: ${this.currentIndex + 1}/${this.history.length}`);
    return true;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Get current undo description
   */
  getUndoDescription(): string | null {
    if (!this.canUndo()) return null;
    return this.history[this.currentIndex].description;
  }

  /**
   * Get current redo description
   */
  getRedoDescription(): string | null {
    if (!this.canRedo()) return null;
    return this.history[this.currentIndex + 1].description;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
    Logger.debug('Command history cleared');
  }

  /**
   * Get history info for debugging
   */
  getHistoryInfo(): { current: number; total: number; canUndo: boolean; canRedo: boolean } {
    return {
      current: this.currentIndex + 1,
      total: this.history.length,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    };
  }
}

// Singleton instance
export const commandHistory = new CommandHistory();
