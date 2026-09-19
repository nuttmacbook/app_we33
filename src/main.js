import { divrec } from './componants/dividend_records';
import { renderSpots } from './componants/render_spot';
import './main.css';

import { box, delay, modal } from './web3/connect';
import { Tether } from './web3/contracts/contract_tether';
import { DividendCA, WE33_Logic, WE33_Logic_2 } from './web3/contracts/contract_we33logic';
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

window.switchPackage = async (index, wallet) => {
    const data = await getContractData(wallet);
    SSR(data);
};

window.registerExt = registerExt;
window.uprankExt = uprankExt;

async function getContractData(wallet, focusId = 0n) {
    const account = wallet?.address ?? box.ZERO;
    const packageId = window?.__we33Package ?? 0;

    const contractSelector = (packageId == 0) ? WE33_Logic_2.address : WE33_Logic.address;
    const mountContract = { address: contractSelector, abi: WE33_Logic.abi }

    const we33 = box.createWeb3Contract(mountContract, box.getCurrentRpc());
    const tether = box.createWeb3Contract(Tether, box.getCurrentRpc());
    let PromiseSetting = [
        we33.methods.getDappData().call(),
        we33.methods.getSpotsData(account, focusId).call(),
        we33.methods.getVirtualWalletInfo().call(),
        tether.methods.balanceOf(account).call(),
    ]

    if (focusId > 0n) { PromiseSetting.push(we33.methods.getReferrerData(focusId).call()) }

    const [getDappData, getSpotsData, getVirtualWalletInfo, usdtBalance] = await Promise.all(PromiseSetting);

    const transferOut = async (id) => {
        const wallet = await box.getCurrentState();

        const we33tx = await box.createEtherContract(WE33_Logic, wallet?.signer);

        const reactWallet = getVirtualWalletInfo[0][id];

        const balanceOf = await tether.methods.balanceOf(reactWallet).call();

        if (balanceOf > 0n) {
            const tx = await we33tx.transferReactWallet(getVirtualWalletInfo[0][id], Tether.address, wallet?.address, balanceOf);
            const result = await tx.wait();
            console.log(result);
        }

        console.log("Empty Wallet");

    }

    const dividendOut = async (id) => {
        const wallet = await box.getCurrentState();

        const we33tx = await box.createEtherContract(WE33_Logic, wallet?.signer);
        const tether = await box.createEtherContract(Tether, wallet?.signer);
        const reactWallet = getVirtualWalletInfo[0][id];

        const balanceOf = await tether.balanceOf(reactWallet);

        console.log({ balanceOf });

        const divtx = await box.createEtherContract(DividendCA, wallet?.signer);

        if (balanceOf > 0n) {
            const tx = await we33tx.approveReactWallet(getVirtualWalletInfo[0][id], Tether.address, DividendCA.address, balanceOf);
            const result = await tx.wait();
            console.log(result);
            
            const participants = divrec[id].participants;
            const weight = divrec[id].weight;

            const tx2 = await divtx.transferFromAndYield(getVirtualWalletInfo[0][id], Tether.address, box.maxUint256, participants, weight);
            const result2 = await tx2.wait();
            console.log(result2);
        }

        console.log("Empty Wallet");
    }

    //await dividendOut(5);

    const wepointSet = (packageId == 0) ? { base: 2n, each: 0n } : { base: 20n, each: 2n }

    const basePoint = (getSpotsData?.[1]?.id) ? wepointSet.base : 0n;
    const growPoint = getSpotsData?.[1]?.owner?.direct * wepointSet.each;
    const point = (!basePoint) ? 0n : (basePoint + growPoint) * BigInt(1e18)
    const balances = { point, redeem: 0n, airdrop: 0n, usdt: usdtBalance };

    return { wallet, packageId, account, getDappData, getSpotsData, getVirtualWalletInfo, balances };
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
            ${renderSpots(data?.account, toActualSeatCounts(data?.getDappData), data?.getSpotsData, { balances: data?.balances, sponsorId })}
        </div>
    `;
}

async function renderApp(wallet) {
    const path = window.location.pathname;
    if (path !== '/') return;

    const data = await getContractData(wallet);

    SSR(data);
}

box.safeRenderApp(renderApp);