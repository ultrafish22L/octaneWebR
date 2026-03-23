"use strict";
/**
 * CallbackStreamManager — shared callback streaming for Octane gRPC.
 *
 * Used by both the MCP server and Vite plugin to receive Octane events:
 * - projectManagerChanged: project loaded/reset/modified
 * - renderFailure: render failed
 * - newStatistics: render stats updated (rarely sent by Octane in practice)
 * - newImage: render image data (opt-in via handleNewImage, used by Vite only)
 *
 * The stream auto-expires every DEADLINE_MS to prevent Octane shutdown deadlock
 * (Octane waits for in-progress RPCs to finish, infinite streams never finish).
 * On expiry, reconnects immediately.
 *
 * IMPORTANT: Only ONE stream should be opened per gRPC channel. Opening multiple
 * streams causes Octane to send large newImage data to each, which can trigger
 * RESOURCE_EXHAUSTED errors.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallbackStreamManager = void 0;
const DEFAULT_DEADLINE_MS = 60000;
const OCTANE_GONE_PATTERN = /ECONNRESET|ECONNREFUSED|CANCELLED|Stream removed|socket hang up/i;
class CallbackStreamManager {
    /**
     * @param getService Function that returns a gRPC service stub by name.
     *   Both Vite and MCP expose this via their base client.
     */
    constructor(getService, options) {
        this.getService = getService;
        this.stream = null;
        this.active = false;
        this.running = false; // true between start() and stop()
        this.listeners = new Map();
        this.deadlineMs = options?.deadlineMs ?? DEFAULT_DEADLINE_MS;
        this.log = options?.log ?? ((msg) => console.log(`[CallbackStream] ${msg}`));
        this.onConnectionLost = options?.onConnectionLost;
        this.handleNewImage = options?.handleNewImage ?? false;
        // Initialize listener sets
        for (const type of [
            'projectManagerChanged',
            'renderFailure',
            'newStatistics',
            'newImage',
        ]) {
            this.listeners.set(type, new Set());
        }
    }
    /** Start streaming — auto-reconnects on deadline expiry. */
    start() {
        if (this.stream || this.active)
            return;
        this.running = true;
        this.openStream();
    }
    /** Stop streaming — clean shutdown, no reconnect. */
    stop() {
        this.running = false;
        this.active = false;
        if (this.stream) {
            try {
                this.stream.cancel();
            }
            catch {
                /* already closed */
            }
            this.stream = null;
        }
    }
    /** Register a listener for a callback type. */
    on(type, cb) {
        this.listeners.get(type)?.add(cb);
    }
    /** Unregister a listener. */
    off(type, cb) {
        this.listeners.get(type)?.delete(cb);
    }
    /**
     * Wait for the next event of a specific type.
     * Resolves with the event, or null if timed out.
     * This is the main API for load_project — wait for projectManagerChanged.
     */
    waitFor(type, timeoutMs = 120000) {
        return new Promise(resolve => {
            let timer = null;
            const handler = (event) => {
                if (timer)
                    clearTimeout(timer);
                this.off(type, handler);
                resolve(event);
            };
            this.on(type, handler);
            timer = setTimeout(() => {
                this.off(type, handler);
                resolve(null);
            }, timeoutMs);
        });
    }
    /** Is the stream currently active? */
    get isActive() {
        return this.active;
    }
    // ── Private ───────────────────────────────────────────────────────
    openStream() {
        if (this.stream || this.active || !this.running)
            return;
        try {
            this.active = true;
            const streamService = this.getService('StreamCallbackService');
            const deadline = Date.now() + this.deadlineMs;
            this.stream = streamService.callbackChannel({}, null, { deadline });
            this.stream.on('data', (callbackRequest) => {
                try {
                    this.dispatch(callbackRequest);
                }
                catch (error) {
                    this.log(`Error processing callback: ${error.message}`, 'error');
                }
            });
            this.stream.on('error', (error) => {
                this.active = false;
                try {
                    this.stream?.cancel();
                }
                catch {
                    /* already errored */
                }
                this.stream = null;
                const msg = String(error?.message || '');
                const isDeadline = /DEADLINE_EXCEEDED/i.test(msg);
                const octaneGone = OCTANE_GONE_PATTERN.test(msg);
                if (isDeadline && this.running) {
                    // Normal deadline expiry — reconnect immediately
                    this.openStream();
                }
                else if (this.running && !octaneGone) {
                    this.log(`Stream error: ${msg}`, 'error');
                    setTimeout(() => {
                        if (this.running)
                            this.openStream();
                    }, 5000);
                }
                else if (octaneGone) {
                    this.log('Octane connection lost', 'warn');
                    this.running = false;
                    this.onConnectionLost?.();
                }
            });
            this.stream.on('end', () => {
                this.active = false;
                this.stream = null;
                // Reconnect if still running
                if (this.running) {
                    this.openStream();
                }
            });
            this.log('Callback streaming active', 'info');
        }
        catch (error) {
            this.log(`Failed to start callback streaming: ${error.message}`, 'error');
            this.active = false;
            this.stream = null;
        }
    }
    dispatch(callbackRequest) {
        if (callbackRequest.newImage) {
            // Only dispatch newImage if opt-in (Vite). MCP skips this cheaply.
            if (this.handleNewImage) {
                const event = {
                    type: 'newImage',
                    raw: callbackRequest.newImage,
                    timestamp: Date.now(),
                };
                const listeners = this.listeners.get('newImage');
                if (listeners) {
                    for (const cb of listeners) {
                        try {
                            cb(event);
                        }
                        catch (e) {
                            this.log(`Error in newImage listener: ${e.message}`, 'error');
                        }
                    }
                }
            }
        }
        else if (callbackRequest.renderFailure) {
            this.emit('renderFailure', callbackRequest.renderFailure?.user_data ?? 0);
        }
        else if (callbackRequest.newStatistics) {
            this.emit('newStatistics', callbackRequest.newStatistics?.user_data ?? 0);
        }
        else if (callbackRequest.projectManagerChanged) {
            this.emit('projectManagerChanged', callbackRequest.projectManagerChanged?.user_data ?? 0);
        }
    }
    emit(type, userData) {
        const event = { type, userData, timestamp: Date.now() };
        const listeners = this.listeners.get(type);
        if (!listeners)
            return;
        for (const cb of listeners) {
            try {
                cb(event);
            }
            catch (e) {
                this.log(`Error in ${type} listener: ${e.message}`, 'error');
            }
        }
    }
}
exports.CallbackStreamManager = CallbackStreamManager;
