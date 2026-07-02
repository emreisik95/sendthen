/** Contract between the server settings page and the client form. */

export interface SecretState {
  /** a value is stored (encrypted, never echoed) */
  set: boolean;
  /** display hint like ••••••••xY3k */
  hint: string;
}

export interface SettingsFormProps {
  initial: {
    mailMode: "inherit" | "sandbox" | "smtp" | "ses";
    smtpUrl: SecretState | null;
    sesAccessKeyId: string;
    sesRegion: string;
    sesSecret: SecretState | null;
    trackOpens: boolean;
    trackClicks: boolean;
  };
  /** what "Instance default" resolves to on this deployment */
  instanceMode: "sandbox" | "smtp" | "ses" | "direct";
  /** true when this deployment can serve tracking + unsubscribe links */
  trackingReady: boolean;
  /** instance admins get an extra operational hint on disabled tracking */
  isAdmin: boolean;
  /** SNS bounce/complaint endpoint to paste into AWS, when known */
  feedbackUrl: string | null;
  teamName: string;
  /** flash: settings were just saved */
  saved: boolean;
  /** server action the form posts to (field names are fixed) */
  action: (formData: FormData) => Promise<void>;
}

export const SES_REGIONS = [
  "us-east-1",
  "us-east-2",
  "us-west-2",
  "eu-west-1",
  "eu-central-1",
  "eu-north-1",
  "ap-south-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
  "sa-east-1",
] as const;
