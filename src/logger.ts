import * as vscode from 'vscode';
import { C3_LOG_NAME } from './constants';

let outputChannel: vscode.OutputChannel | null = null;

/**
 * Creates the output channel if it doesn't exist.
 */
export function initializeLogger(): void {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel(C3_LOG_NAME);
    } else {
        warning('Logger already initialized');
    }
}

/** 
 * Dispose the output channel.
 */
export function disposeLogger(): void {
    outputChannel?.dispose();
    outputChannel = null;
}

/**
 * Check if the logger is initialized.
 */
export function isLoggerInitialized(): boolean {
    return outputChannel !== null;
}

/**
 * Log an informational message. Must be initialized first.
 */
export function log(message: string, header: string): void {
    const timestamp = new Date().toISOString();

    outputChannel?.appendLine(`[${header}] : [${timestamp}] : ${message}`);
}

/**
 * Log a standard info message.
 */
export function info(message: string): void {
    log(message, 'INFO');
}

/**
 * Log an error message and show to user.
 */
export function infoAndShow(message: string): void {
    info(message);
    vscode.window.showInformationMessage(message);
}

/**
 * Log a standard warning message.
 */
export function warning(message: string): void {
    log(message, 'WARNING');
}

export function warningAndShow(message: string): void {
    warning(message);
    vscode.window.showWarningMessage(message);
}

/**
 * Log a standard error message.
 */
export function error(message: string, err?: unknown): void {
    log(`${message} ${err ? `: ${String(err)}` : ''}`, 'ERROR');
}

/**
 * Log an error message and show to user.
 */
export function errorAndShow(message: string, err?: unknown): void {
    error(message, err);
    vscode.window.showErrorMessage(message);
}

/**
 * Show the output channel to the user.
 */
export function showOutput(): void {
    outputChannel?.show();
}
