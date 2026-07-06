# Flow Builder

The frontend uses React Flow for the visual editor.

Supported node categories:

- Start and Hangup
- Voice Bot
- IVR Menu and DTMF Input
- Condition, Set Variable, Business Hours, Queue Check
- Webhook/API
- Transfer and Fallback

Validation rules include exactly one Start node, no dangling edges, reachability from Start, required Voice Bot configuration, valid IVR routes, transfer destination, webhook URL, condition expression, terminal Hangup behavior, and at least one terminal path.

Draft and published versions are separated in the data model through `CallFlow` and `CallFlowVersion`.
