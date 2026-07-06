# Development Fallback Mode

The application defaults to Live Mode. Development fallback mode is only for isolated local work when no AI provider, Dialogflow project, or FreePBX/Asterisk server is available.

When `MOCK_MODE=true`:

- AI responses use `MockAiProviderAdapter`.
- Speech and intent results use `MockVoiceProvider`.
- Channel operations use `MockTelephonyProvider`.
- Simulate Call creates an in-memory `CallSession`.
- Runtime writes `CallExecutionLog`, `Transcript`, and `ProviderRequestLog` records.

Do not enable this mode for production or FreePBX integration testing. Live Mode should report missing credentials and failed connections directly.
