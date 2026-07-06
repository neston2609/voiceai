SELECT 'CREATE DATABASE voicebot_dev'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'voicebot_dev')\gexec

SELECT 'CREATE DATABASE voicebot_prod'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'voicebot_prod')\gexec
