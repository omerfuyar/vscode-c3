import axios, { AxiosProgressEvent } from 'axios';
import decompress from 'decompress';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import * as vscode from 'vscode';

const chmod = promisify(fs.chmod);

export async function downloadAndExtractArtifact(
    /** e.g. `C3LSP` */
    title: string,
    /** e.g. `c3lsp` */
    executableName: string,
    /** e.g. inside `context.globalStorageUri` */
    installDir: vscode.Uri,
    artifactUrl: string,
    /** Extract arguments that should be passed to `tar`. e.g. `--strip-components=1` */
    extraTarArgs: string[]
): Promise<string> {
    return await vscode.window.withProgress(
        {
            title: `Installing ${title}`,
            location: vscode.ProgressLocation.Notification,
        },
        async (progress) => {
            progress.report({ message: `downloading ${title} zip...` });
            const response = await axios.get<ArrayBuffer>(artifactUrl, {
                responseType: 'arraybuffer',
                onDownloadProgress: (progressEvent: AxiosProgressEvent) => {
                    if (progressEvent.total) {
                        const increment =
                            (progressEvent.bytes / progressEvent.total) * 100;
                        progress.report({
                            message: progressEvent.progress
                                ? `downloading zip ${(progressEvent.progress * 100).toFixed()}%`
                                : 'downloading zip...',
                            increment: increment,
                        });
                    }
                },
            });

            const zipUri = vscode.Uri.joinPath(
                installDir,
                path.basename(artifactUrl)
            );
            const isWindows = process.platform === 'win32';
            // Delete old lsp folder
            try {
                await vscode.workspace.fs.delete(installDir, {
                    recursive: true,
                    useTrash: false,
                });
            } catch (err) {
                // Ignore error if directory doesn't exist
            }
            await vscode.workspace.fs.createDirectory(installDir);
            await vscode.workspace.fs.writeFile(
                zipUri,
                new Uint8Array(response.data)
            );

            progress.report({ message: 'Extracting...' });
            const zipPath = isWindows ? zipUri.path.slice(1) : zipUri.path;
            const installPath = isWindows
                ? installDir.path.slice(1)
                : installDir.path;

            // Filter out documentation/license files that contain underscores (e.g., LICENSE_MIT)
            const files = (await decompress(zipPath, installPath)).filter(
                (file) => !file.path.includes('_')
            );

            const exePath = vscode.Uri.joinPath(installDir, files[0].path).fsPath;
            await chmod(exePath, 0o755);

            return exePath;
        }
    );
}
