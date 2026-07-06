export interface DtmfOptions {
  timeoutSeconds: number;
  maxDigits: number;
}

export interface TransferDestination {
  type: "extension" | "queue" | "IVR" | "SIP_URI" | "external";
  value: string;
}

export interface TelephonyProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  answer(channelId: string): Promise<void>;
  hangup(channelId: string): Promise<void>;
  playAudio(channelId: string, audioFilePath: string): Promise<void>;
  collectDtmf(channelId: string, options: DtmfOptions): Promise<string>;
  transfer(channelId: string, destination: TransferDestination): Promise<void>;
  onIncomingCall(handler: (call: Record<string, unknown>) => void): void;
  onDtmf(handler: (event: Record<string, unknown>) => void): void;
  onHangup(handler: (event: Record<string, unknown>) => void): void;
}

export class MockTelephonyProvider implements TelephonyProvider {
  async connect() {}
  async disconnect() {}
  async answer(_channelId: string) {}
  async hangup(_channelId: string) {}
  async playAudio(_channelId: string, _audioFilePath: string) {}
  async collectDtmf(_channelId: string, _options: DtmfOptions) {
    return "1";
  }
  async transfer(_channelId: string, _destination: TransferDestination) {}
  onIncomingCall(_handler: (call: Record<string, unknown>) => void) {}
  onDtmf(_handler: (event: Record<string, unknown>) => void) {}
  onHangup(_handler: (event: Record<string, unknown>) => void) {}
}

export class AsteriskAriProvider extends MockTelephonyProvider {
  // TODO: Wire ari-client websocket events and REST control calls.
}
