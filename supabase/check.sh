#!/bin/sh
# Checks the security of the online leaderboard against the real project, with the public key only.
# Usage: sh supabase/check.sh <Project URL> <publishable key> <VITE_SUPABASE_SALT>
# Every line prints "<case>: got <result> want <result> ok|FAIL". The valid test rows use the name "Check Script";
# remove them afterwards in SQL Editor: delete from public.scores where first_name = 'Check' and last_name = 'Script';
URL="$1"; KEY="$2"; SALT="$3"
[ -n "$URL" ] && [ -n "$KEY" ] && [ -n "$SALT" ] || { echo "usage: sh supabase/check.sh <url> <key> <salt>"; exit 2; }
T=$(date -u +%Y-%m-%d)
Y=$(date -u -v-1d +%Y-%m-%d 2>/dev/null || date -u -d yesterday +%Y-%m-%d)
O=$(date -u -v-2d +%Y-%m-%d 2>/dev/null || date -u -d '2 days ago' +%Y-%m-%d)
# key for score 1 (IEEE-754 hex 3ff0000000000000), the same HMAC the game computes
k() { printf '%s' "3ff0000000000000|$1|$2" | openssl dgst -sha256 -hmac "$SALT" | sed 's/.* //'; }
row() { printf '{"first_name":"Check","last_name":"%s","score":1,"level":1,"board":"%s","key":"%s"}' "$1" "$2" "$3"; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@" -H "apikey: $KEY" -H "Content-Type: application/json"; }
post() { code -X POST "$URL/rest/v1/scores" -H "Prefer: return=minimal" -d "$1"; }
count() { curl -s "$URL/rest/v1/scores?select=first_name&first_name=eq.Check&last_name=eq.$1" -H "apikey: $KEY" | grep -o first_name | wc -l | tr -d ' '; }
FAILS=0
say() { # case got want(4xx|2xx|exact)
  case "$3" in 4xx) ok=$(echo "$2" | grep -q '^4' && echo ok);; 2xx) ok=$(echo "$2" | grep -q '^2' && echo ok);; *) [ "$2" = "$3" ] && ok=ok;; esac
  [ "$ok" = ok ] || { ok=FAIL; FAILS=$((FAILS + 1)); }
  echo "$1: got $2 want $3 $ok"; ok=
}

say "valid row" "$(post "$(row Script main "$(k main "$T")")")" 2xx
say "valid row stored" "$(count Script)" 1
say "key from yesterday" "$(post "$(row Script main "$(k main "$Y")")")" 2xx
say "key from 2 days ago" "$(post "$(row Old main "$(k main "$O")")")" 4xx
say "wrong key" "$(post "$(row Wrongkey main "$(k main "$T" | tr 0-9a-f 1-9a-f0)")")" 4xx
say "wrong key: no row" "$(count Wrongkey)" 0
say "no key" "$(post '{"first_name":"Check","last_name":"Nokey","score":1,"level":1}')" 4xx
say "key for another score" "$(post "$(row Rescored main "$(k main "$T")" | sed 's/"score":1/"score":2/')")" 4xx
say "score -1" "$(post "$(row Neg main x | sed 's/"score":1/"score":-1/')")" 4xx
say "30-char name" "$(post "$(row Abcdefghijabcdefghijabcdefghij main "$(k main "$T")")")" 4xx
say "score 1e400" "$(post "$(row Huge main x | sed 's/"score":1/"score":1e400/')")" 4xx
say "board x" "$(post "$(row Board x "$(k x "$T")")")" 4xx
say "daily-2099-01-01" "$(post "$(row Future daily-2099-01-01 "$(k daily-2099-01-01 "$T")")")" 4xx
say "id in body" "$(post "$(row Id main "$(k main "$T")" | sed 's/^{/{"id":1,/')")" 4xx
say "array with bad row" "$(post "[$(row Array main "$(k main "$T")"),$(row Array main x | sed 's/"score":1/"score":-1/')]")" 4xx
say "array: rows unchanged" "$(count Array)" 0
say "PATCH" "$(code -X PATCH "$URL/rest/v1/scores?first_name=eq.Check" -d '{"score":5}')" 4xx
say "DELETE by name" "$(code -X DELETE "$URL/rest/v1/scores?first_name=eq.Check")" 4xx
say "DELETE no filter" "$(code -X DELETE "$URL/rest/v1/scores")" 4xx
say "GET after" "$(count Script)" 2
say "select=id" "$(code "$URL/rest/v1/scores?select=id&limit=1")" 4xx
say "select=key" "$(code "$URL/rest/v1/scores?select=key&limit=1")" 4xx
say "select=*" "$(code "$URL/rest/v1/scores?select=*&limit=1")" 4xx
H=$(curl -s -i -X OPTIONS "$URL/rest/v1/scores" -H "Origin: https://pszemocny.github.io" -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: apikey,content-type,prefer" | tr -d '\r' | grep -i '^access-control-allow-origin:' | head -1)
say "OPTIONS from github.io" "$( [ -n "$H" ] && echo present || echo absent )" present
# flood cap on yesterday's daily board (nobody opens it): of 40 POSTs sent at once exactly 30 pass, the next is refused, another board still takes a row
D=$(mktemp -d); B=$(row Script "daily-$Y" "$(k "daily-$Y" "$Y")")
for i in $(seq 1 40); do post "$B" > "$D/$i" & done; wait
n=0; for f in "$D"/*; do grep -q '^2' "$f" && n=$((n + 1)); done; rm -rf "$D"
say "40 parallel POSTs on daily-$Y: accepted" "$n" 30
say "41st POST on daily-$Y" "$(post "$(row Script "daily-$Y" "$(k "daily-$Y" "$Y")")")" 4xx
say "POST on daily-$T same minute" "$(post "$(row Script "daily-$T" "$(k "daily-$T" "$T")")")" 2xx
echo "failed: $FAILS"
