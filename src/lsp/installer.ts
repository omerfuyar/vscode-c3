import axios from 'axios';
import * as childProcess from 'child_process';
import * as semver from 'semver';
import * as vscode from 'vscode';
import * as conf from '../config';
import { platform, machine } from 'os';
import { downloadAndExtractArtifact } from '../utils';
import { C3_LSP_RELEASES_URL, LSP_FLAGS, LSP_INSTALL_FOLDER } from '../constants';
import * as log from '../logger';

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
export async function updateOrInstallLSP(directory: vscode.Uri): Promise<void> {
    const config = conf.getLSPConfig();

    if (!config.path) {
        log.warning('No LSP path configured, prompting setup');
        return promptLSPSetup(directory);
    }

    const current = getInstalledVersion(config.path);
    if (!current) {
        log.error('Could not determine current LSP version, reinstall prompting');
        return promptLSPSetup(directory);
    }

    log.info(`Current LSP version: ${current.version}`);

    const latest = await getLatestReleaseInfo();
    if (!latest) {
        log.error('Could not fetch latest LSP version');
        return;
    }

    if (semver.gte(current, latest.version)) {
        log.info('LSP is up to date');
        return;
    }

    log.warning(`Update available: ${latest.version}`);

    log.info('Prompting user to update LSP');
    const choice = await vscode.window.showInformationMessage(
        `C3 LSP update available: ${latest.version}`,
        'Update',
        'Later'
    );

    if (choice === 'Update') {
        await downloadAndInstallVersion(directory, latest.artifacts);
    }
}

/**
 * Setup the LSP if it does not exist.
 */
async function promptLSPSetup(directory: vscode.Uri): Promise<void> {
    log.info('Prompting user to set up C3 LSP');
    const choice = await vscode.window.showInformationMessage(
        'C3 Language Server provides autocomplete, log.error checking, and more. Set it up now?',
        { modal: false },
        'Download And install',
        'Browse...',
        "Skip"
    );

    switch (choice) {
        case 'Download And install':
            log.info('User chose to download LSP');
            await installLSP(directory);
            break;

        case 'Browse...':
            log.info('User chose to browse for LSP');
            await promptForBinaryPath();
            break;

        case "Skip":
            log.info('User chose to skip LSP setup');
            break;

        default:
            log.info('User dismissed LSP setup dialog');
    }
}

async function installLSP(directory: vscode.Uri): Promise<void> {
    const latest = await getLatestReleaseInfo();
    if (!latest) {
        log.error('Could not fetch latest LSP version for installation');
        return;
    }

    await downloadAndInstallVersion(directory, latest.artifacts);
}

/**
 * Show a file picker for the user to select their LSP binary.
 */
async function promptForBinaryPath(): Promise<void> {
    log.info('Prompting user to select LSP binary');
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
        log.info(`LSP path set to: ${filePath}`);
    }
}

/**
 * Fetch the latest version log.info from the release server.
 */
async function getLatestReleaseInfo(): Promise<ReleaseInfo | null> {
    log.info('Fetching C3 LSP releases...');
    const response = await axios.get<ReleasesResponse>(C3_LSP_RELEASES_URL);
    const releases = response.data.releases;

    if (!releases || !Array.isArray(releases) || releases.length === 0) {
        log.error('No releases found in response');
        return null;
    }

    const latest = releases.sort((a, b) => semver.rcompare(a.version, b.version)).at(0)!;

    const parsed = semver.parse(latest.version);

    if (!parsed) {
        log.error(`Invalid version format: ${latest.version}`);
        return null;
    }

    log.info(`Latest version: ${parsed.version}`);
    return { version: parsed, artifacts: latest.artifacts };
}

/**
 * Get the version of an installed LSP binary.
 */
function getInstalledVersion(binaryPath: string): semver.SemVer | null {
    const output = childProcess.execFileSync(binaryPath, [LSP_FLAGS.VERSION]);
    const versionStr = output.toString('utf8').trim();
    return semver.parse(versionStr);
}

/**
 * Download and install the LSP binary for the current platform.
 */
async function downloadAndInstallVersion(directory: vscode.Uri, artifacts: ArtifactMap): Promise<void> {
    const platformKey = `${machine()}-${platform()}`;

    log.info(`Platform: ${platformKey}`);

    const artifact = artifacts[platformKey];

    if (!artifact) {
        const msg = `No C3 LSP binary available for: ${platformKey}`;
        log.errorAndShow(msg);
        return;
    }

    const installDir = vscode.Uri.joinPath(
        directory,
        LSP_INSTALL_FOLDER
    );

    try {
        const binaryPath = await downloadAndExtractArtifact('C3LSP', installDir, artifact.url);
        await conf.updateLSPPath(binaryPath);

        log.infoAndShow(`LSP installed at: ${binaryPath}`);
    } catch {
        log.errorAndShow('Failed to install C3 LSP binary');
    }
}
