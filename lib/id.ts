import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

function nano(len: number): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export const newEmailId = () => `em_${nano(24)}`;
export const newDomainId = () => `dom_${nano(20)}`;
export const newApiKeyId = () => `key_${nano(20)}`;
export const newWebhookId = () => `wh_${nano(20)}`;
export const newEventId = () => `evt_${nano(24)}`;
export const newDeliveryId = () => `whd_${nano(24)}`;

export const newUserId = () => `usr_${nano(20)}`;
export const newSettingsId = () => `set_${nano(20)}`;
export const newSuppressionId = () => `sup_${nano(20)}`;
export const newTemplateId = () => `tpl_${nano(20)}`;
export const newAudienceId = () => `aud_${nano(20)}`;
export const newContactId = () => `con_${nano(24)}`;
export const newBroadcastId = () => `bc_${nano(20)}`;

// full secret tokens
export const newApiToken = () => `st_${nano(32)}`;
export const newWebhookSecret = () => `whsec_${nano(32)}`;
export const newSessionToken = () => nano(48);
