const CONFIG = {
    scriptUrl: 'https://raw.githubusercontent.com/moekkibux/nodeck/refs/heads/main/hosted/nodeck.js',
    imgSrc: 'https://example.org/nodeck/image/?token=foobar',
    commandPrefix: '/'
};

document.querySelectorAll('#w2g-rail-doit, #w2g-doit-corner, [data-google-query-id]').forEach(e => e.remove());
document.body.style.visibility = 'hidden';

// ====================================
// Logger
// ====================================
const Logger = (() => {
    const entries = [];
    const maxEntries = 100;

    function write(level, ...args) {
        const entry = {
            timeStamp: new Date(),
            level,
            args
        };

        entries.push(entry);

        if (entries.length > maxEntries) {
            entries.shift();
        }

        console[level]?.(...args) ?? console.log(...args);

        DebugOverlay.add(entry);
    }

    return {
        info: (...args) => write('info', ...args),
        warn: (...args) => write('warn', ...args),
        error: (...args) => write('error', ...args),
        clear: () => entries.splice(0),
        entries: () => [...entries]
    };
})();

// ====================================
// Debug Overlay
// ====================================
const DebugOverlay = (() => {
    let visible = false;

    const root = document.createElement('div');

    Object.assign(root.style, {
        position: 'fixed',
        left: '0',
        bottom: '0',
        width: '100%',
        maxHeight: '500px',
        overflowY: 'auto',
        padding: '8px',
        boxSizing: 'border-box',
        background: 'rgba(0,0,0,0.9)',
        color: '#00ff00',
        fontFamily: 'Consolas, monospace',
        fontSize: '12px',
        zIndex: '100',
        display: 'none',
        visibility: 'visible',
        whiteSpace: 'pre-wrap'
    });

    document.documentElement.appendChild(root);

    function format(value) {
        if (value instanceof Error) {
            return value.stack || value.message;
        }

        if (typeof value === 'object') {
            try {
                return JSON.stringify(value, null, 2);
            } catch {
                return '[Object]';
            }
        }

        return String(value);
    }

    return {
        add(entry) {
            const line = document.createElement('div');

            line.textContent = 
                `[${entry.timeStamp.toLocaleTimeString()}] ` +
                `[${entry.level.toUpperCase()}] ` +
                entry.args.map(format).join(' ');

            root.prepend(line);

            while (root.children.length > 100) {
                root.removeChild(root.lastChild);
            }
        },
        toggle() {
            visible = !visible;

            root.style.display =
                visible ? 'block' : 'none';

                return visible;
        },
        clear() {
            root.innerHTML = '';
        },
        show() {
            visible = true;
            root.style.display = 'block';
        },
        hide() {
            visible = false;
            root.style.display = 'none';
        },
        isVisible() {
            return visible;
        }
    };
})();

// ====================================
// Error Handling
// ====================================
window.addEventListener('error', event => {
    Logger.error(
        'Window Error',
        event.message,
        event.filename,
        `${event.lineno}:${event.colno}`
    );
});

window.addEventListener(
    'unhandledrejection',
    event => {
        Logger.error(
            'Unhandled Promise Rejection',
            event.reason
        );
    }
);

window.addEventListener(
    'securitypolicyviolation',
    event => {
        Logger.error('CSP violation', {
            violatedDirective: event.violatedDirective,
            effectiveDirective: event.effectiveDirective,
            blockedURI: event.blockedURI,
            sourceFile: event.sourceFile,
            lineNumber: event.lineNumber,
            columnNumber: event.columnNumber,
            disposition: event.disposition,
            sample: event.sample
        });
    });

// ====================================
// Command Registry
// ====================================
class CommandRegistry {
    constructor() {
        this.commands = new Map();
    }

    register(name, handler) {
        this.commands.set(
            name.toLowerCase(),
            handler
        );

        Logger.info(`Registered command: ${name}`);
    }

    execute(name, args) {
        const command =
        this.commands.get(
            name.toLowerCase()
        );

        if (!command) {
            Logger.warn(
                `Unknown command: ${name}`
            );

            return;
        }

        try {
            return command(args)
        } catch (error) {
            Logger.error(
                `Command failed: ${name}`,
                error
            );
        }
    }

    list() {
        return [...this.commands.keys()];
    }
}

const commands = new CommandRegistry();

// ====================================
// Built-In Commands
// ====================================
commands.register('debug', args => {
    if (args === 'clear') {
        DebugOverlay.clear();
        Logger.clear();

        return;
    }

    const enabled = DebugOverlay.toggle();

    Logger.info(
        `Debug overlay ${enabled ? 'enabled' : 'disabled'}`
    );
});

commands.register('help', () => {
    Logger.info(
        'Available commands:',
        commands.list().join(', ')
    );
});

commands.register('reload', () => {
    Logger.info('Reload command received');
    loadScript();
});

commands.register('state', () => {
    Logger.info({
        url: location.href,
        title: document.title,
        commands: commands.list(),
        loadedAt: window.__w2gLoadedAt
    });
});

