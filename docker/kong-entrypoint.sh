#!/bin/sh
# Kong (OSS, this version) does NOT itself expand ${VAR} placeholders inside
# a declarative config file — despite kong.yml's "_transform: true" and the
# ${ANON_KEY}/${SERVICE_ROLE_KEY} placeholders looking like it should. Left
# alone, Kong registers those literal strings as the consumers' API keys,
# so every real request gets 401 "Invalid authentication credentials" no
# matter how correct ANON_KEY/SERVICE_ROLE_KEY are elsewhere in the stack
# (verified: Kong's own container env had the right values; the deployed
# consumer credentials did not).
#
# Substitutes the placeholders ourselves before Kong ever reads the file.
# NOTE: an earlier version of this script used the classic
# `eval "echo \"$(cat file)\""` trick — don't go back to that. It re-parses
# the ENTIRE file as shell, which strips any double quotes the YAML itself
# contains (kong.yml has `_format_version: "2.1"`), silently turning it into
# an unquoted 2.1 and breaking Kong's config parser ("expected a string").
# sed only touches the two known placeholders and leaves everything else —
# including the file's own quoting — untouched. JWTs are base64url
# (A-Za-z0-9-_ and '.'), so no sed-special characters to worry about in
# either pattern or replacement.
set -eu

sed \
  -e "s|\${ANON_KEY}|$ANON_KEY|g" \
  -e "s|\${SERVICE_ROLE_KEY}|$SERVICE_ROLE_KEY|g" \
  /home/kong/kong.yml.template > /home/kong/kong.yml

exec /docker-entrypoint.sh kong docker-start
