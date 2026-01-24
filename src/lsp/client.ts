import * as vscode from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    Executable,
    ServerOptions,
    RevealOutputChannelOn
} from 'vscode-languageclient/node';
import { getLSPConfig, getC3Config, LSPConfig, C3Config } from '../config';
import { C3_LANGUAGE_ID, C3_FILE_EXTENSIONS, LSP_CLIENT_NAME, LSP_CLIENT_ID, LSP_FLAGS } from '../constants';
import { info, error } from '../logger';
import { checkForUpdates } from './installer';

// The active language client instance (null when not running)
let client: LanguageClient | null = null;

/**
 * Start the Language Server.
 */
export async function startLSP(context: vscode.ExtensionContext): Promise<void> {
    if (client) {
        info('LSP is already running');
        return;
    }

    const lspConfig = getLSPConfig();
    const c3Config = getC3Config();

    // LSP disabled by user
    if (!lspConfig.enabled) {
        info('LSP is disabled in settings');
        return;
    }

    // Check for updates before starting
    if (lspConfig.checkForUpdate) {
        await checkForUpdates(context);
    }

    const args = buildServerArgs(lspConfig, c3Config);
    info(`Starting LSP from: ${lspConfig.path}`);
    info(`LSP arguments: ${args.join(' ')}`);

    try {
        await createAndStartClient(lspConfig, args);
        info('LSP started successfully');
    } catch (err) {
        error('Failed to start LSP', err);
        throw err;
    }
}

/**
 * Stop the Language Server.
 */
export async function stopLSP(): Promise<void> {
    if (!client) {
        info('LSP is not running');
        return;
    }

    info('Stopping LSP...');

    try {
        await client.stop();
        await client.dispose();
        client = null;
        info('LSP stopped');
    } catch (err) {
        error('Error stopping LSP', err);
    }
}

/**
 * Restart the Language Server.
 */
export async function restartLSP(context: vscode.ExtensionContext): Promise<void> {

    info('Restarting LSP...');
    await stopLSP();
    await startLSP(context);
}

/**
 * Check if the Language Server is currently running.
 */
export function isLSPRunning(): boolean {
    return client !== null && client.isRunning();
}

/**
 * Get the language client instance (for advanced usage).
 */
export function getClient(): LanguageClient | null {
    return client;
}

/**
 * Create and start the language client.
 */
async function createAndStartClient(lspConfig: LSPConfig, args: string[]): Promise<void> {
    // How to start the server process
    const serverExecutable: Executable = {
        command: lspConfig.path!,
        args: args
    };

    // Server launch options
    const serverOptions: ServerOptions = {
        run: serverExecutable,
        debug: serverExecutable
    };

    // How VS Code should communicate with the server
    const clientOptions: LanguageClientOptions = {
        // Document types the server handles
        documentSelector: [
            { scheme: 'file', language: C3_LANGUAGE_ID },
            { scheme: 'untitled', language: C3_LANGUAGE_ID },  // New unsaved files
        ],

        // Sync settings
        synchronize: {
            // Watch for changes to C3 files
            fileEvents: vscode.workspace.createFileSystemWatcher(
                `**/*.{${C3_FILE_EXTENSIONS.join(',')}}`
            ),
            configurationSection: ['c3', 'c3.lsp'],
        },

        revealOutputChannelOn: RevealOutputChannelOn.Never,

        middleware: {
            provideDefinition: async (document, position, token, next) => {
                info(`Go to definition requested at ${document.uri.fsPath}:${position.line + 1}:${position.character + 1}`);

                const result = await next(document, position, token);

                if (!result) {
                    error('No definition found');
                } else {
                    info(`Definition found: ${JSON.stringify(result)}`);
                }

                return result;
            },
        },
    };

    client = new LanguageClient(
        LSP_CLIENT_ID,
        LSP_CLIENT_NAME,
        serverOptions,
        clientOptions
    );

    client.setTrace(lspConfig.trace);

    // Start and connect
    await client.start();
}

/**
 * Build command-line arguments for the LSP server.
 */
function buildServerArgs(lspConfig: LSPConfig, c3Config: C3Config): string[] {
    const args: string[] = [];

    if (c3Config.c3cPath) {
        args.push(LSP_FLAGS.C3C_PATH, c3Config.c3cPath);
    }

    if (c3Config.stdlibPath) {
        args.push(LSP_FLAGS.STDLIB_PATH, c3Config.stdlibPath);
    }

    args.push(LSP_FLAGS.DIAGNOSTICS_DELAY, lspConfig.diagnosticsDelay.toString());

    if (lspConfig.langVersion) {
        args.push(LSP_FLAGS.LANG_VERSION, lspConfig.langVersion);
    }

    if (lspConfig.debug) {
        args.push(LSP_FLAGS.DEBUG);
    }

    if (lspConfig.logPath) {
        args.push(LSP_FLAGS.LOG_PATH, lspConfig.logPath);
    }

    if (lspConfig.sendCrashReports) {
        args.push(LSP_FLAGS.SEND_CRASH_REPORTS);
    }

    return args;
}
