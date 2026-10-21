#!/bin/sh
# Checks the security of the online leaderboard, the error table and the progress log against the real project, with the public key only.
# Usage: [ONLY=errors|scores|progress|all] sh supabase/check.sh <Project URL> <publishable key> [<VITE_SUPABASE_SALT>]
# The salt is needed only for the scores checks; ONLY=errors and ONLY=progress need no secret and never write to the public board.
# Every line prints "<case>: got <result> want <result> ok|FAIL". Remove the test rows afterwards in SQL Editor:
#   delete from public.scores where name like 'Check-%';
#   delete from public.errors where build = 'check.sh';
#   delete from public.progress where build = 'check.sh';
URL="$1"; KEY="$2"; SALT="$3"
usage() { echo "usage: [ONLY=errors|scores|progress|all] sh supabase/check.sh <url> <key> [<salt>]"; }
[ -n "$URL" ] && [ -n "$KEY" ] || { usage; exit 2; }
[ -n "$SALT" ] || [ "${ONLY:-all}" = errors ] || [ "${ONLY:-all}" = progress ] || { usage; exit 2; }
T=$(date -u +%Y-%m-%d)
Y=$(date -u -v-1d +%Y-%m-%d 2>/dev/null || date -u -d yesterday +%Y-%m-%d)
O=$(date -u -v-2d +%Y-%m-%d 2>/dev/null || date -u -d '2 days ago' +%Y-%m-%d)
# key = the same HMAC the game computes: k <IEEE-754 hex of the score> <board> <date>; score 1 = 3ff0000000000000
k() { printf '%s' "$1|$2|$3" | openssl dgst -sha256 -hmac "$SALT" | sed 's/.* //'; }
# row <name suffix> <score> <level> <board> <key>
row() { printf '{"name":"Check-%s","score":%s,"level":%s,"board":"%s","key":"%s"}' "$1" "$2" "$3" "$4" "$5"; }
ONE=3ff0000000000000
code() { curl -s -o /dev/null -w '%{http_code}' "$@" -H "apikey: $KEY" -H "Content-Type: application/json"; }
post() { code -X POST "$URL/rest/v1/scores" -H "Prefer: return=minimal" -d "$1"; }
count() { curl -s "$URL/rest/v1/scores?select=name&name=eq.Check-$1" -H "apikey: $KEY" | grep -o '"name"' | wc -l | tr -d ' '; }
FAILS=0
say() { # case got want(4xx|2xx|exact)
  case "$3" in 4xx) ok=$(echo "$2" | grep -q '^4' && echo ok);; 2xx) ok=$(echo "$2" | grep -q '^2' && echo ok);; *) [ "$2" = "$3" ] && ok=ok;; esac
  [ "$ok" = ok ] || { ok=FAIL; FAILS=$((FAILS + 1)); }
  echo "$1: got $2 want $3 $ok"; ok=
}

