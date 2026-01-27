import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import { getFMTConfig } from './config';
import { C3_LANGUAGE_ID, FMT_FLAGS } from './constants';
import { errorAndShow } from './logger';

/**
 * Register the formatting provider with VS Code.
 */
export function registerFormatter(context: vscode.ExtensionContext): void {
    const provider = vscode.languages.registerDocumentFormattingEditProvider(
        [
            { language: C3_LANGUAGE_ID, scheme: 'file' },     // Saved files
            { language: C3_LANGUAGE_ID, scheme: 'untitled' }, // New unsaved files
        ],
        {
            provideDocumentFormattingEdits: formatDocument
        }
    );

    // Register for cleanup when extension deactivates
    context.subscriptions.push(provider);


}

/**
 * Format an entire document. Registers as a DocumentFormattingEditProvider.
 */
async function formatDocument(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
    // Read config fresh (not cached) so user changes apply immediately
    const config = getFMTConfig();

    if (!config.enabled) {
        return [];
    }

    try {
        const originalText = document.getText();

        const formattedText = await runC3FMT(
            originalText,
            document.fileName,
            config.path,
            config.style,
            config.fallbackStyle);

        // Create an edit that replaces the entire document
        const entireDocument = new vscode.Range(
            document.positionAt(0),
            document.positionAt(originalText.length)
        );

        return [vscode.TextEdit.replace(entireDocument, formattedText)];
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errorAndShow(`Format failed: ${message}`);
        return [];
    }
}

/**
 * Run clang-format on the given text.
 */
function runC3FMT(fileName: string, path: string, configPath: string | undefined): Promise<string> {
    return new Promise((resolve, reject) => {
        // Build command-line arguments
        const args: string[] = [];

        if (configPath) {
            args.push(`${FMT_FLAGS.CONFIG_FILE}${configPath}`);
        } else {
            args.push(FMT_FLAGS.FORCE_DEFAULT);
        }

        args.push(FMT_FLAGS.IN_PLACE);



        // Spawn the process
        const proc: ChildProcess = spawn(path, args);
    });
}

async function installOrUpdateFMT(context: vscode.ExtensionContext): Promise<void> {
    const config = getFMTConfig();

}