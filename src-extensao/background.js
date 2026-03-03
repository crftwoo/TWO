// Listen for messages from the bridge content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scrape" && request.url) {

        // Return a Promise or return true to indicate async response
        handleScrapeRequest(request.url).then(data => {
            sendResponse({ success: true, data: data });
        }).catch(err => {
            sendResponse({ success: false, error: err.message });
        });

        return true; // Keep the message channel open for the async response
    }

    if (request.action === "pullTabs") {
        chrome.tabs.query({
            url: [
                "*://*.dufrio.com.br/*",
                "*://*.leveros.com.br/*",
                "*://*.centralar.com.br/*"
            ]
        }, (tabs) => {
            let responsesNeeded = tabs.length;
            if (responsesNeeded === 0) {
                sendResponse({ success: true, message: "No tabs found" });
                return;
            }

            let collectedData = {};

            const finalize = () => {
                const storesFound = Object.keys(collectedData).length;
                if (storesFound === 0) {
                    sendResponse({ success: false, message: "Nenhum produto nas Lojas Abertas" });
                    return;
                }

                chrome.storage.local.get(['comparador_data'], (result) => {
                    const data = result.comparador_data || {};
                    for (const [store, storeData] of Object.entries(collectedData)) {
                        data[store] = storeData.list;
                        if (storeData.title) data.metadata_title = storeData.title;
                    }
                    chrome.storage.local.set({ comparador_data: data }, () => {
                        sendResponse({ success: true, count: storesFound });
                    });
                });
            };

            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, { action: "request_current_list" }, (response) => {
                    if (!chrome.runtime.lastError && response && response.store && response.list && response.list.length > 0) {
                        collectedData[response.store] = {
                            list: response.list,
                            title: response.title
                        };
                    }
                    responsesNeeded--;
                    if (responsesNeeded === 0) finalize();
                });
            });
        });
        return true; // Keep message channel open for async response
    }

    if (request.action === "fetchImageBackground" && request.url) {
        fetch(request.url)
            .then(res => res.blob())
            .then(blob => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    sendResponse({ success: true, dataUrl: reader.result });
                };
                reader.onerror = () => {
                    sendResponse({ success: false, error: "Failed to read blob" });
                };
                reader.readAsDataURL(blob);
            })
            .catch(err => {
                sendResponse({ success: false, error: err.message });
            });
        return true; // Keep channel open for async fetch
    }
});

async function handleScrapeRequest(url) {
    // Create a new tab in the background (active: false)
    const tab = await chrome.tabs.create({ url: url, active: false });

    return new Promise((resolve, reject) => {
        // Wait for the tab to finish loading
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === tab.id && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);

                // Once loaded, execute the scraping script inside that tab
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: scrapePageLogic
                }, (results) => {
                    // Close the tab so the user doesn't notice it lingering
                    chrome.tabs.remove(tab.id);

                    if (chrome.runtime.lastError) {
                        return reject(new Error(chrome.runtime.lastError.message));
                    }

                    if (results && results[0] && results[0].result) {
                        resolve(results[0].result);
                    } else {
                        resolve([]); // No products found
                    }
                });
            }
        });

        // Timeout safeguard: if the page takes more than 15s to load, kill it and return error
        setTimeout(() => {
            try {
                chrome.tabs.remove(tab.id);
            } catch (e) { }
            reject(new Error("Timeout waiting for page to load."));
        }, 15000);
    });
}

// This function runs in the context of the target webpage (e.g. Dufrio or Leveros)
function scrapePageLogic() {
    const products = [];
    const url = window.location.href;

    if (url.includes('dufrio.com.br')) {
        const titleLinks = document.querySelectorAll('a.product-item-link');

        titleLinks.forEach(titleLink => {
            try {
                const titleStr = titleLink.innerText.trim();
                const card = titleLink.closest('.product-item') || titleLink.closest('[class*="product-info"]').parentElement;
                if (!card) return;

                const imgEl = card.querySelector('img.product-image-photo, img.product-image');
                let imgSrc = '';
                if (imgEl) {
                    imgSrc = imgEl.src || imgEl.getAttribute('data-src') || '';
                    if (!imgSrc || imgSrc.includes('data:image')) {
                        const sourceEl = card.querySelector('source');
                        if (sourceEl && sourceEl.srcset) {
                            imgSrc = sourceEl.srcset.split(',')[0].split(' ')[0];
                        }
                    }
                }

                let spotLine = "";
                const spotPriceEl = card.querySelector('.spot-price');
                if (spotPriceEl) {
                    spotLine = spotPriceEl.innerText.replace(/\s+/g, ' ').trim();
                }
                if (!spotLine) {
                    let realPriceEl = card.querySelector('#cash_down') || card.querySelector('.discount-price .price-wrapper') || card.querySelector('.main-price .price-wrapper');
                    if (!realPriceEl) {
                        const allWrappers = card.querySelectorAll('.price-wrapper');
                        if (allWrappers.length > 0) realPriceEl = allWrappers[allWrappers.length - 1];
                    }
                    if (realPriceEl && realPriceEl.innerText.includes('R$')) {
                        spotLine = realPriceEl.innerText.replace(/\s+/g, ' ').trim();
                        const labelToUse = (realPriceEl.parentElement ? realPriceEl.parentElement.querySelector('.price-label') : null) || card.querySelector('.price-label');
                        if (labelToUse) {
                            const labelText = labelToUse.innerText.replace(/\s+/g, ' ').trim();
                            if (!spotLine.includes(labelText)) spotLine += ' ' + labelText;
                        }
                    }
                }

                let installLine = "";
                const ps = card.querySelectorAll('p');
                ps.forEach(p => {
                    const pText = p.innerText.toLowerCase();
                    if (pText.includes('ou r$') && (pText.includes('em') || pText.includes('x'))) {
                        installLine = p.innerText.replace(/\s+/g, ' ').trim();
                    }
                });

                if (spotLine && installLine) {
                    products.push({
                        title: titleStr,
                        image: imgSrc,
                        spot: spotLine,
                        install: installLine
                    });
                }
            } catch (e) { }
        });
    }

    return products;
}
