import axios from 'axios';
import * as childProcess from 'child_process';
import * as semver from 'semver';
import * as vscode from 'vscode';
import * as conf from '../config';
import { platform, machine } from 'os';
import { downloadAndExtractArtifact } from '../utils';
import { C3_LSP_RELEASES_URL, LSP_INSTALL_FOLDER, SKIP_LSP_SETUP_KEY } from '../constants';
import { info, error, warning, errorAndShow, infoAndShow } from '../logger';

/** 
 * Map of platform keys (e.g., "x86_64-linux") to download URLs 
 */
interface ArtifactMap {
    [platformKey: string]: {
        url: string;
    };
}

/**
 * Raw release data from the API (version is string before parsing)
 */
interface RawReleaseInfo {
    version: string;
    artifacts: ArtifactMap;
}

/**
 * Response structure from releases.json endpoint
 */
interface ReleasesResponse {
    releases: RawReleaseInfo[];
}

/** 
 * A release version with download artifacts for each platform 
 */
interface ReleaseInfo {
    version: semver.SemVer;
    artifacts: ArtifactMap;
}

/**
 * Check if a newer version is available or is it installed. Prompt user to update or setup if so.
 */
export async function checkForUpdates(context: vscode.ExtensionContext): Promise<void> {
    const config = conf.getLSPConfig();
    if (!config.path) {
        warning('No LSP path configured, prompting setup');
        return promptLSPSetup(context);
    }

    // Get current version
    const current = getInstalledVersion(config.path);
    if (!current) {
        error('Could not determine current LSP version, reinstall prompting');
        return promptLSPSetup(context);
    }

    info(`Current LSP version: ${current.version}`);

    // Get latest version
    const latest = await fetchLatestVersion();
    if (!latest) {
        error('Could not fetch latest LSP version');
        return;
    }

    // Compare
    if (semver.gte(current, latest.version)) {
        info('LSP is up to date');
        return;
    }

    // Prompt user
    warning(`Update available: ${latest.version}`);

    info('Prompting user to update LSP');
    const choice = await vscode.window.showInformationMessage(
        `C3 LSP update available: ${latest.version}`,
        'Update',
        'Later'
    );

    if (choice === 'Update') {
        await downloadAndInstallVersion(context, latest.artifacts);
    }
}

/**
 * Setup the LSP if it does not exist.
 */
export async function promptLSPSetup(context: vscode.ExtensionContext): Promise<void> {
    const config = conf.getLSPConfig();

    // Already configured - nothing to do
    if (config.path) {
        info('LSP path already configured');
        return;
    }

    // User previously said "Don't ask again"
    if (context.globalState.get<boolean>(SKIP_LSP_SETUP_KEY)) {
        info('LSP setup skipped (user preference)');
        return;
    }

    // Ask user what they want to do
    info('Prompting user to set up C3 LSP');
    const choice = await vscode.window.showInformationMessage(
        'C3 Language Server provides autocomplete, error checking, and more. Set it up now?',
        { modal: false },  // Non-blocking dialog
        'Download And install',
        'Browse...',
        "Don't ask again"
    );

    switch (choice) {
        case 'Download And install':
            info('User chose to download LSP');
            await installLSP(context);
            break;

        case 'Browse...':
            info('User chose to browse for LSP');
            await promptForBinaryPath();
            break;

        case "Don't ask again":
            info('User chose to skip LSP setup permanently');
            await context.globalState.update(SKIP_LSP_SETUP_KEY, true);
            break;

        default:
            // User dismissed the dialog
            info('User dismissed LSP setup dialog');
    }
}

async function installLSP(context: vscode.ExtensionContext): Promise<void> {
    const latest = await fetchLatestVersion();
    if (!latest) {
        error('Could not fetch latest LSP version for installation');
        return;
    }

    await downloadAndInstallVersion(context, latest.artifacts);
}

/**
 * Show a file picker for the user to select their LSP binary.
 */
async function promptForBinaryPath(): Promise<void> {
    info('Prompting user to select LSP binary');
    const selected = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        title: 'Select C3 Language Server executable',
        openLabel: 'Select',
    });

    if (selected && selected.length > 0) {
        const filePath = selected[0].fsPath;

        await conf.updateLSPPath(filePath);
        info(`LSP path set to: ${filePath}`);
    }
}

/**
 * Fetch the latest version info from the release server.
 */
async function fetchLatestVersion(): Promise<ReleaseInfo | null> {
    info('Fetching C3 LSP releases...');
    const response = await axios.get<ReleasesResponse>(C3_LSP_RELEASES_URL);
    const releases = response.data.releases;

    if (!releases || !Array.isArray(releases) || releases.length === 0) {
        error('No releases found in response');
        return null;
    }

    // Sort by version (descending) and take the first
    const latest = releases.sort((a, b) => semver.rcompare(a.version, b.version)).at(0)!;

    const parsed = semver.parse(latest.version);

    if (!parsed) {
        error(`Invalid version format: ${latest.version}`);
        return null;
    }

    info(`Latest version: ${parsed.version}`);
    return { version: parsed, artifacts: latest.artifacts };
}

/**
 * Get the version of an installed LSP binary.
 */
function getInstalledVersion(binaryPath: string): semver.SemVer | null {
    const output = childProcess.execFileSync(binaryPath, ['--version']);
    const versionStr = output.toString('utf8').trim();
    return semver.parse(versionStr);
}

/**
 * Download and install the LSP binary for the current platform.
 */
async function downloadAndInstallVersion(context: vscode.ExtensionContext, artifacts: ArtifactMap): Promise<void> {
    // Determine platform key (e.g., "x86_64-linux", "arm64-darwin")
    const platformKey = `${machine()}-${platform()}`;

    info(`Platform: ${platformKey}`);

    const artifact = artifacts[platformKey];

    if (!artifact) {
        const msg = `No C3 LSP binary available for: ${platformKey}`;
        errorAndShow(msg);
        return;
    }

    // Download and extract
    const installDir = vscode.Uri.joinPath(
        context.globalStorageUri,
        LSP_INSTALL_FOLDER
    );

    try {
        const binaryPath = await downloadAndExtractArtifact('C3LSP', installDir, artifact.url);
        // Update settings
        await conf.updateLSPPath(binaryPath);

        infoAndShow(`LSP installed at: ${binaryPath}`);
    } catch {
        errorAndShow('Failed to install C3 LSP binary');
    }
}
