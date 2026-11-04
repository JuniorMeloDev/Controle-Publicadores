import sys
import pymupdf
pdf = pymupdf.open(sys.argv[1])
if len(pdf) != 1:
    raise ValueError('O esquema precisa de um PDF com uma página.')
page = pdf[0]
scale = min(2.5, 2000 / max(page.rect.width, page.rect.height))
pix = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False)
# PNG is rendered once during preparation; native code never runs in Next.js.
pix.save(sys.argv[2])
print(f'{pix.width} {pix.height}')
