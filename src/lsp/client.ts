import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, Executable, ServerOptions } from 'vscode-languageclient/node';
import { Trace } from 'vscode-jsonrpc';
import { getLSPConfig, getC3Config, LSPConfig } from '../config';
import { C3_LANGUAGE_ID, C3_FILE_EXTENSIONS, LSP_CLIENT_NAME } from '../constants';
import { info, error } from '../logger';
import { checkForUpdates } from './installer';

// The active language client instance (null when not running)
let client: LanguageClient | null = null;

/**
 * Start the Language Server.
 */
export async function startLSP(context: vscode.ExtensionContext): Promise<void> {
    const lspConfig = getLSPConfig();

    // LSP disabled by user
    if (!lspConfig.enabled) {
        info('LSP is disabled in settings');
        return;
    }

    if (client) {
        info('LSP is already running');
        return;
    }

    // Check for updates before starting
    if (lspConfig.checkForUpdate) {
        await checkForUpdates(context);
    }

    info(`Starting LSP from: ${lspConfig.path}`);

    try {
        await createAndStartClient(lspConfig);
        info('LSP started successfully');
    } catch (err) {
        error('Failed to start LSP', err);
        throw err;
    }
}

/**
 * Stop the Language Server.
 * 
 * Called when extension deactivates or VS Code closes.
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
 * 
 * Useful when user changes settings or updates the LSP binary.
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
    return client !== null;
}

/**
 * Create and start the language client.
 */
async function createAndStartClient(lspConfig: LSPConfig): Promise<void> {
    const args: string[] = buildServerArgs();

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
        documentSelector: [
            { scheme: 'file', language: C3_LANGUAGE_ID }
        ],
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher(
                `**/*.{${C3_FILE_EXTENSIONS.join(',')}}`
            ),
        }
    };

    // Create the client
    client = new LanguageClient(
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
function buildServerArgs(): string[] {
    const lspConfig = getLSPConfig();
    const c3Config = getC3Config();
    const args: string[] = [];

    if (lspConfig.sendCrashReports) {
        args.push('--send-crash-reports');
    }

    if (lspConfig.logPath) {
        args.push(`--info-path=${lspConfig.logPath}`);
    }

    if (lspConfig.diagnosticsDelay) {
        args.push(`--diagnostics-delay=${lspConfig.diagnosticsDelay}`);
    }

    if (lspConfig.debug) {
        args.push('--debug');
    }

    if (c3Config.stdlibPath) {
        args.push(`--stdlib-path=${c3Config.stdlibPath}`);
    }

    return args;
}
