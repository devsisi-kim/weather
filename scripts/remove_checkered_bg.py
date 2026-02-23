from PIL import Image
import sys

def remove_checkered_background(input_path, output_path):
    try:
        img = Image.open(input_path).convert("RGBA")
        data = img.getdata()
        
        new_data = []
        for item in data:
            r, g, b, a = item
            # The checkered background usually consists of gray and dark gray squares
            if (r == g == b and r in [85, 170]):
                new_data.append((255, 255, 255, 0))
            else:
                new_data.append(item)
                
        img.putdata(new_data)
        img.save(output_path, "PNG")
        print(f"Processed {input_path} -> {output_path}")
    except Exception as e:
        print(f"Error processing {input_path}: {e}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python script.py <input> <output>")
        sys.exit(1)
    remove_checkered_background(sys.argv[1], sys.argv[2])
