import { renderSpots } from './componants/render_spot';
import './main.css';

import { box, delay, modal } from './web3/connect';
import { WE33_Logic } from './web3/contracts/contract_we33logic';

window.searchFocus = async (id) => {
    const wallet = await box.getCurrentState();
    const data = await getContractData(wallet, id);
    SSR(data);
};

window.connectWallet = async () => {
    modal.open();
};

window.transferPoint = async () => {
    console.log('transfer point');
};

window.redeemWEExt = async () => {
    await delay(5000);
    return { result:true, txhash: "0xfe54ccc4f254279eb08c003decba18ade75de9c99ac5c9fbd2e83fe534294b5b" }
};

box.safeRenderApp(renderApp);

async function getContractData(wallet, focusId = 0n) {
    const account = wallet?.address ?? box.ZERO;

    const we33 = box.createWeb3Contract(WE33_Logic, box.getCurrentRpc());

    // one promise per destructured name — the old version only had the spots
    // call, so getSpotsData came back undefined
    const [getDappData, getSpotsData] = await Promise.all([
        we33.methods.getDappData().call(),
        we33.methods.getSpotsData(account, focusId).call()
    ]);

    return { wallet, account, getDappData, getSpotsData };
}

function SSR(data) {
    const app = document.querySelector('#app');
    if (!app) return;

    const balances = { point: 0n, redeem: 0n, airdrop: 0n, usdt: 0n };
    const sponsorId = new URLSearchParams(location.search).get('id');

    app.innerHTML = /*html*/`
        <div class="w-full p-4">
            ${renderSpots(data?.account, data?.getDappData, data?.getSpotsData, { balances, sponsorId })}
        </div>
    `;
}

async function renderApp(wallet) {

    const path = window.location.pathname;
    if (path !== '/') return;

    const data = await getContractData(wallet);
    console.log({ data });

    SSR(data);
}