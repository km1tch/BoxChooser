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

echo "Renaming JS files in lib directory..."
find "$FRONTEND_DIR/js/lib" -name "*.js" -type f | while read js_file; do
    base=$(basename "$js_file" .js)
    dir=$(dirname "$js_file")
    new_name="${base}.${TIMESTAMP}.js"
    mv "$js_file" "$dir/$new_name"
    echo "  Renamed: $(basename $js_file) -> $new_name"
done

echo "Renaming JS files in components directory..."
find "$FRONTEND_DIR/js/components" -name "*.js" -type f | while read js_file; do
    base=$(basename "$js_file" .js)
    dir=$(dirname "$js_file")
    new_name="${base}.${TIMESTAMP}.js"
    mv "$js_file" "$dir/$new_name"
    echo "  Renamed: $(basename $js_file) -> $new_name"
done

echo "Renaming JS files in root js directory..."
find "$FRONTEND_DIR/js" -maxdepth 1 -name "*.js" -type f | while read js_file; do
    base=$(basename "$js_file" .js)
    dir=$(dirname "$js_file")
    new_name="${base}.${TIMESTAMP}.js"
    mv "$js_file" "$dir/$new_name"
    echo "  Renamed: $(basename $js_file) -> $new_name"
done

# Now update all HTML files to reference the new filenames
echo "Updating HTML references..."
# Update HTML files in root and admin directory
for html_file in "$FRONTEND_DIR"/*.html "$FRONTEND_DIR"/admin/*.html; do
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
        
        # Update JS references in lib directory
        find "$FRONTEND_DIR/js/lib" -name "*.${TIMESTAMP}.js" -type f | while read js_file; do
            # Extract original name and new name
            new_name=$(basename "$js_file")
            orig_name=$(echo "$new_name" | sed -E "s/\.${TIMESTAMP}\.js$/.js/")
            
            # Replace in HTML (both script src and import statements)
            sed -i "s|/js/lib/${orig_name}|/js/lib/${new_name}|g" "$temp_file"
            sed -i "s|'/js/lib/${orig_name}'|'/js/lib/${new_name}'|g" "$temp_file"
            sed -i "s|\"/js/lib/${orig_name}\"|\"/js/lib/${new_name}\"|g" "$temp_file"
        done
        
        # Update JS references in components directory
        find "$FRONTEND_DIR/js/components" -name "*.${TIMESTAMP}.js" -type f | while read js_file; do
            # Extract original name and new name
            new_name=$(basename "$js_file")
            orig_name=$(echo "$new_name" | sed -E "s/\.${TIMESTAMP}\.js$/.js/")
            
            # Replace in HTML (both script src and ES6 import statements)
            sed -i "s|/js/components/${orig_name}|/js/components/${new_name}|g" "$temp_file"
            sed -i "s|'/js/components/${orig_name}'|'/js/components/${new_name}'|g" "$temp_file"
            sed -i "s|\"/js/components/${orig_name}\"|\"/js/components/${new_name}\"|g" "$temp_file"
        done
        
        # Update JS references in root js directory
        find "$FRONTEND_DIR/js" -maxdepth 1 -name "*.${TIMESTAMP}.js" -type f | while read js_file; do
            # Extract original name and new name
            new_name=$(basename "$js_file")
            orig_name=$(echo "$new_name" | sed -E "s/\.${TIMESTAMP}\.js$/.js/")
            
            # Replace in HTML
            sed -i "s|/js/${orig_name}|/js/${new_name}|g" "$temp_file"
            sed -i "s|'/js/${orig_name}'|'/js/${new_name}'|g" "$temp_file"
            sed -i "s|\"/js/${orig_name}\"|\"/js/${new_name}\"|g" "$temp_file"
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

# Also update JS files that might import other JS files
echo "Updating JS file imports..."
for js_file in "$FRONTEND_DIR"/js/*.${TIMESTAMP}.js "$FRONTEND_DIR"/js/*/*.${TIMESTAMP}.js "$FRONTEND_DIR"/admin/*.${TIMESTAMP}.js; do
    if [ -f "$js_file" ]; then
        # Create a temporary file
        temp_file="${js_file}.tmp"
        cp "$js_file" "$temp_file"
        
        # Update imports from lib directory
        find "$FRONTEND_DIR/js/lib" -name "*.${TIMESTAMP}.js" -type f | while read imported_file; do
            new_name=$(basename "$imported_file")
            orig_name=$(echo "$new_name" | sed -E "s/\.${TIMESTAMP}\.js$/.js/")
            
            # Replace imports
            sed -i "s|/js/lib/${orig_name}|/js/lib/${new_name}|g" "$temp_file"
            sed -i "s|'../lib/${orig_name}'|'../lib/${new_name}'|g" "$temp_file"
            sed -i "s|\"../lib/${orig_name}\"|\"../lib/${new_name}\"|g" "$temp_file"
            sed -i "s|'./lib/${orig_name}'|'./lib/${new_name}'|g" "$temp_file"
            sed -i "s|\"./lib/${orig_name}\"|\"./lib/${new_name}\"|g" "$temp_file"
        done
        
        # Update imports from components directory
        find "$FRONTEND_DIR/js/components" -name "*.${TIMESTAMP}.js" -type f | while read imported_file; do
            new_name=$(basename "$imported_file")
            orig_name=$(echo "$new_name" | sed -E "s/\.${TIMESTAMP}\.js$/.js/")
            
            # Replace imports
            sed -i "s|/js/components/${orig_name}|/js/components/${new_name}|g" "$temp_file"
            sed -i "s|'../components/${orig_name}'|'../components/${new_name}'|g" "$temp_file"
            sed -i "s|\"../components/${orig_name}\"|\"../components/${new_name}\"|g" "$temp_file"
            sed -i "s|'./components/${orig_name}'|'./components/${new_name}'|g" "$temp_file"
            sed -i "s|\"./components/${orig_name}\"|\"./components/${new_name}\"|g" "$temp_file"
            # Handle same-directory imports (./file.js)
            sed -i "s|'./${orig_name}'|'./${new_name}'|g" "$temp_file"
            sed -i "s|\"\./${orig_name}\"|\"\./${new_name}\"|g" "$temp_file"
        done
        
        # Check if file changed
        if ! cmp -s "$js_file" "$temp_file"; then
            mv "$temp_file" "$js_file"
            echo "  Updated imports in: $(basename $js_file)"
        else
            rm "$temp_file"
        fi
    fi
done

echo "Cache busting complete!"
echo "All CSS and JS files (including components) have been renamed with timestamp: $TIMESTAMP"