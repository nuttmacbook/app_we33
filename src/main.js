import { renderSpots } from './componants/render_spot';
import './main.css';

import { box, modal } from './web3/connect';
import { Tether } from './web3/contracts/contract_tether';
import { WE33_Logic } from './web3/contracts/contract_we33logic';
import { registerExt } from './web3/intereacts/registerExt';
import { uprankExt } from './web3/intereacts/uprankExt';

window.connectWallet = async () => {
    modal.open();
};

window.searchFocus = async (id) => {
    const wallet = await box.getCurrentState();
    const data = await getContractData(wallet, id);
    SSR(data);
};

window.registerExt = registerExt;
window.uprankExt = uprankExt;

box.safeRenderApp(renderApp);

async function getContractData(wallet, focusId = 0n) {
    const account = wallet?.address ?? box.ZERO;

    const we33 = box.createWeb3Contract(WE33_Logic, box.getCurrentRpc());
    const tether = box.createWeb3Contract(Tether, box.getCurrentRpc());

    let PromiseSetting = [
        we33.methods.getDappData().call(),
        we33.methods.getSpotsData(account, focusId).call(),
        tether.methods.balanceOf(account).call()
    ]

    if (focusId > 0n) { PromiseSetting.push(we33.methods.getReferrerData(focusId).call()) }

    const [getDappData, getSpotsData, usdtBalance] = await Promise.all(PromiseSetting);

    return { wallet, account, getDappData, getSpotsData, usdtBalance };
}

function toActualSeatCounts(data, maxRank = 6) {
    const result = { ...data };

    for (let rank = 1; rank <= maxRank; rank++) {
        const current = Number(data[`totalSeat_rank_${rank}`]) || 0;
        const next = rank < maxRank
            ? Number(data[`totalSeat_rank_${rank + 1}`]) || 0
            : 0;

        result[`totalSeat_rank_${rank}`] = Math.max(0, current - next);
    }

    return result;
}

function SSR(data) {
    console.log({ data });
    const app = document.querySelector('#app');
    if (!app) return;

    const basePoint = (data?.getSpotsData?.[1]?.id) ? 20n : 0n;
    const growPoint = data?.getSpotsData?.[1]?.owner?.direct * 2n;
    const point = (!basePoint) ? 0n : (basePoint + growPoint) * BigInt(1e18)
    const balances = { point, redeem: 0n, airdrop: 0n, usdt: data?.usdtBalance };

    const fetchUrlId = new URLSearchParams(location.search).get('id');
    if (fetchUrlId) { localStorage.setItem("sponsorId", fetchUrlId); }

    function toBigIntOr(value, fallback) {
        try {
            return BigInt(String(value).trim());
        } catch {
            return fallback;
        }
    }

    const sponsorId = toBigIntOr(localStorage.getItem("sponsorId"), 1n);

    app.innerHTML = /*html*/`
        <div class="w-full p-4">
            ${renderSpots(data?.account, toActualSeatCounts(data?.getDappData), data?.getSpotsData, { balances, sponsorId })}
        </div>
    `;
}

async function renderApp(wallet) {
    const path = window.location.pathname;
    if (path !== '/') return;

    const data = await getContractData(wallet);

    SSR(data);
}