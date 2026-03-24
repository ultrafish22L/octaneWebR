import re, os, glob

proto_dir = r'C:\otoyla\dev\octaneWebR\server\proto'
results = []

for fpath in sorted(glob.glob(os.path.join(proto_dir, '*.proto'))):
    fname = os.path.basename(fpath)
    with open(fpath, 'r') as f:
        text = f.read()
    
    # Find all Request messages with ObjectRef field=1 that isn't objectPtr
    for m in re.finditer(
        r'message\s+(\w+Request)\s*\{[^}]*?ObjectRef\s+(\w+)\s*=\s*1\s*;',
        text, re.DOTALL
    ):
        msg_name = m.group(1)
        field_name = m.group(2)
        if field_name != 'objectPtr':
            results.append((fname, msg_name, field_name))

print(f"Found {len(results)} Request messages with non-objectPtr ObjectRef at field=1:\n")
for fname, msg, field in results:
    print(f"  {fname}: {msg}.{field}")
