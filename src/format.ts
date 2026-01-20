import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';

function runClangFormat(
    text: string,
    fileName: string | undefined,
    formatterPath: string = 'clang-format',
    style: string | null = null,
    fallbackStyle: string | null = null
): Promise<string> {
    return new Promise((resolve, reject) => {
        const args: string[] = [];

        if (fileName) {
            args.push('-assume-filename', fileName);
        }

        if (style) {
            args.push(`--style=${style}`);
        }

        if (fallbackStyle) {
            args.push(`--fallback-style=${fallbackStyle}`);
        }

        const proc: ChildProcess = spawn(formatterPath, args);

        let stdout = '';
        let stderr = '';

        proc.stdout?.on('data', (data: Buffer) => (stdout += data.toString()));
        proc.stderr?.on('data', (data: Buffer) => (stderr += data.toString()));

        proc.on('error', reject);

        proc.on('close', (code: number | null) => {
            if (code !== 0) {
                return reject(new Error(`clang-format exited with code ${code}: ${stderr}`));
            }

            resolve(stdout);
        });

        proc.stdin?.end(text);
    });
}

export async function setupFormat(context: vscode.ExtensionContext): Promise<void> {
    const fmtConfig = vscode.workspace.getConfiguration('c3.format');
    const fmtPath = fmtConfig.get<string>('path') || 'clang-format';
    const fmtStyle = fmtConfig.get<string>('style') || null;
    const fmtFallbackStyle = fmtConfig.get<string>('fallbackStyle') || 'LLVM';

    context.subscriptions.push(
        // Format full document
        vscode.languages.registerDocumentFormattingEditProvider(
            [
                { language: 'c3', scheme: 'file' },     // files on disk
                { language: 'c3', scheme: 'untitled' }, // unsaved files
            ],
            {
                async provideDocumentFormattingEdits(
                    document: vscode.TextDocument
                ): Promise<vscode.TextEdit[]> {
                    try {
                        const input = document.getText();
                        const result = await runClangFormat(
                            input,
                            document.fileName,
                            fmtPath,
                            fmtStyle,
                            fmtFallbackStyle
                        );

                        const fullRange = new vscode.Range(
                            document.positionAt(0),
                            document.positionAt(input.length)
                        );

                        return [vscode.TextEdit.replace(fullRange, result)];
                    } catch (err) {
                        const error = err as Error;
                        vscode.window.showErrorMessage(
                            `Error formatting c3 document: ${error.message}`
                        );
                        return [];
                    }
                },
            }
        )
    );
}
