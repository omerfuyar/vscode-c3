import * as vscode from 'vscode';
import * as cp from 'child_process';
import { restartLSP } from './lsp';
import { getLSPConfig, getFMTConfig } from './config';
import { errorAndShow, info, showOutput } from './logger';
import { C3C_FLAGS, FMT_FLAGS, LSP_FLAGS } from './constants';

/**
 * Register all extension commands.
 *!Must match with commands in package.json 
 */
export function registerCommands(context: vscode.ExtensionContext): void {
    // Restart LSP command
    const restartLSPCommand = vscode.commands.registerCommand('c3.restartLSP', async () => {
        await restartLSP(context);
    });

    // Show version info command
    const showVersionsCommand = vscode.commands.registerCommand('c3.showVersions', async () => {
        await showVersionInfo();
    });

    context.subscriptions.push(restartLSPCommand, showVersionsCommand);
}

/**
 * Show version information about installed tools.
 */
async function showVersionInfo(): Promise<void> {
    const lspConfig = getLSPConfig();
    const formatConfig = getFMTConfig();
    const lines: string[] = [];

    lines.push('\n=== C3 Extension Info ===');

    // LSP info
    lines.push(`\nLSP Path: ${lspConfig.path || 'Not configured'}`);
    if (lspConfig.path) {
        const lspVersion = getCommandVersion(lspConfig.path, [LSP_FLAGS.VERSION]);
        lines.push(`LSP Version: ${lspVersion || 'Not found'}`);
    }

    // Check for c3c in PATH
    const c3cVersion = getCommandVersion('c3c', [C3C_FLAGS.VERSION]);
    lines.push(`\nC3C Version: ${c3cVersion || 'Not found'}`);

    // Formatter info
    lines.push(`\nFormatter Path: ${formatConfig.path || 'Not configured'}`);
    if (formatConfig.path) {
        const formatterVersion = getCommandVersion(formatConfig.path, [FMT_FLAGS.VERSION]);
        lines.push(`Formatter Version: ${formatterVersion || 'Not found'}`);
    }

    info(lines.join('\n'));
    showOutput();
}

/**
 * Try to get version string from a command.
 */
function getCommandVersion(command: string, args: string[]): string | null {
    try {
        const result = cp.spawnSync(command, args, {
            encoding: 'utf-8',
            timeout: 5000
        });
        if (result.status === 0) {
            return result.stdout.trim();
        } else {
            errorAndShow(`Failed to execute command: ${command}`);
            return null;
        }
    } catch {
        errorAndShow(`Failed to execute command: ${command}`);
        return null;
    }
}