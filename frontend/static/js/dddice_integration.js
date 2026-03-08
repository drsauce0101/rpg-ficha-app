// =============================================================================
// GIHARAD x DDDICE INTEGRATION
// =============================================================================
// Dependência: <script src="https://cdn.dddice.com/js/dddice-latest.js">
// O CDN expõe ThreeDDice e ThreeDDiceRollEvent diretamente no window global.
// =============================================================================

const DDDICE_THEME_FALLBACK = 'dddice-standard';
const LS_API_KEY = 'giharad_dddice_api_key';
const LS_ROOM_SLUG = 'giharad_dddice_room_slug';

let dddiceInstance = null;
let dddiceConectado = false;
let dddiceRoomSlug = null;
let dddiceTheme = DDDICE_THEME_FALLBACK; // será atualizado na conexão


// -------------------------------------------------------------------------
// Conexão
// -------------------------------------------------------------------------

async function conectarDddice(apiKey, roomSlug) {
    const canvas = document.getElementById('dddice-canvas');
    if (!canvas) {
        console.error('[dddice] Canvas #dddice-canvas não encontrado.');
        return false;
    }

    try {
        atualizarStatusDddice('connecting');

        if (dddiceInstance) {
            try { dddiceInstance.stop(); } catch (_) { }
            dddiceInstance = null;
        }

        // O CDN do dddice expõe ThreeDDice diretamente no window
        const ThreeDDice = window.ThreeDDice;
        const ThreeDDiceRollEvent = window.ThreeDDiceRollEvent;

        if (!ThreeDDice) {
            console.error('[dddice] ThreeDDice não encontrado. Verifique se o CDN foi carregado.');
            atualizarStatusDddice('error');
            return false;
        }

        dddiceInstance = new ThreeDDice(canvas, apiKey);
        dddiceInstance.start();

        // Busca o primeiro tema disponível no Dice Box do usuário
        try {
            const boxResp = await dddiceInstance.api.diceBox.list();
            const temas = boxResp?.data?.data ?? boxResp?.data ?? [];
            if (temas.length > 0) {
                dddiceTheme = temas[0].id ?? temas[0].slug ?? temas[0].theme?.id ?? DDDICE_THEME_FALLBACK;
                console.log(`[dddice] Tema detectado: ${dddiceTheme}`);
            } else {
                console.warn('[dddice] Dice Box vazio, usando tema fallback.');
            }
        } catch (themeErr) {
            console.warn('[dddice] Não foi possível buscar o Dice Box:', themeErr?.message);
        }

        // Entra na sala como participante via REST antes de conectar o WebSocket
        try {
            await dddiceInstance.api.room.join(roomSlug);
        } catch (joinErr) {
            // 409 = já é participante, pode ignorar
            if (!joinErr?.response || joinErr.response.status !== 409) {
                console.warn('[dddice] Aviso ao entrar na sala:', joinErr?.message || joinErr);
            }
        }

        await dddiceInstance.connect(roomSlug);


        // Escuta resultados de rolagem
        if (ThreeDDiceRollEvent) {
            dddiceInstance.on(ThreeDDiceRollEvent.RollFinished, (roll) => {
                const valores = roll.values || [];
                const numInc = dddiceInstance._giharadIncDados || 0;

                // Separa os dados: mod fixo ao final, incapacidade antes dele
                // Ordem de inserção: [atributo, expertise?, incapacidade?, mod?]
                const modDados = valores.filter(d => d.type === 'mod');
                const naoMod = valores.filter(d => d.type !== 'mod');

                // Os últimos numInc dados não-mod são de incapacidade
                const incDados = naoMod.slice(-numInc);
                const posDados = naoMod.slice(0, naoMod.length - numInc);

                const somaPos = posDados.reduce((s, d) => s + (d.value || 0), 0);
                const somaInc = incDados.reduce((s, d) => s + (d.value || 0), 0);
                const somaMod = modDados.reduce((s, d) => s + (d.value || 0), 0);
                const total = somaPos - somaInc + somaMod;

                const label = roll.label || 'Rolagem';
                mostrarResultadoRolagem(label, total, posDados, incDados, somaMod);

                // Reset
                dddiceInstance._giharadIncDados = 0;
            });
        }


        dddiceConectado = true;
        dddiceRoomSlug = roomSlug;
        atualizarStatusDddice('connected');

        localStorage.setItem(LS_API_KEY, apiKey);
        localStorage.setItem(LS_ROOM_SLUG, roomSlug);

        console.log(`[dddice] Conectado à sala: ${roomSlug}`);
        return true;

    } catch (err) {
        console.error('[dddice] Erro ao conectar:', err);
        dddiceConectado = false;
        atualizarStatusDddice('error');
        return false;
    }
}

