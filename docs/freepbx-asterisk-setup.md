# FreePBX / Asterisk Setup

Use ARI as the primary integration for live calls.

1. Enable HTTP in `http.conf`.
2. Enable ARI in `ari.conf`.
3. Create an ARI user/password and store them in environment variables or encrypted database fields.
4. Route an inbound DID or extension to the Stasis app.

For LAN access, Asterisk HTTP must bind to a reachable address:

```ini
[general](+)
bindaddr=0.0.0.0
bindport=8088
```

On FreePBX, put this override in `/etc/asterisk/http_custom.conf`, then run `fwconsole reload`. Verify with:

```bash
asterisk -rx 'http show status'
curl -u '<ari-user>:<ari-password>' http://192.168.30.14:8088/ari/asterisk/info
```

Example `extensions_custom.conf`:

```asterisk
[from-internal-custom]
exten => 7777,1,NoOp(Voice AI Bot)
 same => n,Stasis(voicebot-app)
 same => n,Hangup()
```

Fallback examples:

```asterisk
same => n,Goto(ivr-10,s,1)
same => n,Queue(sales)
same => n,Dial(PJSIP/101,30)
```

The backend adapter boundary is `TelephonyProvider`; `AsteriskAriProvider` should own ARI websocket events and channel control calls.
