import { box } from "../connect";
import { Tether } from "../contracts/contract_tether";
import { WE33_Logic } from "../contracts/contract_we33logic";

async function approval(amount) {
    const wallet = await box.getCurrentState();

    const account = wallet?.address;
    const signer = wallet?.signer;

    const tether = await box.createEtherContract(Tether, signer);
    const allowance = await tether.allowance(account, WE33_Logic.address);

    if (BigInt(amount) > allowance) {
        try {
            const tx = await tether.approve(WE33_Logic.address, box.maxUint256);
            await tx.wait();
        } catch (error) {
            throw new Error(contextError);
        }
    }
}

export async function registerExt(id) {
    const wallet = await box.getCurrentState();

    const account = wallet?.address;
    const signer = wallet?.signer;

    const we33 = await box.createEtherContract(WE33_Logic, signer);

    await approval(BigInt(20e18));

    try {
        const referrer = await we33.getReferrerData(id);
        console.log({ referrer })
        const value = BigInt(75e13)
        const tx = await we33.register(account, referrer, { value });
        const result = await tx.wait();
        return { result: result.status, txhash: result.hash };
    } catch (error) {
        const handleTxError = box.handleTxError(WE33_Logic, error);
        const contextError = handleTxError?.raw?.reason || handleTxError?.raw?.shortMessage
        console.log({ handleTxError })
        throw new Error(contextError);
    }
}