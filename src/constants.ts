import { Trace } from "vscode-languageserver-protocol";
import { C3Config, FMTConfig, LSPConfig } from './config'

/** URL to fetch C3 LSP release information */
export const C3_LSP_RELEASES_URL = 'https://pherrymason.github.io/c3-lsp/releases.json';

/** URL to fetch C3FMT release information */
export const C3_FMT_RELEASES_URL = 'https://github.com/lmichaudel/c3fmt/releases';

/** Language ID registered for C3 files */
export const C3_LANGUAGE_ID = 'c3';

/** Name of the C3 log channel */
export const C3_LOG_NAME = 'C3';

/** File extensions that trigger the extension */
export const C3_FILE_EXTENSIONS = ['c3', 'c3i', 'c3t'];

/** Name shown in LSP client logs */
export const LSP_CLIENT_NAME = 'C3LSP';

/** ID used for LSP client */
export const LSP_CLIENT_ID = 'c3lsp';

/** Folder name for storing downloaded LSP binary */
export const LSP_INSTALL_FOLDER = 'c3lsp';

export const LSP_FLAGS = {
    C3C_PATH: '-c3c-path',
    DEBUG: '-debug',
    DIAGNOSTICS_DELAY: '-diagnostics-delay',
    LANG_VERSION: '-lang-version',
    LOG_PATH: '-log-path',
    SEND_CRASH_REPORTS: '-send-crash-reports',
    STDLIB_PATH: '-stdlib-path',
    VERSION: '-version',
} as const;

export const C3C_FLAGS = {
    VERSION: '--version',
} as const;

export const FMT_FLAGS = {
    CONFIG_FILE: '--config=',
    FORCE_DEFAULT: '--default',
    VERSION: '--version',
    STDOUT: '--stdout',
} as const;

//! Defaults in package.json must match with these values

export const DEFAULT_C3_CONFIG: C3Config = {
    c3cPath: undefined,
    stdlibPath: undefined
} as const;

export const DEFAULT_LSP_CONFIG: LSPConfig = {
    enabled: true,
    path: undefined,
    sendCrashReports: false,
    debug: false,
    trace: Trace.Compact,
    logPath: '',
    diagnosticsDelay: 2000,
    langVersion: undefined
} as const;

export const DEFAULT_FORMAT_CONFIG: FMTConfig = {
    enabled: false,
    path: undefined,
    configPath: undefined
} as const;