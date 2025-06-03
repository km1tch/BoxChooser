# Floorplan Images

Storage directory for warehouse floorplan images.

## File Naming Convention

Use the following simplified naming pattern:

```
store{id}_floor.{ext}
```

Examples:

- `store1_floor.png`
- `store2_floor.jpg`
- `store3_floor.svg`

## Supported Formats

- PNG

## Image Requirements

- Maximum file size: 5MB

## TODO: Future Enhancements

1. **Support additional formats:**

   - PDF files, SVG?
   - Other image formats (JPEG, WebP, etc.)

2. **Image processing on upload:**

   - Auto-crop to remove unnecessary borders
   - Resize/optimize large images
   - Convert all formats to PNG for consistency

3. **Advanced features:**
   - Interactive cropping tool
   - Image rotation/alignment