function desconectarDddice() {
    if (dddiceInstance) {
        try { dddiceInstance.stop(); } catch (_) { }
        dddiceInstance = null;
    }
    dddiceConectado = false;
    dddiceRoomSlug = null;
    atualizarStatusDddice('disconnected');
}

// -------------------------------------------------------------------------
// Rolar dado de atributo
// -------------------------------------------------------------------------

/**
 * Rola dados de um atributo da ficha com expertise, incapacidade e bônus.
 * @param {string} tipo       - dado do atributo, ex: 'd8'
 * @param {string} label      - nome do atributo, ex: 'Físico'
 * @param {number} bonus      - bônus/penalidade fixo
 * @param {number} expTipo    - faces do dado de expertise (0 = sem expertise)
 * @param {number} incTipo    - faces do dado de incapacidade (0 = sem incapacidade)
 */
async function rolarAtributo(tipo, label, bonus, expTipo, incTipo) {
    if (!dddiceConectado || !dddiceInstance) {
        if (typeof mostrarToast === 'function') {
            mostrarToast('⚠️ Conecte ao dddice primeiro!', 'info');
        }
        return;
    }

    try {
        const dice = [];

        // Dado principal do atributo
        dice.push({ theme: dddiceTheme, type: tipo });

        // Dado de expertise (positivo)
        if (expTipo && expTipo > 0) {
            dice.push({ theme: dddiceTheme, type: `d${expTipo}` });
        }

        // Dado de incapacidade (negativo — enviado ao dddice, subtraído no total)
        const numIncDados = (incTipo && incTipo > 0) ? 1 : 0;
        if (numIncDados > 0) {
            dice.push({ theme: dddiceTheme, type: `d${incTipo}` });
        }

        // Bônus fixo como modifier
        const mod = parseInt(bonus) || 0;
        if (mod !== 0) {
            dice.push({ theme: dddiceTheme, type: 'mod', value: mod });
        }

        // Monta label descritivo para a sala ver
        let descricao = tipo;
        if (expTipo > 0) descricao += ` +d${expTipo}`;
        if (incTipo > 0) descricao += ` -d${incTipo}`;
        if (mod > 0) descricao += ` +${mod}`;
        if (mod < 0) descricao += ` ${mod}`;

        // Guarda quantos dados são de incapacidade para o RollFinished subtrair
        dddiceInstance._giharadIncDados = numIncDados;

        await dddiceInstance.api.roll.create(dice, {
            room: dddiceRoomSlug,
            label: `${label} (${descricao})`,
        });

    } catch (err) {
        console.error('[dddice] Erro ao rolar:', err);
        if (typeof mostrarToast === 'function') {
            mostrarToast('Erro ao rolar dado!', 'error');
        }
    }
}

// -------------------------------------------------------------------------
// UI — Status e Resultado
// -------------------------------------------------------------------------


function atualizarStatusDddice(estado) {
    const estados = {
        disconnected: { cor: '#555', label: 'Desconectado', shadow: 'none' },
        connecting: { cor: '#ffc107', label: 'Conectando...', shadow: '0 0 6px #ffc107' },
        connected: { cor: '#4caf50', label: 'Conectado', shadow: '0 0 8px #4caf50' },
        error: { cor: '#f44336', label: 'Erro', shadow: '0 0 6px #f44336' },
    };
    const s = estados[estado] || estados.disconnected;

    // Ponto no painel (se aberto)
    const dot = document.getElementById('dddice-status-dot');
    const texto = document.getElementById('dddice-status-texto');
    if (dot) { dot.style.background = s.cor; dot.style.boxShadow = s.shadow; }
    if (texto) { texto.textContent = s.label; texto.style.color = s.cor; }

    // Ponto no botão do header
    const headerDot = document.getElementById('dddice-header-dot');
    if (headerDot) {
        headerDot.style.background = s.cor;
        headerDot.style.boxShadow = s.shadow;
    }
}

function mostrarResultadoRolagem(label, total, posDados, incDados, mod) {
    // Monta string de detalhamento
    const partes = [];
    if (posDados && posDados.length) {
        partes.push(posDados.map(d => d.value).join('+'));
    }
    if (incDados && incDados.length) {
        partes.push('−' + incDados.map(d => d.value).join('−'));
    }
    if (mod && mod !== 0) {
        partes.push((mod > 0 ? '+' : '') + mod);
    }
    const detalhe = partes.length > 1 ? ` (${partes.join(' ')})` : '';
    const msg = `🎲 ${label}: **${total}**${detalhe}`;
    if (typeof mostrarToast === 'function') {
        mostrarToast(msg, 'success');
    } else {
        console.log('[dddice] ' + msg);
    }
}

// -------------------------------------------------------------------------
// Painel de Configuração
// -------------------------------------------------------------------------