scores_checks() {
say "valid row" "$(post "$(row Script 1 1 main "$(k $ONE main "$T")")")" 2xx
say "valid row stored" "$(count Script)" 1
say "key from yesterday" "$(post "$(row Script 1 1 main "$(k $ONE main "$Y")")")" 2xx
say "key from 2 days ago" "$(post "$(row Old 1 1 main "$(k $ONE main "$O")")")" 4xx
say "wrong key" "$(post "$(row Wrongkey 1 1 main "$(k $ONE main "$T" | tr 0-9a-f 1-9a-f0)")")" 4xx
say "wrong key: no row" "$(count Wrongkey)" 0
say "no key" "$(post '{"name":"Check-Nokey","score":1,"level":1}')" 4xx
say "old columns" "$(post '{"first_name":"Check","last_name":"Old","score":1,"level":1,"board":"main","key":"x"}')" 4xx
say "key for another score" "$(post "$(row Rescored 2 1 main "$(k $ONE main "$T")")")" 4xx
say "score -1" "$(post "$(row Neg -1 1 main x)")" 4xx
say "30-char name" "$(post "$(row Abcdefghijabcdefghijabcd 1 1 main "$(k $ONE main "$T")")")" 4xx
say "21-char name" "$(post "$(row Abcdefghijabcde 1 1 main "$(k $ONE main "$T")")")" 4xx
say "score 1e400" "$(post "$(row Huge 1e400 1 main x)")" 4xx
say "board x" "$(post "$(row Board 1 1 x "$(k $ONE x "$T")")")" 4xx
say "daily-2099-01-01" "$(post "$(row Future 1 1 daily-2099-01-01 "$(k $ONE daily-2099-01-01 "$T")")")" 4xx
# speed board: score = seconds to hole level 12 (119 = 405dc00000000000, 120 = 405e000000000000, 1e299 = 7e031cfd3999f7b0)
# the accepted row uses 1e299 s so it sorts last on the public FASTEST board until the cleanup deletes it
say "speed 119 s" "$(post "$(row Speed 119 12 speed "$(k 405dc00000000000 speed "$T")")")" 4xx
say "speed level 11" "$(post "$(row Speed 120 11 speed "$(k 405e000000000000 speed "$T")")")" 4xx
say "speed 1e299 s lvl 12" "$(post "$(row Speed 1e299 12 speed "$(k 7e031cfd3999f7b0 speed "$T")")")" 2xx
# combo board: a whole number 1-100000 (0 = 0000000000000000, 1.5 = 3ff8000000000000, 100001 = 40f86a1000000000);
# the accepted row is combo 1, the bottom of the public BIGGEST COMBO board until the cleanup deletes it
say "combo 0" "$(post "$(row Combo 0 1 combo "$(k 0000000000000000 combo "$T")")")" 4xx
say "combo 1.5" "$(post "$(row Combo 1.5 1 combo "$(k 3ff8000000000000 combo "$T")")")" 4xx
say "combo 100001" "$(post "$(row Combo 100001 1 combo "$(k 40f86a1000000000 combo "$T")")")" 4xx
say "combo 1" "$(post "$(row Combo 1 1 combo "$(k $ONE combo "$T")")")" 2xx
say "id in body" "$(post "$(row Id 1 1 main "$(k $ONE main "$T")" | sed 's/^{/{"id":1,/')")" 4xx
say "array with bad row" "$(post "[$(row Array 1 1 main "$(k $ONE main "$T")"),$(row Array -1 1 main x)]")" 4xx
say "array: rows unchanged" "$(count Array)" 0
say "PATCH" "$(code -X PATCH "$URL/rest/v1/scores?name=eq.Check-Script" -d '{"score":5}')" 4xx
say "DELETE by name" "$(code -X DELETE "$URL/rest/v1/scores?name=eq.Check-Script")" 4xx
say "DELETE no filter" "$(code -X DELETE "$URL/rest/v1/scores")" 4xx
say "GET after" "$(count Script)" 2
say "select=id" "$(code "$URL/rest/v1/scores?select=id&limit=1")" 4xx
say "select=key" "$(code "$URL/rest/v1/scores?select=key&limit=1")" 4xx
say "select=*" "$(code "$URL/rest/v1/scores?select=*&limit=1")" 4xx
H=$(curl -s -i -X OPTIONS "$URL/rest/v1/scores" -H "Origin: https://pszemocny.github.io" -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: apikey,content-type,prefer" | tr -d '\r' | grep -i '^access-control-allow-origin:' | head -1)
say "OPTIONS from github.io" "$( [ -n "$H" ] && echo present || echo absent )" present
# flood cap on yesterday's daily board (nobody opens it): of 40 POSTs sent at once exactly 30 pass, the next is refused, another board still takes a row
D=$(mktemp -d); B=$(row Script 1 1 "daily-$Y" "$(k $ONE "daily-$Y" "$Y")")
for i in $(seq 1 40); do post "$B" > "$D/$i" & done; wait
n=0; for f in "$D"/*; do grep -q '^2' "$f" && n=$((n + 1)); done; rm -rf "$D"
say "40 parallel POSTs on daily-$Y: accepted" "$n" 30
say "41st POST on daily-$Y" "$(post "$(row Script 1 1 "daily-$Y" "$(k $ONE "daily-$Y" "$Y")")")" 4xx
say "POST on daily-$T same minute" "$(post "$(row Script 1 1 "daily-$T" "$(k $ONE "daily-$T" "$T")")")" 2xx
}

errors_checks() {
erow() { printf '{"session":"%s","build":"check.sh","source":"error","message":"check","stack":"","ua":"check.sh","level":1,"land":0,"count":1}' "$1"; }
epost() { code -X POST "$URL/rest/v1/errors" -H "Prefer: return=minimal" -d "$1"; }
S=$(uuidgen | tr A-F a-f)
say "errors: valid row" "$(epost "$(erow "$S")")" 2xx
say "errors: GET" "$(code "$URL/rest/v1/errors?select=message&limit=1")" 4xx
say "errors: PATCH" "$(code -X PATCH "$URL/rest/v1/errors?build=eq.check.sh" -d '{"count":5}')" 4xx
say "errors: DELETE" "$(code -X DELETE "$URL/rest/v1/errors?build=eq.check.sh")" 4xx
say "errors: id in body" "$(epost "$(erow "$S" | sed 's/^{/{"id":1,/')")" 4xx
say "errors: source x" "$(epost "$(erow "$S" | sed 's/"source":"error"/"source":"x"/')")" 4xx
say "errors: session abc" "$(epost "$(erow abc)")" 4xx
say "errors: stack 3001" "$(epost "$(erow "$S" | sed "s/\"stack\":\"\"/\"stack\":\"$(printf 'a%.0s' $(seq 1 3001))\"/")")" 4xx
# per-session cap: of 25 POSTs with one fresh session sent at once exactly 20 pass, the next is refused
S=$(uuidgen | tr A-F a-f); D=$(mktemp -d)
for i in $(seq 1 25); do epost "$(erow "$S")" > "$D/$i" & done; wait
n=0; for f in "$D"/*; do grep -q '^2' "$f" && n=$((n + 1)); done; rm -rf "$D"
say "errors: 25 parallel POSTs one session: accepted" "$n" 20
say "errors: 26th POST" "$(epost "$(erow "$S")")" 4xx
}

progress_checks() {
# prow <rid> <player>: a valid row
prow() { printf '{"rid":"%s","player":"%s","name":null,"seq":1,"kind":"level","daily":false,"level":2,"run":0,"run_time":60,"play_time":60,"money":10,"earned":50,"gnomes":5,"gnomes_total":5,"land":0,"purchases":[{"id":"kick","lvl":1,"cost":40}],"achievements":[],"build":"check.sh","ua":"check.sh"}' "$1" "$2"; }
ppost() { code -X POST "$URL/rest/v1/progress" -H "Prefer: return=minimal" -d "$1"; }
uid() { uuidgen | tr A-F a-f; }
P=$(uid); R=$(uid)
say "progress: valid row" "$(ppost "$(prow "$R" "$P")")" 2xx
say "progress: same rid again" "$(ppost "$(prow "$R" "$P")")" 4xx
say "progress: GET" "$(code "$URL/rest/v1/progress?select=level&limit=1")" 4xx
say "progress: PATCH" "$(code -X PATCH "$URL/rest/v1/progress?build=eq.check.sh" -d '{"level":5}')" 4xx
say "progress: DELETE" "$(code -X DELETE "$URL/rest/v1/progress?build=eq.check.sh")" 4xx
say "progress: id in body" "$(ppost "$(prow "$(uid)" "$P" | sed 's/^{/{"id":1,/')")" 4xx
say "progress: kind x" "$(ppost "$(prow "$(uid)" "$P" | sed 's/"kind":"level"/"kind":"x"/')")" 4xx
say "progress: purchases {}" "$(ppost "$(prow "$(uid)" "$P" | sed 's/"purchases":\[[^]]*\]/"purchases":{}/')")" 4xx
B=$(for i in $(seq 1 121); do printf '{"id":"kick","lvl":1,"cost":40},'; done | sed 's/,$//')
say "progress: 121 purchases" "$(ppost "$(prow "$(uid)" "$P" | sed "s/\"purchases\":\[[^]]*\]/\"purchases\":[$B]/")")" 4xx
say "progress: player abc" "$(ppost "$(prow "$(uid)" abc)")" 4xx
say "progress: rid abc" "$(ppost "$(prow abc "$P")")" 4xx
say "progress: 21-char name" "$(ppost "$(prow "$(uid)" "$P" | sed 's/"name":null/"name":"Abcdefghijabcdefghija"/')")" 4xx
}

case "${ONLY:-all}" in errors) errors_checks;; scores) scores_checks;; progress) progress_checks;; *) scores_checks; errors_checks; progress_checks;; esac
echo "failed: $FAILS"
