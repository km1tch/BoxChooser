#!/bin/sh
# Cache busting script using only Alpine Linux tools
# Renames files with timestamps and updates HTML references

# Generate timestamp
TIMESTAMP=$(date +%s)

# Directory to process
FRONTEND_DIR="/srv/frontend"
if [ ! -d "$FRONTEND_DIR" ]; then
    # Running locally
    FRONTEND_DIR="$(dirname $(dirname $(readlink -f $0)))/frontend"
fi

echo "Cache busting with timestamp: $TIMESTAMP"
echo "Processing files in: $FRONTEND_DIR"

# First, rename all CSS and JS files to include timestamp
echo "Renaming CSS files..."
find "$FRONTEND_DIR/assets/css" -name "*.css" -type f | while read css_file; do
    base=$(basename "$css_file" .css)
    dir=$(dirname "$css_file")
    new_name="${base}.${TIMESTAMP}.css"
    mv "$css_file" "$dir/$new_name"
    echo "  Renamed: $(basename $css_file) -> $new_name"
done

echo "Renaming JS files..."
find "$FRONTEND_DIR/js" -name "*.js" -type f | while read js_file; do
    base=$(basename "$js_file" .js)
    dir=$(dirname "$js_file")
    new_name="${base}.${TIMESTAMP}.js"
    mv "$js_file" "$dir/$new_name"
    echo "  Renamed: $(basename $js_file) -> $new_name"
done

# Now update all HTML files to reference the new filenames
echo "Updating HTML references..."
for html_file in "$FRONTEND_DIR"/*.html; do
    if [ -f "$html_file" ]; then
        # Create a temporary file
        temp_file="${html_file}.tmp"
        cp "$html_file" "$temp_file"
        
        # Update CSS references
        find "$FRONTEND_DIR/assets/css" -name "*.${TIMESTAMP}.css" -type f | while read css_file; do
            # Extract original name and new name
            new_name=$(basename "$css_file")
            orig_name=$(echo "$new_name" | sed -E "s/\.${TIMESTAMP}\.css$/.css/")
            
            # Replace in HTML
            sed -i "s|/assets/css/${orig_name}|/assets/css/${new_name}|g" "$temp_file"
        done
        
        # Update JS references
        find "$FRONTEND_DIR/js" -name "*.${TIMESTAMP}.js" -type f | while read js_file; do
            # Extract original name and new name
            new_name=$(basename "$js_file")
            orig_name=$(echo "$new_name" | sed -E "s/\.${TIMESTAMP}\.js$/.js/")
            
            # Get relative path from js directory
            rel_path=$(echo "$js_file" | sed "s|$FRONTEND_DIR/js/||")
            orig_path=$(echo "$rel_path" | sed -E "s/\.${TIMESTAMP}\.js$/.js/")
            
            # Replace in HTML
            sed -i "s|/js/${orig_path}|/js/${rel_path}|g" "$temp_file"
        done
        
        # Check if file changed
        if ! cmp -s "$html_file" "$temp_file"; then
            mv "$temp_file" "$html_file"
            echo "  Updated: $(basename $html_file)"
        else
            rm "$temp_file"
        fi
    fi
done

echo "Cache busting complete!"