function abrirPainelDddice() {
    const existente = document.getElementById('dddice-painel-overlay');
    if (existente) { existente.remove(); return; }

    const apiKey = localStorage.getItem(LS_API_KEY) || '';
    const roomSlug = localStorage.getItem(LS_ROOM_SLUG) || '';

    const overlay = document.createElement('div');
    overlay.id = 'dddice-painel-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        z-index: 9990; display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.65); backdrop-filter: blur(4px);
    `;
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
        <div style="
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border: 1px solid #7e57c2;
            border-radius: 12px;
            padding: 28px 30px;
            min-width: 360px; max-width: 440px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.7), 0 0 30px rgba(126,87,194,0.15);
            font-family: 'Cinzel', serif;
        ">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:22px;">
                <h3 style="margin:0; color:#b388ff; font-size:1rem; letter-spacing:2px;">🎲 DDDICE</h3>
                <div style="display:flex; align-items:center; gap:8px;">
                    <div id="dddice-status-dot" style="width:10px;height:10px;border-radius:50%;background:#555;transition:all 0.3s;"></div>
                    <span id="dddice-status-texto" style="font-size:0.72rem;color:#555;letter-spacing:1px;">Desconectado</span>
                </div>
            </div>

            <div style="margin-bottom:14px;">
                <label style="display:block;font-size:0.68rem;color:#888;letter-spacing:1.5px;margin-bottom:5px;text-transform:uppercase;">API Key</label>
                <input id="dddice-api-key-input" type="password" value="${apiKey}" placeholder="sk_live_..."
                    style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.05);border:1px solid #333;
                           border-radius:6px;padding:9px 12px;color:#fff;font-family:monospace;font-size:0.85rem;outline:none;"
                    onfocus="this.style.borderColor='#7e57c2'" onblur="this.style.borderColor='#333'">
            </div>

            <div style="margin-bottom:22px;">
                <label style="display:block;font-size:0.68rem;color:#888;letter-spacing:1.5px;margin-bottom:5px;text-transform:uppercase;">Room Slug</label>
                <input id="dddice-room-slug-input" type="text" value="${roomSlug}" placeholder="minha-sala"
                    style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.05);border:1px solid #333;
                           border-radius:6px;padding:9px 12px;color:#fff;font-family:monospace;font-size:0.85rem;outline:none;"
                    onfocus="this.style.borderColor='#7e57c2'" onblur="this.style.borderColor='#333'">
                <span style="font-size:0.65rem;color:#555;margin-top:5px;display:block;font-family:sans-serif;line-height:1.4;">
                    Encontre em: dddice.com/room/<strong style="color:#777;">seu-slug</strong>
                </span>
            </div>

            <div style="display:flex;gap:10px;">
                <button onclick="
                    const k = document.getElementById('dddice-api-key-input').value.trim();
                    const r = document.getElementById('dddice-room-slug-input').value.trim();
                    if (!k || !r) { alert('Preencha a API Key e o Room Slug.'); return; }
                    document.getElementById('dddice-painel-overlay').remove();
                    conectarDddice(k, r);
                " style="flex:1;padding:10px;border:none;border-radius:6px;
                    background:linear-gradient(135deg,#7e57c2,#5e35b1);color:#fff;
                    font-family:'Cinzel',serif;font-weight:bold;cursor:pointer;
                    font-size:0.85rem;letter-spacing:1px;"
                    onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
                    CONECTAR
                </button>
                ${dddiceConectado ? `
                <button onclick="desconectarDddice();document.getElementById('dddice-painel-overlay').remove();"
                    style="padding:10px 14px;border:1px solid #f44336;border-radius:6px;
                           background:transparent;color:#f44336;font-family:'Cinzel',serif;cursor:pointer;"
                    onmouseover="this.style.background='rgba(244,67,54,.15)'" onmouseout="this.style.background='transparent'">
                    SAIR
                </button>` : ''}
            </div>

            <p style="font-size:0.65rem;color:#444;margin-top:16px;margin-bottom:0;text-align:center;font-family:sans-serif;">
                API Key em: <a href="https://dddice.com/user/developer" target="_blank" style="color:#666;">dddice.com/user/developer</a>
            </p>
        </div>
    `;

    document.body.appendChild(overlay);
    // Aplica status atual nos elementos do painel recem criado
    atualizarStatusDddice(dddiceConectado ? 'connected' : 'disconnected');
}

// -------------------------------------------------------------------------
// Auto-reconnect ao carregar a página
// -------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    const apiKey = localStorage.getItem(LS_API_KEY);
    const roomSlug = localStorage.getItem(LS_ROOM_SLUG);
    if (apiKey && roomSlug) {
        console.log('[dddice] Reconectando automaticamente...');
        setTimeout(() => conectarDddice(apiKey, roomSlug), 800);
    }
});
