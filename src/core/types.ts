export type Platform = "windows" | "macos" | "linux" | "unknown";

export type SupportedLanguage = "pt-BR" | "en-US";

export type LanguageSetting = SupportedLanguage | "auto";

export type ClaudeHookEventName = "Notification" | "Stop" | "StopFailure" | "SubagentStop";

export type NotificationSeverity = "info" | "warning" | "error";

export interface ClaudeHookPayload {
  hook_event_name?: ClaudeHookEventName;
  cwd?: string;
  message?: string;
  agent_type?: string;
  error_type?: string;
  notification_type?: string;
  type?: string;
  error?: string;
  session_id?: string;
  transcript_path?: string;
}

export interface NotificationIntent {
  event: ClaudeHookEventName;
  title: string;
  body: string;
  severity: NotificationSeverity;
  projectName: string | null;
  sound: boolean;
  soundName: ToastSoundName;
}

export type ToastSoundName =
  | "Notification.Default"
  | "Notification.IM"
  | "Notification.Mail"
  | "Notification.Reminder"
  | "Notification.SMS"
  | "Notification.Looping.Alarm"
  | "Notification.Looping.Alarm2"
  | "Notification.Looping.Call"
  | "silent";

export interface ToastOptions {
  appId: string;
  title: string;
  body: string;
  sound: ToastSoundName;
}

export interface RinglyConfig {
  schemaVersion: 1;
  language: LanguageSetting;
  events: {
    notification: boolean;
    stop: boolean;
    stopFailure: boolean;
    subagentStop: boolean;
  };
  sound: boolean;
  debug: boolean;
  appId: string;
}

export interface NotificationChannel {
  name: string;
  isAvailable(): Promise<boolean>;
  send(intent: NotificationIntent): Promise<void>;
}

export const DEFAULT_APP_ID = "Claude.Code.CLI";
