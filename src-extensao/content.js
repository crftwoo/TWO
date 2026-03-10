(function () {
    // Evita injetar o painel mais de uma vez
    if (document.getElementById('dufrio-ext-panel')) return;

    // Variável global para guardar a lista atual de produtos para o botão 'Copiar Lista'
    let currentProductsList = [];

    function createPanel() {
        const panel = document.createElement('div');
        panel.id = 'dufrio-ext-panel';
        panel.classList.add('dufrio-ext-hidden'); // Starts hidden

        const header = document.createElement('div');
        header.id = 'dufrio-ext-header';

        const titleArea = document.createElement('div');
        titleArea.style.display = 'flex';
        titleArea.style.flexDirection = 'column';
        titleArea.style.gap = '5px';

        const titleSpan = document.createElement('span');
        titleSpan.id = 'dufrio-ext-main-title';

        // Define o título inicial com base no site atual
        const host = window.location.host;
        let pTitle = 'Ar condicionado - Dufrio';
        if (host.includes('leveros.com.br')) pTitle = 'Ar condicionado - Leveros';
        else if (host.includes('centralar.com.br')) pTitle = 'Ar condicionado - Central Ar';
        titleSpan.innerText = pTitle;

        titleSpan.style.whiteSpace = 'pre-line';

        const copyListBtn = document.createElement('button');
        copyListBtn.id = 'dufrio-ext-copy-list';
        copyListBtn.innerText = 'Copiar Lista 📋';
        copyListBtn.onclick = () => {
            if (currentProductsList.length === 0) return;

            const fullTitle = generateSmartTitle(currentProductsList);

            // Monta o texto de todos os produtos separados por linha e com o separador '_____' solicitado
            const listText = currentProductsList.map(p => formatProductText(p.title, p.spot, p.install)).join('\n\n_____\n\n');
            const titleText = fullTitle.split('\n').map(l => `*${l}*`).join('\n');
            const textToCopy = `${titleText}\n\n${listText}`;

            navigator.clipboard.writeText(textToCopy).then(() => {
                const originalText = copyListBtn.innerText;
                copyListBtn.innerText = 'Lista Copiada! ✔️';
                setTimeout(() => copyListBtn.innerText = originalText, 2000);
            });
        };

        const pushToCompareBtn = document.createElement('button');
        pushToCompareBtn.id = 'dufrio-ext-push-compare';
        pushToCompareBtn.innerText = 'Jogar p/ Comparador ⇄';
        pushToCompareBtn.onclick = () => {
            if (currentProductsList.length === 0) return;

            // Define qual é a loja atual baseada na URL
            const host = window.location.host;
            let currentStore = 'Dufrio';
            if (host.includes('leveros.com.br')) currentStore = 'Leveros';
            else if (host.includes('centralar.com.br')) currentStore = 'Central Ar';

            // Busca os dados antigos, mescla com a lista nova sob a key da loja atual e salva
            chrome.storage.local.get(['comparador_data'], (result) => {
                const data = result.comparador_data || {};
                const incomingTitle = generateSmartTitle(currentProductsList);

                // ISOLAMENTO DE PESQUISA: Se o contexto da pesquisa mudou (ex: era Hiwall 9000 e agora é Cassete 24000), limpar antes.
                if (data.metadata_title && data.metadata_title !== incomingTitle) {
                    Object.keys(data).forEach(k => delete data[k]);
                }

                data.metadata_title = incomingTitle;
                data[currentStore] = currentProductsList; // Sobrescreve a lista da loja para não duplicar infinitamente

                chrome.storage.local.set({ comparador_data: data }, () => {
                    const originalText = pushToCompareBtn.innerText;
                    pushToCompareBtn.innerText = 'Enviado! ✔️';
                    pushToCompareBtn.style.backgroundColor = '#28a745';
                    pushToCompareBtn.style.color = '#fff';
                    pushToCompareBtn.style.border = 'none';
                    setTimeout(() => {
                        pushToCompareBtn.innerText = originalText;
                        pushToCompareBtn.style.backgroundColor = '';
                        pushToCompareBtn.style.color = '';
                        pushToCompareBtn.style.border = '';
                    }, 2000);
                });
            });
        };

        const buttonsArea = document.createElement('div');
        buttonsArea.style.display = 'flex';
        buttonsArea.style.gap = '8px';
        buttonsArea.appendChild(copyListBtn);
        buttonsArea.appendChild(pushToCompareBtn);

        titleArea.appendChild(titleSpan);
        titleArea.appendChild(buttonsArea);

        const closeBtn = document.createElement('button');
        closeBtn.id = 'dufrio-ext-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => panel.classList.add('dufrio-ext-hidden');

        header.appendChild(titleArea);
        header.appendChild(closeBtn);

        const content = document.createElement('div');
        content.id = 'dufrio-ext-content';
        content.innerHTML = '<p style="text-align:center;">Buscando produtos...</p>';

        panel.appendChild(header);
        panel.appendChild(content);

        // Creates the floating trigger button wrapper
        const floatingWrapper = document.createElement('div');
        floatingWrapper.id = 'dufrio-ext-floating-wrapper';

        const floatingBtn = document.createElement('div');
        floatingBtn.id = 'dufrio-ext-floating-btn';
        floatingBtn.title = 'Abrir Busca Ar-Condicionado (Arraste para mover)';
        floatingBtn.innerHTML = '⇄';

        const floatingClose = document.createElement('div');
        floatingClose.id = 'dufrio-ext-floating-close';
        floatingClose.title = 'Remover botão da tela';
        floatingClose.innerHTML = '&times;';

        floatingClose.onclick = (e) => {
            e.stopPropagation();
            floatingWrapper.remove();
        };

        // Drag logic
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        floatingBtn.addEventListener('mousedown', (e) => {
            if (e.target.id === 'dufrio-ext-floating-close') return;
            isDragging = false;
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = floatingWrapper.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            // Remove right/bottom to rely purely on left/top during drag
            floatingWrapper.style.right = 'auto';
            floatingWrapper.style.bottom = 'auto';
            floatingWrapper.style.left = initialLeft + 'px';
            floatingWrapper.style.top = initialTop + 'px';

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        function onMouseMove(e) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                isDragging = true;
            }

            if (isDragging) {
                let newX = initialLeft + dx;
                let newY = initialTop + dy;

                const maxX = window.innerWidth - floatingWrapper.offsetWidth;
                const maxY = window.innerHeight - floatingWrapper.offsetHeight;

                newX = Math.max(0, Math.min(newX, maxX));
                newY = Math.max(0, Math.min(newY, maxY));

                floatingWrapper.style.left = newX + 'px';
                floatingWrapper.style.top = newY + 'px';
                
                // Prevent text selection while dragging
                e.preventDefault();
            }
        }

        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }

        floatingBtn.onclick = () => {
            if (!isDragging) {
                panel.classList.toggle('dufrio-ext-hidden');
            }
        };

        floatingWrapper.appendChild(floatingBtn);
        floatingWrapper.appendChild(floatingClose);

        document.body.appendChild(panel);
        document.body.appendChild(floatingWrapper);

        return content;
    }

    function extractData() {
        const host = window.location.host;
        if (host.includes('leveros.com.br')) return extractDataLeveros();
        if (host.includes('centralar.com.br')) return extractDataCentralAr();
        return extractDataDufrio();
    }

    // --- CENTRAL AR SCRAPER ---
    function extractDataCentralAr() {
        const products = [];
        const seenTitles = new Set();

        const cards = document.querySelectorAll('.pdc_product-item, .card-product, [class*="product-item"], [class*="product_item"]');

        if (cards.length === 0) {
            console.log("Central Ar Extrator: Seletores não encontraram produtos (0 cards).");
            return products;
        }

        cards.forEach(card => {
            try {
                // Título
                let titleEl = card.querySelector('a.name, .product-name, [class*="title"], h2, h3');
                if (!titleEl) return;
                const titleStr = titleEl.innerText.trim();

                // Imagem
                let imgSrc = 'https://via.placeholder.com/150?text=Sem+Foto';

                // O HTML da Central Ar usa <a class="thumb"><img src="https://castaticstorage..."></a>
                const imgEl = card.querySelector('a.thumb img, .thumb img, img[class*="thumb"]');

                if (imgEl) {
                    // Tenta achar a URL real em ordem de prioridade
                    const attrs = ['data-src', 'src', 'data-lazy-src', 'srcset'];
                    for (let attr of attrs) {
                        let potentialSrc = imgEl.getAttribute(attr);

                        // Garante que é uma string válida, não é base64 vazia e não é um ícone SVG
                        if (potentialSrc && typeof potentialSrc === 'string' && !potentialSrc.startsWith('data:image') && !potentialSrc.includes('.svg')) {

                            // Se tiver espaço (ex: srcset), pega só o primeiro link
                            if (potentialSrc.includes(' ')) {
                                potentialSrc = potentialSrc.split(' ')[0];
                            }

                            // Aceita se tiver nossa string alvo ou for uma imagem comum
                            if (potentialSrc.includes('castaticstorage') || potentialSrc.match(/\.(jpe?g|png|webp)/i)) {
                                // Corrige URLs relativas de protocolo (começando com //)
                                if (potentialSrc.startsWith('//')) {
                                    potentialSrc = 'https:' + potentialSrc;
                                }
                                imgSrc = potentialSrc;
                                break;
                            }
                        }
                    }
                }

                // Valores via Regex global no texto do card (Mais seguro contra mudanças de classes)
                let spotLine = "";
                let installLine = "";

                const cardText = card.innerText.replace(/\s+/g, ' ').trim();

                // Busca preço à vista (ex: R$ 1.619,10)
                // Usando lookahead para não pegar o valor da parcela se possível, ou pega o primeiro R$
                const priceMatches = [...cardText.matchAll(/r\$\s*[\d.,]+/gi)];

                if (priceMatches.length > 0) {
                    // Preço à vista costuma ser o primeiro valor grande que aparece
                    spotLine = priceMatches[0][0].trim() + " à vista";
                }

                // Busca preço parcelado (ex: ou R$ 1.799,00 em 10x de R$ 179,90 sem juros)
                const installmentMatch = cardText.match(/(?:ou\s+)?r\$\s*[\d.,]+\s*(?:em\s+)?\d+\s*x\s*de\s*r\$\s*[\d.,]+/i);
                if (installmentMatch) {
                    installLine = installmentMatch[0].replace(/sem juros/gi, '').trim();
                } else {
                    // Fallback se não tiver texto "ou" no parcelamento, mas tiver "10x"
                    const fallbackInst = cardText.match(/\d+\s*x\s*de\s*r\$\s*[\d.,]+/i);
                    if (fallbackInst) installLine = fallbackInst[0].trim();
                }

                if (!spotLine || (!installLine && !spotLine)) {
                    console.log("Central Ar Extrator: Produto ignorado pois não encontrou preço:", titleStr);
                    return;
                }

                if (!seenTitles.has(titleStr)) {
                    seenTitles.add(titleStr);
                    products.push({
                        title: titleStr,
                        image: imgSrc,
                        spot: spotLine,
                        install: installLine
                    });
                }
            } catch (e) { console.error('Central Ar Erro no card:', e); }
        });

        return products;
        return products;
    }

    // --- LEVEROS SCRAPER ---
    function extractDataLeveros() {
        const products = [];
        const seenTitles = new Set();

        // O Vue.js na Leveros pode atrasar a renderização. 
        // Vamos procurar pela classe base ou pelos containers data-v-*
        const cards = document.querySelectorAll('.card-product, [class*="card-product"]');

        // Filtra apenas os nós que realmente parecem ser o card principal de um produto
        // (precisa ter um título e uma imagem dentro)
        const mainCards = Array.from(cards).filter(c => {
            return c.querySelector('[class*="product__name"], [class*="product_name"]')
                && c.querySelector('img[class*="product__image"], img[class*="product_image"]');
        });

        if (mainCards.length === 0) {
            console.log("Leveros Extrator: Seletores não encontraram produtos prontos. A página pode estar carregando o Vue/Nuxt...");
            return products;
        }

        mainCards.forEach(card => {
            try {
                // Título
                const titleEl = card.querySelector('[class*="product__name"], [class*="product_name"]');
                if (!titleEl) return;
                const titleStr = titleEl.innerText.trim();

                // Imagem
                const imgEl = card.querySelector('img[class*="product__image"], img[class*="product_image"]');
                if (!imgEl) return;
                let imgSrc = imgEl.src || imgEl.getAttribute('data-src') || '';
                if (!imgSrc || imgSrc.includes('data:image')) return;

                // 1. Pega o preço total (que na Leveros é o valor base parcelado inteiro)
                // Pode vir como "card-product_price-per", "no-price-of", etc.
                const totalPriceEl = card.querySelector('[class*="price-no-price"], [class*="no-price"], [class*="price-per"]');
                let totalPrice = "";
                if (totalPriceEl) {
                    totalPrice = totalPriceEl.innerText.replace(/\s+/g, ' ').trim();
                }

                // 2. Pega o valor à vista (cash)
                const cashPriceEl = card.querySelector('[class*="prices-cash"]');
                let spotLine = "R$ 0,00 à vista";
                if (cashPriceEl) {
                    let cashRaw = cashPriceEl.innerText.replace(/\s+/g, ' ').trim();
                    // Limpa "ou" e "à vista" para pegar só o numeral, depois padroniza
                    let justNumber = cashRaw.replace(/ou\s*/gi, '').replace(/\s*à vista/gi, '').trim();
                    if (!justNumber.includes('R$')) justNumber = 'R$ ' + justNumber;
                    spotLine = justNumber + " à vista";
                } else if (totalPrice) {
                    spotLine = totalPrice + " à vista";
                }

                // 3. Pega o valor das parcelas
                const installEl = card.querySelector('[class*="price-installment"]');
                let installLine = "À vista"; // Fallback
                if (installEl && totalPrice) {
                    let installRaw = installEl.innerText.replace(/\s+/g, ' ').trim();
                    // Remove "sem juros", etc para ficar só "10x de R$189,40"
                    let justInstallment = installRaw.replace(/sem juros/gi, '').replace(/\s+/g, ' ').trim();
                    // Coloca espaço após R$ se não tiver
                    justInstallment = justInstallment.replace(/R\$/gi, 'R$ ');
                    // Padrão pedido: "ou R$ 1.894,00 em 10x de R$ 189,40"
                    installLine = `ou ${totalPrice} em ${justInstallment}`;
                } else if (installEl) {
                    installLine = installEl.innerText.replace(/sem juros/gi, '').trim();
                }

                if (!seenTitles.has(titleStr)) {
                    seenTitles.add(titleStr);
                    products.push({
                        title: titleStr,
                        image: imgSrc,
                        spot: spotLine,
                        install: installLine
                    });
                }
            } catch (e) {
                console.error("Erro ao extrair um produto da Leveros:", e);
            }
        });
        return products;
    }

    // --- DUFRIO SCRAPER ---
    function extractDataDufrio() {
        const products = [];
        const seenTitles = new Set();

        // Pelas imagens do usuário, podemos encontrar os produtos localizando os títulos
        // Cada título tem a classe específica 'product-item-link' e é um 'a'
        const titleLinks = document.querySelectorAll('a.product-item-link');

        if (titleLinks.length === 0) {
            console.log("Dufrio Extrator: Nenhum a.product-item-link encontrado na tela.");
            return products;
        }

        titleLinks.forEach(titleLink => {
            try {
                // O texto exato do título do produto
                const titleStr = titleLink.innerText.trim();

                // Ignorar se não for ar condicionado
                if (!titleStr.toLowerCase().includes('ar condicionado') && !titleStr.toLowerCase().includes('split')) {
                    return;
                }

                // A partir do título, subimos na árvore até encontrar o card do produto inteiro.
                // Na Dufrio, ele costuma ficar num 'li.item.product.product-item' ou numa 'div' que envelopa a foto e a info.
                // Vamos subir até achar alguém que tem a '.product-image-photo' (que é a imagem)
                const card = titleLink.closest('.product-item') || titleLink.closest('[class*="product-info"]').parentElement;

                if (!card) return;

                // 1. Pega imagem exata
                const imgEl = card.querySelector('img.product-image-photo, img.product-image');
                if (!imgEl) return;

                let imgSrc = imgEl.src || imgEl.getAttribute('data-src') || '';

                // Às vezes o srcset tem a imagem boa
                if (!imgSrc || imgSrc.includes('data:image')) {
                    const sourceEl = card.querySelector('source');
                    if (sourceEl && sourceEl.srcset) {
                        imgSrc = sourceEl.srcset.split(',')[0].split(' ')[0]; // pega a primeira url do srcset
                    }
                }

                if (!imgSrc || imgSrc.includes('data:image')) return;

                // 2. Extrai o Valor à Vista exato
                let spotLine = "";

                // Tenta extrair primeiro da nova classe spot-price que costuma ter o PIX
                const spotPriceEl = card.querySelector('.spot-price');
                if (spotPriceEl) {
                    spotLine = spotPriceEl.innerText.replace(/\s+/g, ' ').trim();
                }

                // Se não achar o .spot-price, faz o fallback para o sistema antigo
                if (!spotLine) {
                    let realPriceEl = card.querySelector('#cash_down');

                    if (!realPriceEl) {
                        const mainPriceContainer = card.querySelector('.discount-price') || card.querySelector('.main-price');
                        if (mainPriceContainer) {
                            realPriceEl = mainPriceContainer.querySelector('.price-wrapper');
                        }
                    }

                    if (!realPriceEl) {
                        const allWrappers = card.querySelectorAll('.price-wrapper');
                        if (allWrappers.length > 0) realPriceEl = allWrappers[allWrappers.length - 1];
                    }

                    if (realPriceEl && realPriceEl.innerText.includes('R$')) {
                        spotLine = realPriceEl.innerText.replace(/\s+/g, ' ').trim();

                        const siblingLabel = realPriceEl.parentElement ? realPriceEl.parentElement.querySelector('.price-label') : null;
                        const anyLabel = card.querySelector('.price-label');
                        const labelToUse = siblingLabel || anyLabel;

                        if (labelToUse) {
                            const labelText = labelToUse.innerText.replace(/\s+/g, ' ').trim();
                            if (!spotLine.includes(labelText)) {
                                spotLine += ' ' + labelText;
                            }
                        }
                    }
                }

                // 3. Extrai o Valor Parcelado exato
                // Vimos na imagem que ele fica num <p> logo abaixo do price container
                let installLine = "";
                // Tenta achar um <p> filho do card inteiro que contenha "ou R$" e "em"
                const ps = card.querySelectorAll('p');
                ps.forEach(p => {
                    const pText = p.innerText.toLowerCase();
                    if (pText.includes('ou r$') && (pText.includes('em') || pText.includes('x'))) {
                        installLine = p.innerText.replace(/\s+/g, ' ').trim(); // Limpa espaços e pulos de linha
                    }
                });

                // Se não encontrou preço, ignora o produto inteiramente (ex: indisponível/avise-me)
                if (!spotLine || !installLine) return;

                // Previne produtos duplicados na listagem
                if (!seenTitles.has(titleStr)) {
                    seenTitles.add(titleStr);
                    products.push({
                        title: titleStr,
                        image: imgSrc,
                        spot: spotLine,
                        install: installLine
                    });
                }
            } catch (e) { console.error('Dufrio Extrator Erro num card específico:', e); }
        });

        return products;
    }

    function extractProductInfo(titleStr) {
        const titleLower = titleStr.toLowerCase();

        let btuVal = null;
        const btuMatch = titleLower.match(/(\d{1,2}\.?\d{3})\s*btus?/);
        if (btuMatch) {
            btuVal = parseInt(btuMatch[1].replace('.', ''), 10);
        }

        const isQF = titleLower.includes('quente/frio') || titleLower.includes('quente e frio') || titleLower.includes('quente/ frio') || titleLower.includes('quente / frio') || titleLower.includes('quente frio') || titleLower.includes('q/f');
        const isSF = titleLower.includes('frio') && !isQF;

        let type = 'Hiwall'; // Padrão assume Hiwall para agrupar nomes genéricos com os explícitos
        if (titleLower.includes('teto')) {
            type = 'Piso Teto';
        } else if (titleLower.includes('cassete')) {
            type = 'Cassete';
        } else if (titleLower.includes('janela')) {
            type = 'de Janela';
        } else if (titleLower.includes('portátil') || titleLower.includes('portatil')) {
            type = 'Portátil';
        } else if (titleLower.includes('multi')) {
            type = 'Multi Split';
        } else if (titleLower.includes('split') || titleLower.includes('hiwall') || titleLower.includes('hi-wall') || titleLower.includes('hi wall')) {
            type = 'Hiwall';
        }

        return { btuVal, isQF, isSF, type };
    }

    function generateSmartTitle(productsList) {
        const host = window.location.host;
        let defaultTitle = 'Ar condicionado - Dufrio';
        if (host.includes('leveros.com.br')) defaultTitle = 'Ar condicionado - Leveros';
        else if (host.includes('centralar.com.br')) defaultTitle = 'Ar condicionado - Central Ar';

        if (!productsList || productsList.length === 0) return defaultTitle;

        const typesStats = {};

        productsList.forEach(p => {
            const info = extractProductInfo(p.title);
            if (!typesStats[info.type]) {
                typesStats[info.type] = { minBtu: Infinity, maxBtu: -Infinity, hasQF: false, hasSF: false };
            }
            if (info.btuVal) {
                if (info.btuVal < typesStats[info.type].minBtu) typesStats[info.type].minBtu = info.btuVal;
                if (info.btuVal > typesStats[info.type].maxBtu) typesStats[info.type].maxBtu = info.btuVal;
            }
            if (info.isQF) typesStats[info.type].hasQF = true;
            if (info.isSF) typesStats[info.type].hasSF = true;
        });

        const orderedTypes = ['Hiwall', 'Piso Teto', 'Cassete', 'de Janela', 'Portátil', 'Multi Split', 'Ar Condicionado'];
        const formatInt = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

        let titleLines = [];

        orderedTypes.forEach(t => {
            if (typesStats[t]) {
                const stats = typesStats[t];
                let btuString = "";
                if (stats.minBtu !== Infinity && stats.maxBtu !== -Infinity) {
                    if (stats.minBtu === stats.maxBtu) {
                        btuString = `${formatInt(stats.minBtu)} Btus`;
                    } else {
                        btuString = `${formatInt(stats.minBtu)} a ${formatInt(stats.maxBtu)} Btus`;
                    }
                }

                let cicloString = "";
                let emoji = "";

                if (stats.hasQF && stats.hasSF) {
                    cicloString = ""; // Sem emoji e sem ciclo se houver os dois na mesma matriz de tipo
                    emoji = "";
                } else if (stats.hasQF) {
                    cicloString = "Quente/Frio";
                    emoji = "🔥❄️ ";
                } else if (stats.hasSF) {
                    cicloString = "Só Frio";
                    emoji = "❄️ ";
                }

                const parts = [t];
                if (btuString) parts.push(btuString);
                if (cicloString) parts.push(cicloString);

                titleLines.push(`${emoji}${parts.join(' · ')}`.trim());
            }
        });

        return titleLines.join('\n');
    }

    // Brands considered Top Tier that deserve bold highlights in messages
    const HYPER_BRANDS = ['daikin', 'fujitsu', 'hitachi', 'trane', 'lg', 'samsung', 'gree', 'carrier', 'midea', 'hisense'];

    function boldPremiumBrand(title) {
        if (!title) return title;
        let formattedTitle = title;

        for (const b of HYPER_BRANDS) {
            // Usa regex com word boundaries se for LG, ou apenas ignore case
            let regex;
            if (b === 'lg') {
                regex = new RegExp(`\\b(${b})\\b`, 'i');
            } else {
                regex = new RegExp(`(${b})`, 'i');
            }

            if (regex.test(formattedTitle)) {
                // Envolve a marca com asteriscos *Marca* mantendo o texto original que deu match
                formattedTitle = formattedTitle.replace(regex, '*$1*');
                break; // Se achou uma marca principal, já destacou ela, não precisa buscar outras na mesma string
            }
        }
        return formattedTitle;
    }

    function formatProductText(title, spot, install) {
        let emojiCycle = "❄️"; // Default Só Frio
        const titleLower = title.toLowerCase();
        if (titleLower.includes('quente/frio') || titleLower.includes('quente e frio') || titleLower.includes('quente/ frio') || titleLower.includes('quente / frio') || titleLower.includes('quente frio') || titleLower.includes('q/f')) {
            emojiCycle = "🔥❄️";
        }
        const boldedTitle = boldPremiumBrand(title);
        return `${emojiCycle} ${boldedTitle}\n💰 ${spot}\n💳 ${install}`;
    }

    function parseSpotPrice(priceStr) {
        if (!priceStr) return Infinity;
        const match = priceStr.match(/R\$\s*([\d\.,]+)/);
        if (match) {
            let numStr = match[1].replace(/\./g, '').replace(',', '.');
            return parseFloat(numStr) || Infinity;
        }
        return Infinity;
    }

    function renderProducts(contentDiv, products) {
        if (products.length === 0) {
            contentDiv.innerHTML = '<p style="text-align:center;color:#666;">Nenhum ar condicionado encontrado ainda. A página pode estar carregando...</p>';
            return;
        }

        // Ordena os produtos do menor para o maior preço à vista
        products.sort((a, b) => parseSpotPrice(a.spot) - parseSpotPrice(b.spot));

        // Atualiza a lista global para o botão Copiar Lista
        currentProductsList = products;

        // Atualiza o título no cabeçalho da extensão com as métricas inteligentes
        const headerTitleSpan = document.getElementById('dufrio-ext-main-title');
        if (headerTitleSpan) {
            headerTitleSpan.innerText = generateSmartTitle(products);
        }

        contentDiv.innerHTML = '';
        products.forEach((p, index) => {
            const card = document.createElement('div');
            card.className = 'dufrio-ext-card';

            const img = document.createElement('img');
            img.src = p.image;

            // Container para todo o texto (título + preço à vista + preço parcelado)
            const textContainer = document.createElement('div');
            textContainer.className = 'dufrio-ext-text-container';
            textContainer.style.cursor = 'pointer';
            textContainer.title = 'Clique para copiar o texto inteiro';

            const title = document.createElement('div');
            title.className = 'dufrio-ext-title';
            title.innerText = p.title;

            const spot = document.createElement('div');
            spot.className = 'dufrio-ext-spot';
            spot.innerText = p.spot;

            const install = document.createElement('div');
            install.className = 'dufrio-ext-install';
            install.innerText = p.install;

            textContainer.appendChild(title);
            textContainer.appendChild(spot);
            textContainer.appendChild(install);

            // Copiar texto ao clicar nele
            textContainer.onclick = () => {
                const textToCopy = formatProductText(p.title, p.spot, p.install);
                navigator.clipboard.writeText(textToCopy).then(() => {
                    const originalBg = textContainer.style.backgroundColor;
                    textContainer.style.backgroundColor = '#d4edda'; // Verde clarinho de sucesso
                    setTimeout(() => textContainer.style.backgroundColor = originalBg, 500);
                });
            };

            // Copiar imagem ao clicar nela
            img.style.cursor = 'pointer';
            img.title = 'Clique para copiar a imagem';

            // ATENÇÃO: A Central Ar (castaticstorage) bloqueia o carregamento visual da imagem se usarmos crossOrigin
            // Mas a Dufrio e Leveros precisam disso para podermos extrair o canvas no clipboard_item depois.
            if (!window.location.host.includes('centralar')) {
                img.crossOrigin = "Anonymous";
            }

            img.onclick = async () => {
                if (window.location.host.includes('centralar')) {
                    try {
                        // Central Ar: Usa o Background Service Worker para realizar o fetch da imagem sem bloqueio CORS do site
                        const dataUrl = await new Promise((resolve, reject) => {
                            chrome.runtime.sendMessage(
                                { action: "fetchImageBackground", url: p.image },
                                (reply) => {
                                    if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
                                    if (reply && reply.success) resolve(reply.dataUrl);
                                    else reject(new Error(reply?.error || 'Erro BGW'));
                                }
                            );
                        });

                        // Converte o DataURL para PNG usando Canvas (evita erro de CSP bloqueando fetch de data: URIs)
                        await new Promise((resolve, reject) => {
                            const imgObj = new Image();
                            imgObj.onload = () => {
                                try {
                                    const canvas = document.createElement('canvas');
                                    canvas.width = imgObj.naturalWidth || imgObj.width;
                                    canvas.height = imgObj.naturalHeight || imgObj.height;
                                    const ctx = canvas.getContext('2d');
                                    ctx.fillStyle = '#FFFFFF';
                                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                                    ctx.drawImage(imgObj, 0, 0);

                                    canvas.toBlob(blob => {
                                        if (!blob) return reject(new Error("Falha ao criar blob do canvas intermediário"));

                                        const item = new ClipboardItem({ "image/png": blob });
                                        navigator.clipboard.write([item]).then(() => {
                                            const originalBorder = img.style.border;
                                            img.style.border = '3px solid #28a745';
                                            setTimeout(() => img.style.border = originalBorder, 500);
                                            resolve();
                                        }).catch(reject);
                                    }, "image/png");
                                } catch (e) {
                                    reject(e);
                                }
                            };
                            imgObj.onerror = reject;
                            imgObj.src = dataUrl;
                        });
                    } catch (err) {
                        console.error('Falha no proxy de background da Central Ar, copy link...', err);
                        fallbackCopyUrl();
                    }
                } else {
                    // Outros sites (Dufrio/Leveros): Usam Canvas convencional sem problemas de CORS porque injetamos crossOrigin="Anonymous"
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth || img.width;
                        canvas.height = img.naturalHeight || img.height;
                        const ctx = canvas.getContext('2d');

                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0);

                        canvas.toBlob(blob => {
                            if (!blob) throw new Error("Tainted canvas / CORS");

                            const item = new ClipboardItem({ "image/png": blob });
                            navigator.clipboard.write([item]).then(() => {
                                const originalBorder = img.style.border;
                                img.style.border = '3px solid #28a745'; // Verde nativo
                                setTimeout(() => img.style.border = originalBorder, 500);
                            }).catch(err => {
                                fallbackCopyUrl();
                            });
                        }, "image/png");

                    } catch (err) {
                        fallbackCopyUrl();
                    }
                }

                function fallbackCopyUrl() {
                    navigator.clipboard.writeText(p.image).then(() => {
                        const originalBorder = img.style.border;
                        img.style.border = '3px solid #ffc107';
                        setTimeout(() => img.style.border = originalBorder, 500);
                    });
                }
            };

            card.appendChild(img);
            card.appendChild(textContainer);

            contentDiv.appendChild(card);
        });
    }

    function init() {
        // Evita injetar múltiplos painéis
        if (document.getElementById('dufrio-ext-panel')) return;
        const contentDiv = createPanel();

        function tryExtract() {
            const products = extractData();
            if (products.length > 0) {
                renderProducts(contentDiv, products);
                return true;
            }
            return false;
        }

        // Tenta buscar no load
        if (!tryExtract()) {
            contentDiv.innerHTML = '<p style="text-align:center;">Aguardando o carregamento dos produtos na página...</p>';

            // Se não encontrou, o site pode usar renderização dinâmica pesada (como o Vue/Nuxt da Leveros).
            // Tenta a cada 1.5s até encontrar ou desistir após 10 tentativas (15s).
            let attempts = 0;
            const interval = setInterval(() => {
                attempts++;
                if (tryExtract() || attempts >= 10) {
                    clearInterval(interval);
                    if (attempts >= 10 && document.querySelectorAll('.dufrio-ext-card').length === 0) {
                        contentDiv.innerHTML = '<p style="text-align:center;color:#666;">Não foi possível carregar os produtos. A página mudou seu layout ou a busca está vazia.</p>';
                    }
                }
            }, 1500);
        }

        // MutationObserver para recarregar as buscas se rolar até o fim da página (infinite scroll / paginação Ajax)
        let lastScrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(lastScrollTimeout);
            lastScrollTimeout = setTimeout(() => {
                const products = extractData();
                if (products.length > (document.querySelectorAll('.dufrio-ext-card').length)) { // Só atualiza se achou mais
                    renderProducts(document.getElementById('dufrio-ext-content'), products);
                }
            }, 1000);
        });
    }

    // Ext listener para quando o comparador pedir um "Puxar Abas Abertas"
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "request_current_list") {
            if (typeof currentProductsList !== 'undefined' && currentProductsList.length > 0) {
                const host = window.location.host;
                let currentStore = 'Dufrio';
                if (host.includes('leveros.com.br')) currentStore = 'Leveros';
                else if (host.includes('centralar.com.br')) currentStore = 'Central Ar';

                sendResponse({
                    store: currentStore,
                    list: currentProductsList,
                    title: typeof generateSmartTitle === 'function' ? generateSmartTitle(currentProductsList) : null
                });
            } else {
                sendResponse(null);
            }
        }
    });

    // Dispara a extração assim que o DOM estiver pronto ou interativo
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        window.addEventListener('DOMContentLoaded', init);
    }
})();