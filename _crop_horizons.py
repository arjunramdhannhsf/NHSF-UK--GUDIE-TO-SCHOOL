from PIL import Image

im = Image.open(r"C:\Users\arjun\nhsf-schools-guide\assets\_horizons-src.png").convert("RGBA")
w, h = im.size
px = im.load()

def page(r, g, b, a):
    return a < 10 or (r > 228 and g > 228 and b > 228)

minx, miny, maxx, maxy = w, h, 0, 0
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        if not page(r, g, b, a):
            minx = min(minx, x)
            miny = min(miny, y)
            maxx = max(maxx, x)
            maxy = max(maxy, y)
print("graphic", minx, miny, maxx, maxy)

# Per-row span of non-page
spans = []
for y in range(h):
    xs = [x for x in range(w) if not page(*px[x, y])]
    if xs:
        spans.append((y, xs[0], xs[-1]))
print("top rows", spans[:8])
print("mid", spans[h // 2])
print("bot", spans[-3:])

crop = im.crop((minx, miny, maxx + 1, maxy + 1))
crop.save(r"C:\Users\arjun\nhsf-schools-guide\assets\_h1.png")
print("saved", crop.size)
