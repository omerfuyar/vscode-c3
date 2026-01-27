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
            { language: C3_LANGUAGE_ID, scheme: 'file' },
            { language: C3_LANGUAGE_ID, scheme: 'untitled' },
        ],
        {
            provideDocumentFormattingEdits: formatDocument
        }
    );

    context.subscriptions.push(provider);

    UpdateOrInstallFMT(context.globalStorageUri);
}

/**
 * Format an entire document. Registers as a DocumentFormattingEditProvider.
 */
async function formatDocument(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
    const config = getFMTConfig();

    if (!config.enabled) {
        return [];
    }

    try {
        const formattedText = await runC3FMT(
            document.uri.fsPath,
            config.path!,
            config.configPath);

        const entireDocument = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
        );

        return [vscode.TextEdit.replace(entireDocument, formattedText)];
    } catch (err) {
        errorAndShow(`Format failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        return [];
    }
}

/**
 * Run clang-format on the given text.
 */
function runC3FMT(fileName: string, path: string, configPath: string | undefined): Promise<string> {
    return new Promise((resolve, reject) => {
        const args: string[] = [];

        if (configPath) {
            args.push(`${FMT_FLAGS.CONFIG_FILE}${configPath}`);
        } else {
            args.push(FMT_FLAGS.FORCE_DEFAULT);
        }

        args.push(FMT_FLAGS.STDOUT);
        args.push(fileName);

        const proc: ChildProcess = spawn(path, args);

        let stdout = '';
        let stderr = '';

        proc.stdout?.on('data', (chunk: Buffer) => {
            stdout += chunk.toString();
        });

        proc.stderr?.on('data', (chunk: Buffer) => {
            stderr += chunk.toString();
        });

        proc.on('error', (err) => {
            reject(new Error(`Failed to run formatter: ${err.message}`));
        });

        proc.on('close', (exitCode) => {
            if (exitCode !== 0) {
                reject(new Error(`Formatter exited with code ${exitCode}: ${stderr}`));
            } else {
                resolve(stdout);
            }
        });
    });
}

async function UpdateOrInstallFMT(directory: vscode.Uri): Promise<void> {
    const config = getFMTConfig();

    if (!config.path) {
        const choice = await vscode.window.showInformationMessage(
            'C3FMT is not installed. Would you like to install it now?',
            'Install',
            'Skip'
        );

        if (choice === 'Install') {
            await installFMT(directory);
        }
    }
}

async function installFMT(directory: vscode.Uri): Promise<void> {
    // get current and new version

    // compare
    // download if needed
    // extract
}
