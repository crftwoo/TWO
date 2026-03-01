// This script is injected into the TWO project website (comparador-ar.html)
// It acts as a bridge: The website cannot know the Extension ID dynamically,
// so the website posts a message to the window, and this script forwards it to the background.

window.addEventListener("message", (event) => {
    // We only accept messages from ourselves
    if (event.source !== window || !event.data || event.data.type !== "TWO_EXTENSION_REQUEST") {
        return;
    }

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
});
