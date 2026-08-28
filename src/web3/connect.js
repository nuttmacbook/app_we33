import { kitbox, chain, utils } from "kitbox";

const projectId = import.meta.env.VITE_ProjectId;

const box = new kitbox();
const modal = box.createModal(projectId, [ chain.bsc ], 'dark', "#3B82F6");
const { shortAddress, formNumber, timestampToUTC, delay } = utils;

export { box, modal, chain, shortAddress, formNumber, timestampToUTC, delay }