// ====================================
// Chat Processing
// ====================================
function processChatMessage(message) {
    if (
        !message ||
        !message.startsWith(CONFIG.commandPrefix)
    ) {
        return;
    }

    const content =
        message.substring(
            CONFIG.commandPrefix.length
        );

    const firstSpace =
        content.indexOf(' ');

    const command =
        firstSpace === -1
            ? content
            : content.slice(0, firstSpace);

    const args =
        firstSpace === -1
            ? ''
            : content.slice(firstSpace + 1);

    Logger.info(
        'Executing command',
        command,
        args
    );
    
    commands.execute(command, args);
}

// ====================================
// W2G Chat Observer
// ====================================
const seen = new WeakSet(document.querySelectorAll('.w2g-message'));

function startChatObserver() {
    const observer = new MutationObserver((mutations) => {
        for (const { addedNodes } of mutations) {
            for (const n of addedNodes) {
                if (!(n instanceof HTMLElement)) continue;

                const message = n.matches('.w2g-message')
                    ? n
                    : n.querySelector('.w2g-message');

                if (!message || seen.has(message)) continue;
                seen.add(message);

                const text = message.querySelector(
                    '.leading-tight.overflow-hidden.text-sm.break-words'
                )?.textContent.trim();

                if (text) processChatMessage(text);
            }
        }
    });
    observer.observe(
        document.querySelector('.w2g-power-messages'), {
            childList: true,
            subtree: true
        }
    );

    Logger.info('Chat observer initialized');

    return observer;
}

        // const messages =
        //     document.querySelectorAll('.w2g-message');
        
        // const lastMessage =
        //     messages[messages.length - 1];

        // if (!lastMessage) return;

        // const text =
        //     lastMessage.textContent?.trim();

        // processChatMessage(text);

// ====================================
// Dynamic Script Loader
// ====================================
let scriptLoadInProgress = false;

async function loadScript() {
    if (scriptLoadInProgress) {
        Logger.warn('Script load already in progress');
        return;
    }

    scriptLoadInProgress = true;

    const scriptUrl = new URL(
        CONFIG.scriptUrl,
        window.location.href
    );

    scriptUrl.searchParams.set(
        't',
        Date.now().toString()
    );

    Logger.info(
        'Loading nodeck.js',
        scriptUrl.toString()
    );

    try {
        const source = await fetchScriptSource(scriptUrl);

        if (typeof window.__w2gCleanup === 'function') {
            Logger.info('Executing cleanup');

            try {
                await window.__w2gCleanup();
            } catch (error) {
                Logger.error('Cleanup failed', error);
            }
        }

        delete window.__w2gCleanup;

        executeScriptSource(
            source,
            scriptUrl.toString()
        );

        Logger.info(
            'nodeck.js executed successfully',
            scriptUrl.toString()
        );
    } catch (error) {
        Logger.error(
            'Failed loading or executing nodeck.js',
            error
        );
    } finally {
        scriptLoadInProgress = false;
    }
}

async function fetchScriptSource(scriptUrl) {
    let response;

    try {
        response = await fetch(
            scriptUrl.toString(), {
                method: 'GET',
                cache: 'no-store'
            }
        );
    } catch (error) {
        throw new Error(
            `Fetch failed: ${formatError(error)}`
        );
    }

    const contentType =
        response.headers.get('content-type') || 'unknown';

    Logger.info('Script response', {
        status: response.status,
        statusText: response.statusText,
        contentType,
        redirected: response.redirected,
        finalUrl: response.url
    });

    if (!response.ok) {
        const responseText =
            await response.text().catch(() => '');

        throw new Error(
            [
                `HTTP ${response.status} ${response.statusText}`,
                responseText.slice(0, 300)
            ].filter(Boolean).join('\n')
        );
    }

    const source = await response.text();

    if (!source.trim()) {
        throw new Error(
            'nodeck.js returned an empty response'
        );
    }

    const beginning =
        source.trimStart().slice(0, 100).toLowerCase();

    if (
        beginning.startsWith('<!doctype') ||
        beginning.startsWith('<html')
    ) {
        throw new Error(
            'Endpoint returned HTML instead of JavaScript'
        );
    }

    Logger.info(
        'nodeck.js downloaded', {
            characters: source.length,
            contentType
        }
    );

    return source;
}

function executeScriptSource(source, sourceUrl) {
    const sourceWithName =
        `${source}\n//# sourceURL=${sourceUrl}`;

    try {
        const execute = new Function(sourceWithName);
        execute();
    } catch(error) {
        throw new Error(
            [
                'Execution of nodeck.js failed',
                formatError(error)
            ].join('\n')
        );
    }
}

function formatError(error) {
    if (error instanceof Error) {
        return error.stack || error.message;
    }

    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}

// ====================================
// Public API
// ====================================
window.__w2g = {
    Logger,
    DebugOverlay,
    registerCommand:
        commands.register.bind(commands),
    executeCommand:
        commands.execute.bind(commands),
    reload:
        loadScript,
    processChatMessage
};

window.__w2gConfig = CONFIG;

window.__w2gLoadedAt =
    new Date().toISOString();

// ====================================
// Startup
// ====================================
Logger.info('Bootstrap starting');

startChatObserver();

loadScript();

Logger.info('Bootstrap complete');
