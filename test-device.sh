#!/usr/bin/env bash
# GPS tracker simulator — IW Protocol test script
# Usage:
#   ./test-device.sh                          # local
#   ./test-device.sh 0.tcp.eu.ngrok.io 15832 # ngrok orqali

SERVER="${1:-127.0.0.1}"
PORT="${2:-4500}"
IMEI="868888031082345"
ICCID="89860617840074615172"
IMSI="460017141050094"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

send_packet() {
  local label="$1"
  local packet="$2"
  echo -e "${BLUE}[SEND]${NC} $label"
  echo -e "       ${YELLOW}$packet${NC}"
  response=$(echo -n "$packet" | nc -w 2 "$SERVER" "$PORT" 2>/dev/null)
  if [ -n "$response" ]; then
    echo -e "       ${GREEN}[RECV] $response${NC}"
  else
    echo -e "       ${RED}[RECV] (javob yo'q)${NC}"
  fi
  echo
  sleep 1
}

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} GPS Tracker Simulator — IW Protocol${NC}"
echo -e "${GREEN} Server: $SERVER:$PORT${NC}"
echo -e "${GREEN}========================================${NC}\n"

if ! nc -z -w 3 "$SERVER" "$PORT" 2>/dev/null; then
  echo -e "${RED}XATO: $SERVER:$PORT ga ulanib bo'lmadi!${NC}"
  exit 1
fi

echo -e "${GREEN}Server topildi. Testlar boshlanmoqda...${NC}\n"

send_packet "AP00 — Login"                   "IWAP00${IMEI},${ICCID},${IMSI}DCX#"
send_packet "AP01 — Lokatsiya (Toshkent)"   "IWAP01060424A4121.5167N06914.2867E000.0143052123001F0000,460,01,3A2B,1C4D,#"
send_packet "AP01 — Lokatsiya (harakatda)"  "IWAP01060424A4121.8000N06914.5000E035.5143100123002F0000,460,01,3A2B,1C4D,#"
send_packet "AP03 — Heartbeat"              "IWAP03,1F0A640001,00012345,0000#"
send_packet "AP10 — SOS Alarm"             "IWAP10060424A4121.5167N06914.2867E000.0143052123001F0000,460,01,3A2B,1C4D,01,1,0,#"
send_packet "AP10 — Low Battery"           "IWAP10060424A4121.5167N06914.2867E000.0143052123001F0005,460,01,3A2B,1C4D,02,1,0,#"
send_packet "APJK — Yurak urishi"          "IWAPJK,20240406143052,2,75#"
send_packet "APJK — Qon bosimi"            "IWAPJK,20240406143100,1,80|120#"
send_packet "APJK — Harorat"               "IWAPJK,20240406143110,3,36.6#"
send_packet "APJK — Kislorod"              "IWAPJK,20240406143120,4,98#"
send_packet "APWR — Kiyilgan"              "IWAPWR,${IMEI},1,1712345678#"
send_packet "APFD — Yiqilish"              "IWAPFD,${IMEI},1712345678#"
send_packet "APVR — Firmware"              "IWAPVR,${IMEI},V3.03.001#"

echo -e "${GREEN}Barcha testlar yakunlandi!${NC}"
echo -e "${GREEN}Dashboard: http://localhost:5173${NC}"

# Ngrok SMS matni
if [ "$SERVER" != "127.0.0.1" ]; then
  echo
  echo -e "${YELLOW}Soat uchun SMS:${NC}"
  echo -e "${YELLOW}pw,123456,ip,${SERVER},${PORT}#${NC}"
fi
