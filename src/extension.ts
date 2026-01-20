import * as vscode from 'vscode';
import { activate as activateLS, deactivate as deactivateLS } from './lsp';
import { setupC3 } from './setupC3';
import { setupFormat } from './format';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    await setupC3(context);
    await setupFormat(context);
    activateLS(context);
}

export async function deactivate(): Promise<void> {
    await deactivateLS();
}
