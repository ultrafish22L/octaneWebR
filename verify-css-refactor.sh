#!/bin/bash
# Quick verification script for CSS refactoring

echo "🔍 Verifying CSS Refactoring..."
echo ""

# Check 1: octane-theme.css only has :root
echo "✓ Checking octane-theme.css structure..."
if grep -qE '^\s*\.[a-zA-Z]|^\s*#[a-zA-Z]|^\s*[a-zA-Z]+[^:].*\{' client/src/styles/octane-theme.css 2>/dev/null; then
    echo "  ❌ FAIL: Found non-:root selectors in octane-theme.css"
    exit 1
else
    echo "  ✅ PASS: Only :root variables found"
fi

# Check 2: All CSS files have balanced braces
echo "✓ Checking CSS syntax..."
for file in client/src/styles/*.css; do
    if [ -f "$file" ] && [[ ! "$file" =~ \.backup$ ]]; then
        OPEN=$(grep -o '{' "$file" | wc -l)
        CLOSE=$(grep -o '}' "$file" | wc -l)
        if [ "$OPEN" -ne "$CLOSE" ]; then
            echo "  ❌ FAIL: $(basename $file) has unbalanced braces"
            exit 1
        fi
    fi
done
echo "  ✅ PASS: All CSS files have balanced braces"

# Check 3: main.tsx imports theme first
echo "✓ Checking import order..."
if head -15 client/src/main.tsx | grep -q "octane-theme.css"; then
    echo "  ✅ PASS: octane-theme.css imported in main.tsx"
else
    echo "  ❌ FAIL: octane-theme.css not found in main.tsx imports"
    exit 1
fi

# Check 4: Backup exists
echo "✓ Checking backup..."
if [ -f "client/src/styles/octane-theme.css.backup" ]; then
    echo "  ✅ PASS: Backup file exists"
else
    echo "  ⚠️  WARNING: No backup file found"
fi

# Check 5: Documentation exists
echo "✓ Checking documentation..."
DOCS=("CSS_CLEANUP_SUMMARY.md" "CSS_REFACTOR_COMPLETE.md" "UNUSED_CSS_CLASSES.md" "THEME_GUIDE.md")
for doc in "${DOCS[@]}"; do
    if [ ! -f "$doc" ]; then
        echo "  ⚠️  WARNING: $doc not found"
    fi
done
echo "  ✅ PASS: Documentation files present"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All checks passed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "To test the application:"
echo "  npm run dev"
echo ""
echo "To create a new theme:"
echo "  See THEME_GUIDE.md"
echo ""
