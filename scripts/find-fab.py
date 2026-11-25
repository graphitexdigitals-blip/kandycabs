from PIL import Image

im = Image.open(r'C:\Users\Rakshith\.gemini\antigravity\brain\54357793-1034-48f8-9da5-8eea2ab067b5\.user_uploaded\s_card_verified.png')
w, h = im.size
print(f"Image size: {w}x{h}")

orange_pixels = []
for y in range(1700, 2200):
    for x in range(750, 1050):
        r, g, b = im.getpixel((x, y))[:3]
        if r > 230 and 80 < g < 130 and b < 30:
            orange_pixels.append((x, y))

if orange_pixels:
    min_x = min(p[0] for p in orange_pixels)
    max_x = max(p[0] for p in orange_pixels)
    min_y = min(p[1] for p in orange_pixels)
    max_y = max(p[1] for p in orange_pixels)
    center_x = (min_x + max_x) // 2
    center_y = (min_y + max_y) // 2
    print(f"Orange FAB bounding box: X=[{min_x}, {max_x}], Y=[{min_y}, {max_y}]")
    print(f"Center: ({center_x}, {center_y})")
else:
    print("Orange not found in that range")
