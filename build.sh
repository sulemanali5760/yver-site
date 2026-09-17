#!/bin/sh
# Wraps the artifact source files (../kalt-studio) into standalone pages for GitHub Pages.
# Run from this folder:  sh build.sh
SRC="../kalt-studio"
wrap() { # $1 source  $2 output  $3 description
  { cat <<HEAD
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="$3">
<meta property="og:title" content="YVER — Chapters of the World">
<meta property="og:description" content="$3">
<meta property="og:type" content="website">
<meta property="og:url" content="https://rawajpret.store/">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' fill='%23120D0A'/%3E%3Cg fill='none' stroke='%23F1E6D6' stroke-width='7' stroke-linecap='round' stroke-dasharray='11 7'%3E%3Cpath d='M40 28 L60 60'/%3E%3Cpath d='M80 28 L60 60'/%3E%3Cpath d='M60 60 V92'/%3E%3C/g%3E%3Ccircle cx='60' cy='92' r='6' fill='%23F08A3C'/%3E%3C/svg%3E">
  <style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}img{max-width:100%}[hidden]{display:none!important}</style>
HEAD
    cat "$1"
    printf '\n</body>\n</html>\n'
  } > "$2"
  # the source starts with <title>…; everything before <style> belongs in the head
  sed -i 's|^<style>|</head>\n<body>\n<style>|' "$2"
}
wrap "$SRC/index.html" index.html "Outerwear told in chapters: every jacket begins with a real place and the craft people built there to live with cold."
wrap "$SRC/brand/brand-book.html" brand/brand-book.html "Brand book for YVER: name, trademark screening, logo, colour, type, label, photo brief and voice."
cp "$SRC"/brand/*.svg brand/
echo "built: index.html, brand/brand-book.html, $(ls brand/*.svg | wc -l) logo files"
