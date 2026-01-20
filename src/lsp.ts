import { platform, machine } from 'os';
import * as childProcess from 'child_process';
import axios from 'axios';
import * as semver from 'semver';
import * as vscode from 'vscode';
import { downloadAndExtractArtifact } from './utils';
import { LanguageClient, LanguageClientOptions, Executable } from 'vscode-languageclient/node';
import { Trace } from 'vscode-jsonrpc';

interface VersionData {
    version: string;
    artifacts: ArtifactMap;
}

interface ArtifactMap {
    [key: string]: {
        url: string;
    };
}

interface ReleaseResponse {
    releases: VersionData[];
}

interface FetchVersionResult {
    version: semver.SemVer;
    artifacts: ArtifactMap;
}

let client: LanguageClient | null = null;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const config = vscode.workspace.getConfiguration('c3');
    const lsConfig = vscode.workspace.getConfiguration('c3.lsp');
    const enabled = lsConfig.get<boolean>('enable');

    if (!enabled) {
        return;
    }

    const executablePath = lsConfig.get<string>('path');

    if (!executablePath) {
        return;
    }

    const args: string[] = [];
    if (lsConfig.get<boolean>('sendCrashReports')) {
        args.push('--send-crash-reports');
    }

    const logPath = lsConfig.get<string>('log.path');
    if (logPath && logPath !== '') {
        args.push(`--log-path=${logPath}`);
    }

    const diagnosticsDelay = lsConfig.get<number>('diagnosticsDelay');
    if (diagnosticsDelay) {
        args.push(`--diagnostics-delay=${diagnosticsDelay}`);
    }

    const stdlibPath = config.get<string>('stdlib-path');
    if (stdlibPath) {
        args.push(`--stdlib-path=${stdlibPath}`);
    }

    const runExecutable: Executable = {
        command: executablePath,
        args: args,
    };

    const debugExecutable: Executable = {
        command: executablePath,
        args: args,
    };

    const serverOptions = {
        run: runExecutable,
        debug: debugExecutable,
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        // Register the server for plain text documents
        documentSelector: [{ scheme: 'file', language: 'c3' }],
        synchronize: {
            // Notify the server about file changes to '.c3' or '.c3i' files contained in the workspace
            fileEvents: vscode.workspace.createFileSystemWatcher('**/*.{c3,c3i}'),
        },
    };

    if (lsConfig.get<boolean>('checkForUpdate')) {
        await checkUpdate(context);
    }

    client = new LanguageClient('C3LSP', serverOptions, clientOptions);
    if (lsConfig.get<boolean>('debug')) {
        client.setTrace(Trace.Verbose);
    }
    client.start();
}

export async function deactivate(): Promise<void> {
    if (client) {
        await client.stop();
        await client.dispose();
    }
    client = null;
}

async function fetchVersion(): Promise<FetchVersionResult | null> {
    let response: ReleaseResponse;
    try {
        response = (
            await axios.get<ReleaseResponse>(
                'https://pherrymason.github.io/c3-lsp/releases.json'
            )
        ).data;
    } catch (err) {
        console.log('Error: ', err);
        return null;
    }

    // Get latest version
    const versionData = response.releases.sort((current, next) =>
        current.version > next.version ? -1 : 1
    )[0];

    const parsedVersion = semver.parse(versionData.version);
    if (!parsedVersion) {
        return null;
    }

    return {
        version: parsedVersion,
        artifacts: versionData.artifacts,
    };
}

async function checkUpdate(context: vscode.ExtensionContext): Promise<void> {
    const configuration = vscode.workspace.getConfiguration('c3.lsp');
    const c3lspPath = configuration.get<string>('path');

    if (!c3lspPath) {
        return;
    }

    const currentVersion = getVersion(c3lspPath, '--version');
    if (!currentVersion) {
        return;
    }

    const result = await fetchVersion();
    if (!result) {
        return;
    }

    if (semver.gte(currentVersion, result.version)) {
        return;
    }

    const response = await vscode.window.showInformationMessage(
        'New version of C3LSP available: ' + result.version,
        'Install',
        'Ignore'
    );
    switch (response) {
        case 'Install':
            await installLSPVersion(context, result.artifacts);
            break;
        case 'Ignore':
        case undefined:
            break;
    }
}

export function getVersion(filePath: string, arg: string): semver.SemVer | null {
    try {
        const buffer = childProcess.execFileSync(filePath, [arg]);
        const versionString = buffer.toString('utf8').trim();

        return semver.parse(versionString);
    } catch {
        return null;
    }
}

export async function installLSPVersion(
    context: vscode.ExtensionContext,
    artifact: ArtifactMap
): Promise<void> {
    const key = machine() + '-' + platform();
    // example x86_64-win32
    if (!artifact[key]) {
        vscode.window.showErrorMessage(
            `No pre-build version available for your architecture/OS ${key}`
        );
        return;
    }

    const lsPath = await downloadAndExtractArtifact(
        'C3LSP',
        'c3lsp',
        vscode.Uri.joinPath(context.globalStorageUri, 'c3lsp_install'),
        artifact[key].url,
        []
    );

    const configuration = vscode.workspace.getConfiguration('c3.lsp', null);
    await configuration.update('path', lsPath ?? undefined, true);
}

export async function installLSP(context: vscode.ExtensionContext): Promise<void> {
    const result = await fetchVersion();
    if (!result) {
        return;
    }
    await installLSPVersion(context, result.artifacts);
}
