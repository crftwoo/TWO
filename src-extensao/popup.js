// Popup agora funciona como um comparador multi-lojas:
// carrega os dados da planilha e abre diretamente o link escolhido ao clicar no botão da loja.
const SHEET_URL = 'https://opensheet.elk.sh/1LLVFTzxoSakgqnjS_ws7GgYNKdEqP26H0Z7Fe5DEmcc/Página1';
const TIPO_ORDER = ['Hiwall', 'Piso Teto', 'Cassete'];

function createChip(label, value, currentValue, onSelect) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = label;

    if (value === currentValue) {
        chip.classList.add('selected');
    }

    chip.addEventListener('click', () => {
        onSelect(value);
    });

    return chip;
}

function formatBtusLabel(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';

    // captura blocos numéricos como vêm na planilha (ex: "9000", "12000", "22.000", "22000 a 24000")
    const nums = (s.match(/\d[\d.]*/g) || [])
        .map(n => parseInt(n.replace(/\./g, ''), 10)) // remove pontos de milhar antes de converter
        .filter(n => Number.isFinite(n) && n > 0);

    if (nums.length === 0) return `${s} Btus`;

    const formatInt = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

    // range explícito ("a") → usa " a "
    if (s.toLowerCase().includes(' a ') && nums.length >= 2) {
        return `${formatInt(nums[0])} a ${formatInt(nums[1])} Btus`;
    }

    if (nums.length === 1) {
        return `${formatInt(nums[0])} Btus`;
    }

    // fallback para múltiplos valores
    return `${nums.map(formatInt).join(' / ')} Btus`;
}

