const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        // Define o viewport
        await page.setViewport({ width: 1280, height: 800 });

        // Abre a página local
        await page.goto('http://127.0.0.1:8080/ficha/1', { waitUntil: 'load', timeout: 30000 });

        // Clica na tab Magia
        await page.evaluate(() => {
            const tabs = document.querySelectorAll('.tablinks');
            for (let tab of tabs) {
                if (tab.textContent.includes('Magia')) {
                    tab.click();
                    break;
                }
            }
        });
        await new Promise(r => setTimeout(r, 1000));

        // Clica no botão "Adicionar Feitiço"
        await page.evaluate(() => {
            document.querySelector('.btn-add-magic').click();
        });
        await new Promise(r => setTimeout(r, 1000));

        // Preenche dados fictícios
        await page.evaluate(() => {
            document.getElementById('mag-modal-nome').value = 'Dragão de Fogo Negro';
            document.getElementById('mag-modal-escola').value = 'Evocação';
            document.getElementById('mag-modal-circulo').value = '3';
            document.getElementById('mag-modal-alcance').value = '18m';
            document.getElementById('mag-modal-alvo').value = 'Círculo de 6m';
            document.getElementById('mag-modal-duracao').value = 'Instantânea';
            document.getElementById('mag-modal-resistencia').value = 'Reflexos (Metade)';
            document.getElementById('mag-modal-efeito').value = 'Chamas escuras assolam a área, causando 8d6 de dano de fogo...';
        });

        // Salva a magia
        await page.evaluate(() => {
            document.querySelector('.magic-modal-footer .confirm').click();
        });
        await new Promise(r => setTimeout(r, 1000));

        // Tira print antes de abrir o view form
        await page.screenshot({ path: path.join('C:', 'Users', 'Thiago L', '.gemini', 'antigravity', 'brain', '1398893e-2b0e-432b-a8c7-ccadbac277a1', 'spell_list_1772902533814.webp'), type: 'webp' });

        // Clica na recém criada
        await page.evaluate(() => {
            document.querySelector('#lista-magias .mag-card-resumido:last-child').click();
        });
        await new Promise(r => setTimeout(r, 1000));

        // Tira print do view form (TCG card)
        await page.screenshot({ path: path.join('C:', 'Users', 'Thiago L', '.gemini', 'antigravity', 'brain', '1398893e-2b0e-432b-a8c7-ccadbac277a1', 'tcg_card_validation_1772902533814.webp'), type: 'webp' });

        await browser.close();
        console.log("Screenshots captured.");
    } catch (e) {
        console.log('Script Error:', e.message);
        process.exit(1);
    }
})();
