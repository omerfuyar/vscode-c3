import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import axios, { AxiosProgressEvent } from 'axios';
import decompress from 'decompress';

/**
 * Download a zip/tar file from a URL, extract it, and return the path to the executable.
 */
export async function downloadAndExtractArtifact(title: string, installDir: vscode.Uri, artifactUrl: string): Promise<string> {
    return await vscode.window.withProgress(
        {
            title: `Installing ${title}`,
            location: vscode.ProgressLocation.Notification,
        },
        async (progress) => {
            // Download the archive
            progress.report({ message: `Downloading ${title}...` });

            const response = await axios.get<ArrayBuffer>(artifactUrl, {
                responseType: 'arraybuffer',
                onDownloadProgress: (event: AxiosProgressEvent) => {
                    // Update progress bar if we know the total size
                    if (event.total && event.progress) {
                        const percent = (event.progress * 100).toFixed(0);
                        progress.report({
                            message: `Downloading... ${percent}%`,
                            increment: (event.bytes / event.total) * 100,
                        });
                    }
                },
            });

            // Prepare the install directory
            const zipUri = vscode.Uri.joinPath(installDir, path.basename(artifactUrl));

            // Clean up any previous installation
            await vscode.workspace.fs.delete(installDir, {
                recursive: true,
                useTrash: false
            });

            // Create fresh directory and write the downloaded archive
            await vscode.workspace.fs.createDirectory(installDir);
            await vscode.workspace.fs.writeFile(zipUri, new Uint8Array(response.data));

            // Extract the archive
            progress.report({ message: 'Extracting...' });

            // Handle Windows path quirks (remove leading slash from /C:/...)
            const isWindows = process.platform === 'win32';
            const zipPath = isWindows ? zipUri.path.slice(1) : zipUri.path;
            const installPath = isWindows ? installDir.path.slice(1) : installDir.path;

            // Extract the archive
            const files = await decompress(zipPath, installPath);

            // Make the executable runnable
            const exePath = vscode.Uri.joinPath(installDir, files[0].path).fsPath;
            await fs.promises.chmod(exePath, 0o755);  // rwxr-xr-x

            return exePath;
        }
    );
}
