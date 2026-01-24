import * as vscode from 'vscode';
import { Trace } from 'vscode-languageclient';
import { C3_LANGUAGE_ID, DEFAULT_LSP_CONFIG, DEFAULT_FORMAT_CONFIG } from './constants';

/** 
 * General C3 settings 
 */
export interface C3Config {
    c3cPath: string | undefined;
    stdlibPath: string | undefined;
}

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
    logPath: string;
    diagnosticsDelay: number;
    langVersion: string | undefined;
}

/** 
 * Settings for code formatting
 */
export interface FormatConfig {
    enabled: boolean;
    path: string;
    style: string;
    fallbackStyle: string;
}

/**
 * Get fresh general C3 settings.
 */
export function getC3Config(): C3Config {
    const config = vscode.workspace.getConfiguration(C3_LANGUAGE_ID);

    return {
        c3cPath: config.get<string>('c3c-path'),
        stdlibPath: config.get<string>('stdlib-path'),
    };
}

/**
 * Get fresh LSP-related settings.
 */
export function getLSPConfig(): LSPConfig {
    const config = vscode.workspace.getConfiguration('c3.lsp');

    const parsedTrace = (() => {
        const traceStr = config.get<string>('trace');

        if (!traceStr) {
            return DEFAULT_LSP_CONFIG.trace;
        }

        switch (traceStr.toLowerCase()) {
            case 'off':
                return Trace.Off;
            case 'messages':
                return Trace.Messages;
            case 'verbose':
                return Trace.Verbose;
            case 'compact':
            default:
                return Trace.Compact;
        }
    })();

    return {
        enabled: config.get<boolean>('enabled', DEFAULT_LSP_CONFIG.enabled),
        path: config.get<string>('path'),
        checkForUpdate: config.get<boolean>('checkForUpdate', DEFAULT_LSP_CONFIG.checkForUpdate),
        sendCrashReports: config.get<boolean>('sendCrashReports', DEFAULT_LSP_CONFIG.sendCrashReports),
        debug: config.get<boolean>('debug', DEFAULT_LSP_CONFIG.debug),
        trace: parsedTrace,
        logPath: config.get<string>('log.path', DEFAULT_LSP_CONFIG.logPath),
        diagnosticsDelay: config.get<number>('diagnosticsDelay', DEFAULT_LSP_CONFIG.diagnosticsDelay),
        langVersion: config.get<string>('langVersion'),
    };
}

/**
 * Get fresh formatting-related settings.
 */
export function getFormatConfig(): FormatConfig {
    const config = vscode.workspace.getConfiguration('c3.format');

    return {
        enabled: config.get<boolean>('enabled', DEFAULT_FORMAT_CONFIG.enabled),
        path: config.get<string>('path', DEFAULT_FORMAT_CONFIG.path),
        style: config.get<string>('style', DEFAULT_FORMAT_CONFIG.style),
        fallbackStyle: config.get<string>('fallbackStyle', DEFAULT_FORMAT_CONFIG.fallbackStyle),
    };
}

/**
 * Update a configuration value globally (user settings).
 */
export async function updateLSPPath(path: string | undefined): Promise<void> {
    const config = vscode.workspace.getConfiguration('c3.lsp');
    await config.update('path', path, vscode.ConfigurationTarget.Global);
}
