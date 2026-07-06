# Dialogflow / Google Voice Setup

Dialogflow and Google Voice are configured from the web UI. Service account JSON is uploaded through the admin console, validated, encrypted, and used for Google auth, Dialogflow CX `detectIntent`, Google Speech-to-Text, and Thai Text-to-Speech.

Configuration fields:

- Project ID
- Location
- Agent ID
- Language code
- Voice name
- Service account JSON

Service account JSON is validated on upload and encrypted before storage. API responses only show masked credential status.

The default language is Thai (`th-TH`) and the default voice is `th-TH-Standard-A`. Real-time streaming can be added later without changing runtime node contracts.
