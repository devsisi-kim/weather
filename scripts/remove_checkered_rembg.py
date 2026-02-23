from rembg import remove
from PIL import Image

def run(input_path, output_path):
    input_image = Image.open(input_path)
    output_image = remove(input_image)
    output_image.save(output_path)
    print(f"Processed: {input_path}")

run("/Users/sia/.gemini/antigravity/brain/13b938ad-6909-482a-92df-2dab2683715a/weather_sunny_1771816665769.png", "/Users/sia/Documents/New project/assets/weather/sunny.png")
run("/Users/sia/.gemini/antigravity/brain/13b938ad-6909-482a-92df-2dab2683715a/weather_cloudy_1771816684162.png", "/Users/sia/Documents/New project/assets/weather/cloudy.png")
run("/Users/sia/.gemini/antigravity/brain/13b938ad-6909-482a-92df-2dab2683715a/weather_rainy_1771816702218.png", "/Users/sia/Documents/New project/assets/weather/rainy.png")
run("/Users/sia/.gemini/antigravity/brain/13b938ad-6909-482a-92df-2dab2683715a/weather_snowy_1771816720262.png", "/Users/sia/Documents/New project/assets/weather/snowy.png")
