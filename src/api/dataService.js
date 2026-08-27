import { DATA_SOURCE } from "../config";
import * as mockApi from "./mockApi";
import * as sheetsApi from "./sheetsApi";

const impl = DATA_SOURCE === "sheets" ? sheetsApi : mockApi;

export const fetchPartners = impl.fetchPartners;
export const updatePartner = impl.updatePartner;
