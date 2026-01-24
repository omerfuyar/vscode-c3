import * as vscode from 'vscode';
import { Trace } from 'vscode-languageclient';

/** 
 * Settings for the Language Server Protocol client 
 */
export interface LSPConfig {
    enabled: boolean;
    path: string | undefined;
    checkForUpdate: boolean;
    sendCrashReports: boolean;
    debug: boolean;
    trace: Trace;
    logPath: string | undefined;
    diagnosticsDelay: number;
}

const DEFAULT_LSP_CONFIG: LSPConfig = {
    enabled: true,
    path: undefined,
    checkForUpdate: true,
    sendCrashReports: false,
    debug: false,
    trace: Trace.Compact,
    logPath: undefined,
    diagnosticsDelay: 2000,
};

/** 
 * Settings for code formatting
 */
export interface FormatConfig {
    enabled: boolean;
    path: string;
    style: string | undefined;
    fallbackStyle: string;
}

const DEFAULT_FORMAT_CONFIG: FormatConfig = {
    enabled: false,
    path: 'clang-format',
    style: undefined,
    fallbackStyle: 'LLVM',
};

/** 
 * General C3 settings 
 */
export interface C3Config {
    stdlibPath: string | undefined;
}

/**
 * Get LSP-related settings.
 * Called fresh each time to pick up user changes without reload.
 */
export function getLSPConfig(): LSPConfig {
    const config = vscode.workspace.getConfiguration('c3.lsp');

    return {
        enabled: config.get<boolean>('enable', DEFAULT_LSP_CONFIG.enabled),
        path: config.get<string>('path'),
        checkForUpdate: config.get<boolean>('checkForUpdate', DEFAULT_LSP_CONFIG.checkForUpdate),
        sendCrashReports: config.get<boolean>('sendCrashReports', DEFAULT_LSP_CONFIG.sendCrashReports),
        debug: config.get<boolean>('debug', DEFAULT_LSP_CONFIG.debug),
        trace: config.get<Trace>('trace', DEFAULT_LSP_CONFIG.trace),
        logPath: config.get<string>('log.path'),
        diagnosticsDelay: config.get<number>('diagnosticsDelay', DEFAULT_LSP_CONFIG.diagnosticsDelay),
    };
}

/**
 * Get formatting-related settings.
 * Called fresh each time to pick up user changes without reload.
 */
export function getFormatConfig(): FormatConfig {
    const config = vscode.workspace.getConfiguration('c3.format');

    return {
        enabled: config.get<boolean>('enable', DEFAULT_FORMAT_CONFIG.enabled),
        path: config.get<string>('path', DEFAULT_FORMAT_CONFIG.path),
        style: config.get<string>('style'),
        fallbackStyle: config.get<string>('fallbackStyle', DEFAULT_FORMAT_CONFIG.fallbackStyle),
    };
}

/**
 * Get general C3 settings.
 */
export function getC3Config(): C3Config {
    const config = vscode.workspace.getConfiguration('c3');

    return {
        stdlibPath: config.get<string>('stdlib-path'),
    };
}

/**
 * Update a configuration value globally (user settings).
 */
export async function updateLSPPath(path: string | undefined): Promise<void> {
    const config = vscode.workspace.getConfiguration('c3.lsp');
    await config.update('path', path, vscode.ConfigurationTarget.Global);
}
