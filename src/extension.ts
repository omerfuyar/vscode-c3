import * as vscode from 'vscode';
import * as lsp from './lsp';
import { info, disposeLogger, errorAndShow, initializeLogger } from './logger';
import * as format from './format';

/**
 * Called when the extension is activated.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    initializeLogger();
    info('Extension activating...');

    try {
        // Register the code formatter
        format.registerFormatter(context);

        // Start the Language Server
        await lsp.startLSP(context);

        info('Extension activated successfully');
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errorAndShow(`C3 extension activation failed: ${message}`);
    }
}

/**
 * Called when the extension is deactivated.
 */
export async function deactivate(): Promise<void> {
    info('Extension deactivating...');

    await lsp.stopLSP();
    disposeLogger();
}
