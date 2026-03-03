// This script is injected into the TWO project website (comparador-ar.html)
// It acts as a bridge: The website cannot know the Extension ID dynamically,
// so the website posts a message to the window, and this script forwards it to the background.

window.addEventListener("message", (event) => {
    // We only accept messages from ourselves
    if (event.source !== window || !event.data) {
        return;
    }

    if (event.data.type === "TWO_GET_COMPARADOR_DATA") {
        // Obter os dados diretamente do banco de dados da extensão
        chrome.storage.local.get(['comparador_data'], (result) => {
            window.postMessage({
                type: "TWO_RETURN_COMPARADOR_DATA",
                id: event.data.id,
                data: result.comparador_data || {}
            }, "*");
        });
        return;
    }

    if (event.data.type === "TWO_EXTENSION_REQUEST") {
        // Forward the request to the extension's background script
        chrome.runtime.sendMessage({
            action: "scrape",
            url: event.data.url
        }, (response) => {
            // Send the response back to the website
            window.postMessage({
                type: "TWO_EXTENSION_RESPONSE",
                id: event.data.id,
                data: response
            }, "*");
        });
    }
});

// Listener em tempo real: Se o banco de dados mudar (usuário clicou em Jogar p/ Comparador em alguma aba da loja)
// a ponte envia a atualização imediatamente para o site do comparador que já está aberto.
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.comparador_data) {
        window.postMessage({
            type: "TWO_RETURN_COMPARADOR_DATA",
            data: changes.comparador_data.newValue || {}
        }, "*");
    }
});