async function initPopup() {
    const resultsDiv = document.getElementById('results');
    if (!resultsDiv) return;

    resultsDiv.innerHTML = '<p class="info-msg">Carregando opções de ar-condicionado...</p>';

    try {
        const response = await fetch(SHEET_URL);
        if (!response.ok) {
            throw new Error('Não foi possível carregar a planilha.');
        }

        const rows = await response.json();

        // Remove filtro hardcoded "Dufrio"
        const validRows = rows.filter(row =>
            row &&
            typeof row.Site === 'string' &&
            row.Link
        );

        if (validRows.length === 0) {
            resultsDiv.innerHTML = '<p class="error-msg">Nenhum link configurado na planilha (colunas Site e Link).</p>';
            return;
        }

        // Organiza dados em estrutura: Tipo -> BTUs -> Ciclo -> Site -> Link
        const mapByTipo = {};
        validRows.forEach(row => {
            const tipo = (row.Tipo || '').trim();
            const btus = (row.BTUs || '').trim();
            const ciclo = (row.Ciclo || '').trim();
            const site = row.Site.trim();
            const link = row.Link.trim();

            if (!tipo || !btus || !ciclo || !site || !link) return;

            if (!mapByTipo[tipo]) {
                mapByTipo[tipo] = {};
            }
            if (!mapByTipo[tipo][btus]) {
                mapByTipo[tipo][btus] = {};
            }
            if (!mapByTipo[tipo][btus][ciclo]) {
                mapByTipo[tipo][btus][ciclo] = {};
            }
            // Mapeia por site
            if (!mapByTipo[tipo][btus][ciclo][site]) {
                mapByTipo[tipo][btus][ciclo][site] = link;
            }
        });

        // Tipos na ordem fixa pedida
        const tipos = TIPO_ORDER.filter(t => mapByTipo[t]).concat(
            Object.keys(mapByTipo).filter(t => !TIPO_ORDER.includes(t)).sort()
        );
        if (tipos.length === 0) {
            resultsDiv.innerHTML = '<p class="error-msg">Não foi possível organizar os dados de busca.</p>';
            return;
        }

        let selectedTipo = null;
        let selectedBtus = null;
        let selectedCiclo = null;

        resultsDiv.innerHTML = '';

        const container = document.createElement('div');
        container.className = 'filters-container';

        // Removed the hacky resetWrapper from here

        const errorsP = document.createElement('p');
        errorsP.className = 'error-msg';
        errorsP.style.display = 'none';

        // Grupo: Tipo (mostra sozinho no início e depois fica só a escolha)
        const tipoGroup = document.createElement('div');
        tipoGroup.className = 'filter-group';

        const tipoLabel = document.createElement('div');
        tipoLabel.className = 'filter-label';
        tipoLabel.style.display = 'flex';
        tipoLabel.style.justifyContent = 'space-between';
        tipoLabel.style.alignItems = 'center';

        const labelText = document.createElement('span');
        labelText.textContent = 'Tipo';

        // Discreto botão de reset embutido no label
        const resetBtn = document.createElement('span');
        resetBtn.innerHTML = '⟲ Limpar Filtros';
        resetBtn.className = 'hidden';
        resetBtn.style.color = '#71717a';
        resetBtn.style.cursor = 'pointer';
        resetBtn.style.textTransform = 'none';
        resetBtn.style.letterSpacing = '0';
        resetBtn.style.fontWeight = '500';
        resetBtn.style.fontSize = '10px';
        resetBtn.style.transition = 'color 0.2s';
        
        resetBtn.onmouseover = () => resetBtn.style.color = '#fff';
        resetBtn.onmouseout = () => resetBtn.style.color = '#71717a';

        resetBtn.onclick = () => {
            selectedTipo = null;
            selectedBtus = null;
            selectedCiclo = null;
            resetBtn.classList.add('hidden');
            btusGroup.classList.add('hidden');
            cicloGroup.classList.add('hidden');
            storesGroup.classList.add('hidden');
            errorsP.style.display = 'none';
            renderSummary();
            renderTipoChips();
        };

        tipoLabel.appendChild(labelText);
        tipoLabel.appendChild(resetBtn);

        const tipoRow = document.createElement('div');
        tipoRow.className = 'chip-row';

        function renderTipoChips() {
            tipoRow.innerHTML = '';

            // Depois de escolhido, mostra só o tipo selecionado no centro
            if (selectedTipo) {
                resetBtn.classList.remove('hidden');
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'chip selected';
                chip.textContent = selectedTipo;
                chip.disabled = true;
                tipoRow.appendChild(chip);
                return;
            }

            // Antes de escolher, mostra todas as opções
            tipos.forEach(tipo => {
                const chip = createChip(tipo, tipo, selectedTipo, (newTipo) => {
                    if (selectedTipo === newTipo) return;
                    selectedTipo = newTipo;
                    selectedBtus = null;
                    selectedCiclo = null;
                    errorsP.style.display = 'none';
                    renderTipoChips();
                    renderBtusChips();
                    renderCicloChips();
                    btusGroup.classList.remove('hidden');
                    cicloGroup.classList.add('hidden');
                    storesGroup.classList.add('hidden');
                    btusGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
                });
                tipoRow.appendChild(chip);
            });
        }

        tipoGroup.appendChild(tipoLabel);
        tipoGroup.appendChild(tipoRow);

        // Grupo: BTUs
        const btusGroup = document.createElement('div');
        btusGroup.className = 'filter-group';
        btusGroup.classList.add('hidden');

        const btusLabel = document.createElement('div');
        btusLabel.className = 'filter-label';
        btusLabel.textContent = 'BTUs';

        const btusRow = document.createElement('div');
        btusRow.className = 'chip-row';

        function getBtusOptions() {
            if (!selectedTipo) return [];
            const mapBtus = mapByTipo[selectedTipo] || {};
            return Object.keys(mapBtus).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
        }

        function renderBtusChips() {
            btusRow.innerHTML = '';
            const btusOptions = getBtusOptions();

            // Depois de escolhido, mostra só o BTU selecionado
            if (selectedBtus) {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'chip selected';
                chip.textContent = formatBtusLabel(selectedBtus);
                chip.disabled = true;
                btusRow.appendChild(chip);
                return;
            }

            // não pré-seleciona; só revela ciclo após clique do usuário
            if (!btusOptions.includes(selectedBtus)) selectedBtus = null;

            btusOptions.forEach(btus => {
                const chip = createChip(formatBtusLabel(btus), btus, selectedBtus, (newBtus) => {
                    if (selectedBtus === newBtus) return;
                    selectedBtus = newBtus;
                    selectedCiclo = null;
                    errorsP.style.display = 'none';
                    renderBtusChips();
                    renderCicloChips();
                    cicloGroup.classList.remove('hidden');
                    storesGroup.classList.add('hidden');
                    cicloGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
                });
                btusRow.appendChild(chip);
            });
        }

        btusGroup.appendChild(btusLabel);
        btusGroup.appendChild(btusRow);

        // Grupo: Ciclo
        const cicloGroup = document.createElement('div');
        cicloGroup.className = 'filter-group';
        cicloGroup.classList.add('hidden');

        const cicloLabel = document.createElement('div');
        cicloLabel.className = 'filter-label';
        cicloLabel.textContent = 'Ciclo';

        const cicloRow = document.createElement('div');
        cicloRow.className = 'chip-row';

        function getCicloOptions() {
            if (!selectedTipo || !selectedBtus) return [];
            const mapBtus = mapByTipo[selectedTipo] || {};
            const mapCiclo = mapBtus[selectedBtus] || {};
            return Object.keys(mapCiclo).sort();
        }

        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'summary-text hidden';

        function renderSummary() {
            if (!selectedTipo || !selectedBtus || !selectedCiclo) {
                summaryDiv.classList.add('hidden');
                summaryDiv.textContent = '';
                return;
            }
            const btusLabel = formatBtusLabel(selectedBtus);

            let emojiCycle = "❄️";
            const cicloLower = selectedCiclo.toLowerCase();
            if (cicloLower.includes('quente/frio') || cicloLower.includes('quente e frio') || cicloLower.includes('quente/ frio') || cicloLower.includes('quente / frio') || cicloLower.includes('quente frio') || cicloLower.includes('q/f')) {
                emojiCycle = "🔥❄️";
            }

            summaryDiv.textContent = `${emojiCycle} ${selectedTipo} · ${btusLabel} · ${selectedCiclo}`;
            summaryDiv.classList.remove('hidden');
        }

        function renderCicloChips() {
            cicloRow.innerHTML = '';
            const ciclos = getCicloOptions();

            // Depois de escolhido, mostra só o ciclo selecionado
            if (selectedCiclo) {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'chip selected';
                chip.textContent = selectedCiclo;
                chip.disabled = true;
                cicloRow.appendChild(chip);
                renderSummary();
                return;
            }

            // não pré-seleciona; só habilita pesquisa após clique do usuário
            if (!ciclos.includes(selectedCiclo)) selectedCiclo = null;

            ciclos.forEach(ciclo => {
                const chip = createChip(ciclo, ciclo, selectedCiclo, (newCiclo) => {
                    selectedCiclo = newCiclo;
                    errorsP.style.display = 'none';
                    renderCicloChips();
                    renderSummary();
                    renderStoreButtons();
                    storesGroup.classList.remove('hidden');
                    storesGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
                });
                cicloRow.appendChild(chip);
            });
        }

        cicloGroup.appendChild(cicloLabel);
        cicloGroup.appendChild(cicloRow);

        // Container para os botões das lojas
        const storesGroup = document.createElement('div');
        storesGroup.className = 'stores-group hidden';
        storesGroup.style.display = 'flex';
        storesGroup.style.flexDirection = 'column';
        storesGroup.style.gap = '8px';
        storesGroup.style.marginTop = '15px';

        function renderStoreButtons() {
            storesGroup.innerHTML = '';
            if (!selectedTipo || !selectedBtus || !selectedCiclo) return;

            const mapBtus = mapByTipo[selectedTipo] || {};
            const mapCiclo = mapBtus[selectedBtus] || {};
            const storeLinks = mapCiclo[selectedCiclo] || {};
            const availableStores = Object.keys(storeLinks);

            if (availableStores.length === 0) {
                errorsP.textContent = 'Nenhum site configurado para essa combinação.';
                errorsP.style.display = 'block';
                return;
            }

            availableStores.forEach(siteName => {
                const searchBtn = document.createElement('button');
                searchBtn.type = 'button';
                searchBtn.className = 'primary-btn';
                searchBtn.textContent = 'ABRIR NO ' + siteName.toUpperCase();

                // Cores dinâmicas simples para diferenciar botões baseadas no nome (opcional)
                if (siteName.toLowerCase().includes('dufrio')) {
                    searchBtn.style.backgroundColor = '#0056b3';
                } else if (siteName.toLowerCase().includes('leveros')) {
                    searchBtn.style.backgroundColor = '#009038'; // Verde da Leveros
                } else if (siteName.toLowerCase().includes('poloar')) {
                    searchBtn.style.backgroundColor = '#f26522'; // Laranja da Poloar
                }

                searchBtn.addEventListener('click', async () => {
                    errorsP.style.display = 'none';
                    const link = storeLinks[siteName];

                    if (!link) {
                        errorsP.textContent = `Link ausente para ${siteName}.`;
                        errorsP.style.display = 'block';
                        return;
                    }

                    try {
                        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                        if (tab && tab.id) {
                            await chrome.tabs.update(tab.id, { url: link });
                        } else {
                            await chrome.tabs.create({ url: link, active: true });
                        }
                        window.close();
                    } catch (err) {
                        console.error(`Erro ao abrir a aba ${siteName}:`, err);
                        errorsP.textContent = `Não foi possível abrir o link do ${siteName}.`;
                        errorsP.style.display = 'block';
                    }
                });

                storesGroup.appendChild(searchBtn);
            });
        }

        container.appendChild(tipoGroup);
        container.appendChild(btusGroup);
        container.appendChild(cicloGroup);
        container.appendChild(summaryDiv);
        container.appendChild(errorsP);
        container.appendChild(storesGroup);

        resultsDiv.appendChild(container);

        // Render inicial
        renderTipoChips();
    } catch (error) {
        console.error('Erro ao carregar planilha da Dufrio:', error);
        const message = error && error.message ? error.message : 'Erro desconhecido.';
        resultsDiv.innerHTML = `<p class="error-msg">Erro ao carregar os dados da planilha.<br>${message}</p>`;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPopup);
} else {
    initPopup();
}
