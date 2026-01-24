import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import { getFormatConfig } from './config';
import { C3_LANGUAGE_ID } from './constants';
import { errorAndShow } from './logger';
import { error } from 'console';

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
            provideDocumentFormattingEdits: formatDocument,
        }
    );

    // Register for cleanup when extension deactivates
    context.subscriptions.push(provider);
}

/**
 * Format an entire document.
 */
async function formatDocument(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
    // Read config fresh (not cached) so user changes apply immediately
    const config = getFormatConfig();

    try {
        const originalText = document.getText();

        const formattedText = await runClangFormat(
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
function runClangFormat(
    text: string,
    fileName: string | undefined,
    formatterPath: string,
    style: string | undefined,
    fallbackStyle: string
): Promise<string> {
    return new Promise((resolve, reject) => {
        // Build command-line arguments
        const args: string[] = [];

        if (fileName) {
            // Tell clang-format what file this is (helps it find .clang-format)
            args.push('-assume-filename', fileName);
        }

        if (style) {
            args.push(`--style=${style}`);
        }

        args.push(`--fallback-style=${fallbackStyle}`);

        // Spawn the process
        const proc: ChildProcess = spawn(formatterPath, args);

        // Collect output
        let stdout = '';
        let stderr = '';

        proc.stdout?.on('data', (chunk: Buffer) => {
            stdout += chunk.toString();
        });

        proc.stderr?.on('data', (chunk: Buffer) => {
            stderr += chunk.toString();
        });

        // Handle process errors (e.g., binary not found)
        proc.on('error', (err) => {
            reject(new Error(`Failed to run clang-format: ${err.message}`));
        });

        // Handle process completion
        proc.on('close', (exitCode) => {
            if (exitCode !== 0) {
                reject(new Error(`clang-format exited with code ${exitCode}: ${stderr}`));
            } else {
                resolve(stdout);
            }
        });

        // Send the text to format via stdin
        proc.stdin?.end(text);
    });
}
