import sys
import os
import numpy as np
from PIL import Image
from rembg import remove

def isolate_and_split(image_path, out_prefix):
    print(f"Processing {image_path} -> {out_prefix}...")
    img = Image.open(image_path)
    # Remove background
    nobg = remove(img)
    
    # Analyze alpha channel
    alpha = np.array(nobg.split()[-1])
    col_sum = alpha.sum(axis=0)
    
    # Find active columns
    active_cols = np.where(col_sum > 0)[0]
    if len(active_cols) == 0:
        print("Warning: no active pixels found!")
        return []
    
    min_col, max_col = active_cols[0], active_cols[-1]
    mid_start = min_col + int((max_col - min_col) * 0.3)
    mid_end = min_col + int((max_col - min_col) * 0.7)
    
    # Find minimum column sum in middle 40%
    mid_slice = col_sum[mid_start:mid_end]
    split_col = mid_start + np.argmin(mid_slice)
    
    # Product 1 (left)
    left_part = nobg.crop((0, 0, split_col, nobg.height))
    bbox1 = left_part.getbbox()
    res = []
    if bbox1:
        c1 = left_part.crop(bbox1)
        pad = 8
        out1 = Image.new('RGBA', (c1.width + 2*pad, c1.height + 2*pad), (0,0,0,0))
        out1.paste(c1, (pad, pad))
        p1_path = f"public/{out_prefix}-1.png"
        out1.save(p1_path, "PNG")
        print(f"Saved {p1_path}: {out1.size}")
        res.append(p1_path)
        
    # Product 2 (right)
    right_part = nobg.crop((split_col, 0, nobg.width, nobg.height))
    bbox2 = right_part.getbbox()
    if bbox2:
        c2 = right_part.crop(bbox2)
        pad = 8
        out2 = Image.new('RGBA', (c2.width + 2*pad, c2.height + 2*pad), (0,0,0,0))
        out2.paste(c2, (pad, pad))
        p2_path = f"public/{out_prefix}-2.png"
        out2.save(p2_path, "PNG")
        print(f"Saved {p2_path}: {out2.size}")
        res.append(p2_path)
        
    return res

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python process-packshots.py <image_path> <out_prefix>")
        sys.exit(1)
    isolate_and_split(sys.argv[1], sys.argv[2])
