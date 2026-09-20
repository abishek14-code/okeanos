"""Create the source + built-dashboard archive, omitting installed dependencies."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import sys
root = Path(__file__).resolve().parent.parent
out = Path(sys.argv[1]).resolve()
excluded = {'.pio', 'node_modules', '.git', 'target', 'test-results', 'playwright-report', '__pycache__'}
with ZipFile(out, 'w', ZIP_DEFLATED) as archive:
    for path in sorted(root.rglob('*')):
        relative = path.relative_to(root)
        if path.is_file() and not any(part in excluded for part in relative.parts) and path.resolve() != out:
            archive.write(path, Path('okeanos-main') / relative)
print(f'{out.name}: {out.stat().st_size:,} bytes')
