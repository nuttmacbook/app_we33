import './main.css';

import { box } from './web3/connect';

box.safeRenderApp(renderApp);

async function getContractData(wallet) {
    const account = wallet?.address ?? box.ZERO;
    return { wallet, account }
}

function SSR(data) {
    const app = document.querySelector('#app');
    if (!app) return;

    app.innerHTML = /*html*/`
        <div class="m-auto">
            Upcoming Launch
        </div>
    `;
}

async function renderApp(wallet) {
    const path = window.location.pathname;
    if (path !== "/") return;

    const data = await getContractData(wallet);
    
    SSR(data);
}